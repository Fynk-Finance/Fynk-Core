package keys

import (
	"context"
	"crypto"
	"crypto/hmac"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"errors"
	"strings"
	"testing"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

// fakeKMS answers like AWS KMS with local keys: RSASSA_PSS_SHA_256 over a digest (salt length
// equal to the hash, as KMS does) and HMAC_SHA_256. It records what it was asked.
type fakeKMS struct {
	rsa     *rsa.PrivateKey
	mac     []byte
	fail    error
	keyIDs  []string
	digests [][]byte
}

func (f *fakeKMS) SignDigest(_ context.Context, keyID string, digest []byte) ([]byte, error) {
	f.keyIDs = append(f.keyIDs, keyID)
	f.digests = append(f.digests, digest)
	if f.fail != nil {
		return nil, f.fail
	}
	return rsa.SignPSS(rand.Reader, f.rsa, crypto.SHA256, digest, &rsa.PSSOptions{SaltLength: rsa.PSSSaltLengthEqualsHash})
}

func (f *fakeKMS) GenerateMac(_ context.Context, keyID string, message []byte) ([]byte, error) {
	f.keyIDs = append(f.keyIDs, keyID)
	if f.fail != nil {
		return nil, f.fail
	}
	m := hmac.New(sha256.New, f.mac)
	m.Write(message)
	return m.Sum(nil), nil
}

func TestTheKMSAssertionIsPS256AndVerifiesWithThePublicKey(t *testing.T) {
	key := rsaKey(t, 3072) // the RSA_3072 key of M14's KMS module
	kms := &fakeKMS{rsa: key}
	s, err := NewKMSSigner(kms, "alias/fynk-bank-signer", "fynk", clock.NewFixed(now))
	if err != nil {
		t.Fatal(err)
	}
	signed, err := s.ClientAssertion(context.Background(), "https://bank.example")
	if err != nil {
		t.Fatal(err)
	}
	c := parse(t, signed, key)
	if c.Issuer != "fynk" || c.Subject != "fynk" || c.Audience[0] != "https://bank.example" || c.ID == "" {
		t.Fatalf("claims = %+v", c)
	}
	if c.ExpiresAt.Sub(c.IssuedAt.Time) != AssertionLifetime || !c.IssuedAt.Equal(now) {
		t.Fatalf("iat %v exp %v, want exp = iat + 60 s", c.IssuedAt, c.ExpiresAt)
	}
	// KMS signs only the SHA-256 digest of "header.payload": the key never leaves KMS.
	input := signed[:strings.LastIndex(signed, ".")]
	want := sha256.Sum256([]byte(input))
	if len(kms.digests) != 1 || string(kms.digests[0]) != string(want[:]) {
		t.Fatal("KMS did not get the digest of the signing input")
	}
	if kms.keyIDs[0] != "alias/fynk-bank-signer" {
		t.Fatalf("key id = %q", kms.keyIDs[0])
	}
}

func TestTheKMSSignerGivesEachAssertionItsOwnJti(t *testing.T) {
	key := rsaKey(t, 2048)
	s, _ := NewKMSSigner(&fakeKMS{rsa: key}, "k", "fynk", clock.NewFixed(now))
	a, _ := s.ClientAssertion(context.Background(), "bank")
	b, _ := s.ClientAssertion(context.Background(), "bank")
	if parse(t, a, key).ID == parse(t, b, key).ID {
		t.Fatal("jti repeated")
	}
}

func TestTheKMSSignerRefusesMissingValuesAndReportsKMSErrors(t *testing.T) {
	c := clock.NewFixed(now)
	if _, err := NewKMSSigner(nil, "k", "fynk", c); err == nil {
		t.Fatal("want an error without a KMS client")
	}
	if _, err := NewKMSSigner(&fakeKMS{}, "", "fynk", c); err == nil {
		t.Fatal("want an error without a key id")
	}
	if _, err := NewKMSSigner(&fakeKMS{}, "k", "", c); err == nil {
		t.Fatal("want an error without a client id")
	}
	s, _ := NewKMSSigner(&fakeKMS{fail: errors.New("AccessDeniedException")}, "k", "fynk", c)
	if _, err := s.ClientAssertion(context.Background(), ""); err == nil {
		t.Fatal("want an error without an audience")
	}
	if _, err := s.ClientAssertion(context.Background(), "bank"); err == nil || !strings.Contains(err.Error(), "AccessDeniedException") {
		t.Fatalf("err = %v, want the KMS error", err)
	}
}

func TestTheKMSFingerprintIsTheHMACOfTheToken(t *testing.T) {
	secret := []byte(strings.Repeat("k", 32))
	kms := &fakeKMS{mac: secret}
	f, err := NewKMSFingerprinter(kms, "alias/fynk-token-fingerprint")
	if err != nil {
		t.Fatal(err)
	}
	got, err := f.Fingerprint(context.Background(), "refresh-1")
	if err != nil {
		t.Fatal(err)
	}
	local, _ := NewLocalHMAC(secret)
	want, _ := local.Fingerprint(context.Background(), "refresh-1")
	if !hmac.Equal(got, want) {
		t.Fatal("the KMS fingerprint differs from HMAC-SHA-256 of the token")
	}
	if ok, _ := Matches(context.Background(), f, "refresh-2", got); ok {
		t.Fatal("another token must not match")
	}
	if kms.keyIDs[0] != "alias/fynk-token-fingerprint" {
		t.Fatalf("key id = %q", kms.keyIDs[0])
	}
}

func TestTheKMSFingerprinterNeverPutsTheTokenInAnError(t *testing.T) {
	if _, err := NewKMSFingerprinter(nil, "k"); err == nil {
		t.Fatal("want an error without a KMS client")
	}
	if _, err := NewKMSFingerprinter(&fakeKMS{}, ""); err == nil {
		t.Fatal("want an error without a key id")
	}
	f, _ := NewKMSFingerprinter(&fakeKMS{fail: errors.New("ThrottlingException")}, "k")
	if _, err := f.Fingerprint(context.Background(), ""); err == nil {
		t.Fatal("want an error for an empty token")
	}
	_, err := f.Fingerprint(context.Background(), "secret-refresh-token")
	if err == nil || strings.Contains(err.Error(), "secret-refresh-token") {
		t.Fatalf("err = %v: want an error without the token", err)
	}
}
