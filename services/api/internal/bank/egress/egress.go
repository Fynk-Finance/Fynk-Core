// Package egress builds the HTTP client every bank adapter uses. Calls go to the Caddy egress
// (M14), which adds Fynk's mTLS client certificate: the API itself never holds that key.
package egress

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net/http"
	"os"
	"time"
)

// Timeout of one call to a bank, from connecting to reading the whole answer.
const Timeout = 15 * time.Second

// ErrNotConfigured: EGRESS_URL is not set, so no outside provider can be reached.
var ErrNotConfigured = errors.New("egress: EGRESS_URL is not set")

// NewClient returns a client that trusts only caFile's CA for the egress's TLS certificate
// (the system roots when caFile is empty), with TLS 1.2 or newer and no redirects.
func NewClient(caFile string) (*http.Client, error) {
	tlsCfg := &tls.Config{MinVersion: tls.VersionTLS12}
	if caFile != "" {
		pem, err := os.ReadFile(caFile)
		if err != nil {
			return nil, fmt.Errorf("egress: read EGRESS_CA_FILE: %w", err)
		}
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM(pem) {
			return nil, errors.New("egress: EGRESS_CA_FILE holds no PEM certificate")
		}
		tlsCfg.RootCAs = pool
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig = tlsCfg
	return &http.Client{
		Timeout:   Timeout,
		Transport: transport,
		// A bank answer is never followed somewhere else: a redirect could carry a token away.
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}, nil
}

// BaseURL is where the egress routes one provider: <egressURL>/<route>.
func BaseURL(egressURL, route string) (string, error) {
	if egressURL == "" {
		return "", ErrNotConfigured
	}
	return egressURL + "/" + route, nil
}
