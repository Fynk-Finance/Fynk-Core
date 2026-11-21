package market

import (
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestEgressClientTrustsTheEgressCA(t *testing.T) {
	ts := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {}))
	defer ts.Close()
	ca := filepath.Join(t.TempDir(), "ca.crt")
	block := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: ts.Certificate().Raw})
	if err := os.WriteFile(ca, block, 0o600); err != nil {
		t.Fatal(err)
	}
	client, err := egressClient(ca)
	if err != nil {
		t.Fatal(err)
	}
	resp, err := client.Get(ts.URL)
	if err != nil {
		t.Fatalf("the egress CA must be trusted: %v", err)
	}
	_ = resp.Body.Close()

	plain, _ := egressClient("")
	if resp, err := plain.Get(ts.URL); err == nil {
		_ = resp.Body.Close()
		t.Fatal("without the CA file the egress certificate must not be trusted")
	}
}

func TestEgressClientRejectsABadCAFile(t *testing.T) {
	bad := filepath.Join(t.TempDir(), "bad.crt")
	_ = os.WriteFile(bad, []byte("not a cert"), 0o600)
	if _, err := egressClient(bad); err == nil {
		t.Fatal("a file without certificates must fail")
	}
	if _, err := egressClient(filepath.Join(t.TempDir(), "missing.crt")); err == nil {
		t.Fatal("a missing file must fail")
	}
}

func TestEgressPathFailsClosedWithoutAnEgress(t *testing.T) {
	if egressPath("", "alpaca") != "" {
		t.Fatal("no egress, no URL")
	}
	if got := egressPath("https://egress:8443", "banco-demo"); got != "https://egress:8443/banco-demo" {
		t.Fatal(got)
	}
}
