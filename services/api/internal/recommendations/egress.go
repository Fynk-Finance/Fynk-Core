package recommendations

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

// In AWS the API runs in private subnets without a NAT gateway, so it reaches the internet only
// through the Caddy egress (M14). With RECOMMENDATIONS_VIA_EGRESS=true the model is called at
// <EGRESS_URL>/<provider route>, and the client trusts the CA of the egress's own certificate.

// egressRoutes are the Caddy routes of each provider, with the path of its OpenAI compatible API.
var egressRoutes = map[string]string{
	providerGemini: "/gemini/v1beta/openai",
}

// viaEgress points cfg at the egress and returns the client for it. It fails when the egress is
// not configured or the provider has no route, so the module falls back to the templates.
func viaEgress(cfg *settings, egressURL, caFile string) (*http.Client, error) {
	if egressURL == "" {
		return nil, errors.New("RECOMMENDATIONS_VIA_EGRESS needs EGRESS_URL")
	}
	route, ok := egressRoutes[cfg.Provider]
	if !ok {
		return nil, fmt.Errorf("no egress route for provider %q", cfg.Provider)
	}
	cfg.BaseURL = strings.TrimRight(egressURL, "/") + route
	return egressClient(caFile)
}

// egressClient trusts the system roots plus the egress CA (EGRESS_CA_FILE). The advisor bounds
// every attempt; the client timeout is only a backstop.
func egressClient(caFile string) (*http.Client, error) {
	pool, err := x509.SystemCertPool()
	if err != nil || pool == nil {
		pool = x509.NewCertPool()
	}
	if caFile != "" {
		pem, err := os.ReadFile(caFile)
		if err != nil {
			return nil, fmt.Errorf("egress CA: %w", err)
		}
		if !pool.AppendCertsFromPEM(pem) {
			return nil, errors.New("egress CA: no certificate in the file")
		}
	}
	tr := http.DefaultTransport.(*http.Transport).Clone()
	tr.TLSClientConfig = &tls.Config{RootCAs: pool, MinVersion: tls.VersionTLS12}
	return &http.Client{Timeout: 30 * time.Second, Transport: tr}, nil
}
