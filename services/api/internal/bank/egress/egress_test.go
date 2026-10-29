package egress

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// otherCAServer serves TLS with its own self-signed certificate, unlike every httptest server,
// which shares one built-in certificate.
func otherCAServer(t *testing.T) *httptest.Server {
	t.Helper()
	key, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(42), Subject: pkix.Name{CommonName: "other"},
		NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour),
		IPAddresses: []net.IP{net.ParseIP("127.0.0.1")}, IsCA: true, BasicConstraintsValid: true,
		KeyUsage: x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(204) }))
	srv.TLS = &tls.Config{Certificates: []tls.Certificate{{Certificate: [][]byte{der}, PrivateKey: key}}}
	srv.StartTLS()
	return srv
}

func writeCA(t *testing.T, srv *httptest.Server) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "ca.crt")
	b := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: srv.Certificate().Raw})
	if err := os.WriteFile(path, b, 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

// HU-031: the API trusts only the egress's CA.
func TestTheClientTrustsOnlyTheGivenCA(t *testing.T) {
	trusted := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(204) }))
	defer trusted.Close()
	other := otherCAServer(t)
	defer other.Close()

	c, err := NewClient(writeCA(t, trusted))
	if err != nil {
		t.Fatal(err)
	}
	res, err := c.Get(trusted.URL)
	if err != nil || res.StatusCode != 204 {
		t.Fatalf("trusted: %v %v", res, err)
	}
	_ = res.Body.Close()
	if res, err := c.Get(other.URL); err == nil {
		_ = res.Body.Close()
		t.Fatal("a server signed by another CA was trusted")
	}
	if c.Transport.(*http.Transport).TLSClientConfig.MinVersion != tls.VersionTLS12 {
		t.Fatal("TLS below 1.2 allowed")
	}
}

func TestTheClientNeverFollowsARedirect(t *testing.T) {
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "https://elsewhere.example/steal", http.StatusFound)
	}))
	defer srv.Close()
	c, _ := NewClient(writeCA(t, srv))
	res, err := c.Get(srv.URL)
	if err != nil || res.StatusCode != http.StatusFound {
		t.Fatalf("got %v, %v", res, err)
	}
	_ = res.Body.Close()
}

func TestABadCAFileIsAnError(t *testing.T) {
	if _, err := NewClient(filepath.Join(t.TempDir(), "missing.crt")); err == nil {
		t.Fatal("missing file accepted")
	}
	empty := filepath.Join(t.TempDir(), "empty.crt")
	_ = os.WriteFile(empty, []byte("not a certificate"), 0o600)
	if _, err := NewClient(empty); err == nil {
		t.Fatal("file without PEM accepted")
	}
}

func TestBaseURLNeedsTheEgress(t *testing.T) {
	if _, err := BaseURL("", "banco-demo"); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("err = %v", err)
	}
	if got, _ := BaseURL("https://caddy:8443", "banco-demo"); got != "https://caddy:8443/banco-demo" {
		t.Fatalf("got %q", got)
	}
}
