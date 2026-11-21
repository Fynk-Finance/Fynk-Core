package keys

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

var now = time.Date(2026, 10, 29, 15, 0, 0, 0, time.UTC)

func rsaKey(t *testing.T, bits int) *rsa.PrivateKey {
	t.Helper()
	k, err := rsa.GenerateKey(rand.Reader, bits)
	if err != nil {
		t.Fatal(err)
	}
	return k
}

func parse(t *testing.T, signed string, key *rsa.PrivateKey) *jwt.RegisteredClaims {
	t.Helper()
	claims := &jwt.RegisteredClaims{}
	_, err := jwt.ParseWithClaims(signed, claims, func(*jwt.Token) (any, error) { return &key.PublicKey, nil },
		jwt.WithValidMethods([]string{"PS256"}), jwt.WithTimeFunc(func() time.Time { return now }))
	if err != nil {
		t.Fatalf("parse assertion: %v", err)
	}
	return claims
}

func TestTheClientAssertionIsPS256WithAudienceJtiAndSixtySeconds(t *testing.T) {
	key := rsaKey(t, 2048)
	s, err := NewLocalSigner(key, "fynk", clock.NewFixed(now))
	if err != nil {
		t.Fatal(err)
	}
	signed, err := s.ClientAssertion(context.Background(), "https://bank.example")
	if err != nil {
		t.Fatal(err)
	}
	c := parse(t, signed, key)
	if c.Issuer != "fynk" || c.Subject != "fynk" {
		t.Fatalf("iss/sub = %q/%q, want fynk", c.Issuer, c.Subject)
	}
	if len(c.Audience) != 1 || c.Audience[0] != "https://bank.example" {
		t.Fatalf("aud = %v", c.Audience)
	}
	if c.ExpiresAt.Sub(c.IssuedAt.Time) != 60*time.Second || !c.IssuedAt.Equal(now) {
		t.Fatalf("iat %v exp %v, want exp = iat + 60 s", c.IssuedAt, c.ExpiresAt)
	}
	if c.ID == "" {
		t.Fatal("no jti")
	}
}

func TestEveryAssertionHasItsOwnJti(t *testing.T) {
	s, _ := NewLocalSigner(rsaKey(t, 2048), "fynk", clock.NewFixed(now))
	seen := map[string]bool{}
	key := s.key
	for range 20 {
		signed, err := s.ClientAssertion(context.Background(), "bank")
		if err != nil {
			t.Fatal(err)
		}
		jti := parse(t, signed, key).ID
		if seen[jti] {
			t.Fatalf("jti %q repeated", jti)
		}
		seen[jti] = true
	}
}

func TestTheAssertionIsRejectedAsRS256OrHS256(t *testing.T) {
	key := rsaKey(t, 2048)
	s, _ := NewLocalSigner(key, "fynk", clock.NewFixed(now))
	signed, _ := s.ClientAssertion(context.Background(), "bank")
	_, err := jwt.Parse(signed, func(*jwt.Token) (any, error) { return &key.PublicKey, nil },
		jwt.WithValidMethods([]string{"RS256", "HS256"}))
	if err == nil {
		t.Fatal("a PS256 assertion must not pass as RS256 or HS256")
	}
}

func TestTheSignerRefusesWeakKeysAndMissingValues(t *testing.T) {
	if _, err := NewLocalSigner(rsaKey(t, 1024), "fynk", clock.NewFixed(now)); err == nil {
		t.Fatal("want an error for a 1024 bit key")
	}
	if _, err := NewLocalSigner(rsaKey(t, 2048), "", clock.NewFixed(now)); err == nil {
		t.Fatal("want an error without a client id")
	}
	s, _ := NewLocalSigner(rsaKey(t, 2048), "fynk", clock.NewFixed(now))
	if _, err := s.ClientAssertion(context.Background(), ""); err == nil {
		t.Fatal("want an error without an audience")
	}
}

func TestLoadLocalSignerReadsPKCS1AndPKCS8(t *testing.T) {
	key := rsaKey(t, 2048)
	dir := t.TempDir()
	pkcs8, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	files := map[string]*pem.Block{
		"pkcs1.pem": {Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)},
		"pkcs8.pem": {Type: "PRIVATE KEY", Bytes: pkcs8},
	}
	for name, block := range files {
		path := filepath.Join(dir, name)
		if err := os.WriteFile(path, pem.EncodeToMemory(block), 0o600); err != nil {
			t.Fatal(err)
		}
		s, err := LoadLocalSigner(path, "fynk", clock.NewFixed(now))
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		signed, err := s.ClientAssertion(context.Background(), "bank")
		if err != nil {
			t.Fatal(err)
		}
		parse(t, signed, key)
	}
	if _, err := LoadLocalSigner(filepath.Join(dir, "missing.pem"), "fynk", clock.NewFixed(now)); err == nil {
		t.Fatal("want an error for a missing file")
	}
	notPEM := filepath.Join(dir, "x.pem")
	_ = os.WriteFile(notPEM, []byte("hello"), 0o600)
	if _, err := LoadLocalSigner(notPEM, "fynk", clock.NewFixed(now)); err == nil {
		t.Fatal("want an error for a file that is not PEM")
	}
}

func TestTheFingerprintIsStableKeyedAndComparedInConstantTime(t *testing.T) {
	ctx := context.Background()
	a, err := NewLocalHMAC([]byte("0123456789abcdef0123456789abcdef"))
	if err != nil {
		t.Fatal(err)
	}
	b, _ := NewLocalHMAC([]byte("fedcba9876543210fedcba9876543210"))
	f1, _ := a.Fingerprint(ctx, "refresh-1")
	f2, _ := a.Fingerprint(ctx, "refresh-1")
	other, _ := a.Fingerprint(ctx, "refresh-2")
	otherKey, _ := b.Fingerprint(ctx, "refresh-1")
	if string(f1) != string(f2) || len(f1) != 32 {
		t.Fatal("the same token must give the same 32 byte fingerprint")
	}
	if string(f1) == string(other) || string(f1) == string(otherKey) {
		t.Fatal("another token or another key must give another fingerprint")
	}
	if ok, _ := Matches(ctx, a, "refresh-1", f1); !ok {
		t.Fatal("Matches = false for the right token")
	}
	if ok, _ := Matches(ctx, a, "refresh-2", f1); ok {
		t.Fatal("Matches = true for another token")
	}
	if _, err := a.Fingerprint(ctx, ""); err == nil {
		t.Fatal("want an error for an empty token")
	}
}

func TestTheFingerprintKeyMustBeLongEnough(t *testing.T) {
	if _, err := NewLocalHMAC(make([]byte, 31)); err == nil {
		t.Fatal("want an error for a 31 byte key")
	}
	path := filepath.Join(t.TempDir(), "fp.key")
	_ = os.WriteFile(path, make([]byte, 32), 0o600)
	if _, err := LoadLocalHMAC(path); err != nil {
		t.Fatalf("LoadLocalHMAC: %v", err)
	}
}
