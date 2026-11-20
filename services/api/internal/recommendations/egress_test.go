package recommendations

import (
	"context"
	"encoding/pem"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/recommendations/advisor"
)

func TestGeminiThroughTheEgressUsesItsRouteAndTrustsItsCA(t *testing.T) {
	var path string
	egress := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path = r.URL.Path
		_, _ = io.Copy(io.Discard, r.Body)
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"{\"summary\":\"Vas bien.\",\"steps\":[]}"}}]}`))
	}))
	defer egress.Close()
	// The egress certificate is signed by a CA the system does not know, as in AWS.
	ca := filepath.Join(t.TempDir(), "egress-ca.pem")
	block := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: egress.Certificate().Raw})
	if err := os.WriteFile(ca, block, 0o600); err != nil {
		t.Fatal(err)
	}

	cfg := loadSettings(func(k string) string {
		return map[string]string{
			"RECOMMENDATIONS_PROVIDER": "gemini", "GEMINI_API_KEY": "k", "RECOMMENDATIONS_VIA_EGRESS": "true",
		}[k]
	})
	client, err := viaEgress(&cfg, egress.URL+"/", ca)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.BaseURL != egress.URL+"/gemini/v1beta/openai" {
		t.Fatalf("base URL %q", cfg.BaseURL)
	}
	resp, err := newModel(cfg, client, quietLog()).Generate(context.Background(), advisor.ModelRequest{
		System: "s", User: "u", OutputSchema: advisor.OutputSchema, MaxTokens: 10,
	})
	if err != nil {
		t.Fatal(err)
	}
	if path != "/gemini/v1beta/openai/chat/completions" || !strings.Contains(resp.Text, "Vas bien") {
		t.Fatalf("path %q text %q", path, resp.Text)
	}
}

func TestTheEgressFailsClosedWithoutURLOrRoute(t *testing.T) {
	cfg := settings{Provider: providerGemini}
	if _, err := viaEgress(&cfg, "", ""); err == nil {
		t.Fatal("want an error without EGRESS_URL")
	}
	cfg = settings{Provider: providerOpenAI}
	if _, err := viaEgress(&cfg, "https://egress:8443", ""); err == nil {
		t.Fatal("want an error for a provider without an egress route")
	}
	cfg = settings{Provider: providerGemini}
	if _, err := viaEgress(&cfg, "https://egress:8443", filepath.Join(t.TempDir(), "missing.pem")); err == nil {
		t.Fatal("want an error when the CA file is missing")
	}
}

func quietLog() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }
