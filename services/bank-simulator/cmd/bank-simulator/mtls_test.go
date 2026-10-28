package main

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/domain"
	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/store"
)

func TestOpenFinanceAPIOverMTLSListener(t *testing.T) {
	ca := newCA(t, "Fynk Local CA")
	otherCA := newCA(t, "Attacker CA")

	tlsCfg, err := internalTLSConfig(ca.pem)
	if err != nil {
		t.Fatalf("internalTLSConfig failed: %v", err)
	}

	serverCert := ca.leaf(t, "bank-simulator", 1, x509.ExtKeyUsageServerAuth)
	tlsCfg.Certificates = []tls.Certificate{serverCert}

	roots := x509.NewCertPool()
	roots.AppendCertsFromPEM(ca.pem)

	var logBuf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logBuf, nil))

	bankStore := store.NewBankStore(time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC))
	handler := logClientCert(logger, newBankMux(bankStore))

	server := httptest.NewUnstartedServer(handler)
	server.TLS = tlsCfg
	server.StartTLS()
	defer server.Close()

	validClientCert := ca.leaf(t, "fynk-client", 0x4821, x509.ExtKeyUsageClientAuth)
	untrustedClientCert := otherCA.leaf(t, "fake-client", 0x9999, x509.ExtKeyUsageClientAuth)

	// 1. Client with valid mTLS certificate
	validClient := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				RootCAs:      roots,
				ServerName:   "bank-simulator",
				Certificates: []tls.Certificate{validClientCert},
			},
		},
	}

	req, err := http.NewRequest(http.MethodGet, server.URL+"/open-finance/v1/accounts", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer dev-token")

	resp, err := validClient.Do(req)
	if err != nil {
		t.Fatalf("valid mTLS request failed: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", resp.StatusCode)
	}

	var accRes struct {
		Data []domain.Account `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&accRes); err != nil {
		t.Fatalf("failed to decode accounts response: %v", err)
	}
	if len(accRes.Data) != 4 {
		t.Errorf("expected 4 accounts, got %d", len(accRes.Data))
	}

	// Verify client certificate serial and subject was logged (HU-031 evidence)
	logOutput := logBuf.String()
	if !strings.Contains(logOutput, `"serial":"4821"`) || !strings.Contains(logOutput, `"subject_cn":"fynk-client"`) {
		t.Errorf("expected serial 4821 and subject fynk-client in logs, got: %s", logOutput)
	}

	// 2. Client without client certificate MUST fail handshake
	noCertClient := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				RootCAs:    roots,
				ServerName: "bank-simulator",
			},
		},
	}
	_, err = noCertClient.Get(server.URL + "/open-finance/v1/accounts")
	if err == nil {
		t.Fatal("expected TLS handshake failure for client without cert, but succeeded")
	}

	// 3. Client with certificate from untrusted CA MUST fail handshake
	untrustedClient := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				RootCAs:      roots,
				ServerName:   "bank-simulator",
				Certificates: []tls.Certificate{untrustedClientCert},
			},
		},
	}
	_, err = untrustedClient.Get(server.URL + "/open-finance/v1/accounts")
	if err == nil {
		t.Fatal("expected TLS handshake failure for untrusted client cert, but succeeded")
	}

	// 4. Revocation test over mTLS
	delReq, _ := http.NewRequest(http.MethodDelete, server.URL+"/open-finance/v1/consents/consent-demo-001", nil)
	delReq.Header.Set("Authorization", "Bearer dev-token")
	delResp, err := validClient.Do(delReq)
	if err != nil {
		t.Fatalf("failed to revoke consent over mTLS: %v", err)
	}
	defer func() { _ = delResp.Body.Close() }()
	if delResp.StatusCode != http.StatusNoContent {
		t.Errorf("expected 204 No Content, got %d", delResp.StatusCode)
	}

	// 5. Subsequent call with revoked consent token must return 403 consent_revoked
	afterReq, _ := http.NewRequest(http.MethodGet, server.URL+"/open-finance/v1/accounts", nil)
	afterReq.Header.Set("Authorization", "Bearer consent-demo-001")
	afterResp, err := validClient.Do(afterReq)
	if err != nil {
		t.Fatalf("call after revocation failed: %v", err)
	}
	defer func() { _ = afterResp.Body.Close() }()
	if afterResp.StatusCode != http.StatusForbidden {
		body, _ := io.ReadAll(afterResp.Body)
		t.Fatalf("expected 403 Forbidden after revocation, got %d: %s", afterResp.StatusCode, string(body))
	}
}
