package main

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"io"
	"log/slog"
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type issuer struct {
	cert *x509.Certificate
	key  *ecdsa.PrivateKey
	pem  []byte
}

func newCA(t *testing.T, name string) issuer {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: name},
		NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour),
		IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign,
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	cert, err := x509.ParseCertificate(der)
	if err != nil {
		t.Fatal(err)
	}
	return issuer{cert, key, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})}
}

func (ca issuer) leaf(t *testing.T, cn string, serial int64, usage x509.ExtKeyUsage) tls.Certificate {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(serial), Subject: pkix.Name{CommonName: cn},
		NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour),
		KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{usage},
		DNSNames: []string{cn},
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, ca.cert, &key.PublicKey, ca.key)
	if err != nil {
		t.Fatal(err)
	}
	return tls.Certificate{Certificate: [][]byte{der}, PrivateKey: key}
}

// handshake runs a TLS handshake over an in-memory pipe and returns the server side state.
// No TCP socket is used, so antivirus HTTPS inspection on the developer machine (seen with
// Avast on localhost) cannot replace the server certificate.
func handshake(t *testing.T, server *tls.Config, roots *x509.CertPool, certs ...tls.Certificate) (tls.ConnectionState, error) {
	t.Helper()
	sc, cc := net.Pipe()
	_ = sc.SetDeadline(time.Now().Add(5 * time.Second))
	_ = cc.SetDeadline(time.Now().Add(5 * time.Second))
	srv := tls.Server(sc, server)
	cli := tls.Client(cc, &tls.Config{RootCAs: roots, ServerName: "bank-simulator", Certificates: certs, MinVersion: tls.VersionTLS12})
	done := make(chan struct{})
	go func() { // the server side decides; the client only has to finish its part
		defer close(done)
		if cli.Handshake() == nil {
			_, _ = cli.Read(make([]byte, 1)) // receives the alert when the server rejects the client
		}
	}()
	serr := srv.Handshake()
	_ = sc.Close()
	<-done
	_ = cc.Close()
	return srv.ConnectionState(), serr
}

func TestInternalListenerRequiresAClientCertFromTheCA(t *testing.T) {
	ca := newCA(t, "Fynk Local CA")
	other := newCA(t, "Unknown CA")
	tlsCfg, err := internalTLSConfig(ca.pem)
	if err != nil {
		t.Fatal(err)
	}
	tlsCfg.Certificates = []tls.Certificate{ca.leaf(t, "bank-simulator", 2, x509.ExtKeyUsageServerAuth)}
	roots := x509.NewCertPool()
	roots.AppendCertsFromPEM(ca.pem)

	if _, err := handshake(t, tlsCfg, roots); err == nil {
		t.Fatal("handshake without a client certificate was accepted")
	}
	if _, err := handshake(t, tlsCfg, roots, other.leaf(t, "intruder", 3, x509.ExtKeyUsageClientAuth)); err == nil {
		t.Fatal("client certificate from another CA was accepted")
	}
	state, err := handshake(t, tlsCfg, roots, ca.leaf(t, "fynk-client", 0xabc, x509.ExtKeyUsageClientAuth))
	if err != nil {
		t.Fatalf("valid client certificate refused: %v", err)
	}

	// The handler sees the verified certificate and logs its serial.
	var logs bytes.Buffer
	h := logClientCert(slog.New(slog.NewJSONHandler(&logs, nil)), healthMux())
	req := httptest.NewRequest(http.MethodGet, "https://bank-simulator:9443/healthz", nil)
	req.TLS = &state
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"simulated":true`) {
		t.Fatalf("got %d %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(logs.String(), `"serial":"abc"`) || !strings.Contains(logs.String(), `"subject_cn":"fynk-client"`) {
		t.Errorf("client certificate serial not logged: %s", logs.String())
	}
}

func TestInternalTLSConfigRejectsAnEmptyCA(t *testing.T) {
	if _, err := internalTLSConfig([]byte("not a pem")); err == nil {
		t.Fatal("want an error for a CA file without certificates")
	}
}

func TestRunNeedsTheCertificates(t *testing.T) {
	quiet := slog.New(slog.NewJSONHandler(io.Discard, nil))
	err := run(t.Context(), loadConfig(func(string) string { return "" }), quiet)
	if err == nil || !strings.Contains(err.Error(), "make certs") {
		t.Fatalf("err = %v, want a hint to run make certs", err)
	}
}

func TestLoadConfigDefaults(t *testing.T) {
	c := loadConfig(func(string) string { return "" })
	if c.PublicAddr != ":8443" || c.InternalAddr != ":9443" {
		t.Errorf("defaults = %+v", c)
	}
}

func TestHealthcheck(t *testing.T) {
	srv := httptest.NewServer(healthMux())
	defer srv.Close()
	if got := healthcheck(srv.URL + "/healthz"); got != 0 {
		t.Errorf("healthy: exit %d, want 0", got)
	}
	if got := healthcheck(srv.URL + "/missing"); got != 1 {
		t.Errorf("404: exit %d, want 1", got)
	}
}
