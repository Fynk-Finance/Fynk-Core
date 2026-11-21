package market

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net/http"
	"os"
	"time"
)

// egressClient is the HTTP client for calls through the Caddy egress (M14), which adds Fynk's
// mTLS certificate. It trusts the system roots plus the CA of the egress's own certificate
// (config.EgressCAFile), so the hop to the egress is TLS too.
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
	return &http.Client{Timeout: 10 * time.Second, Transport: tr}, nil
}

// egressPath is <EgressURL>/<provider>, or "" when there is no egress (calls then fail closed).
func egressPath(egressURL, provider string) string {
	if egressURL == "" {
		return ""
	}
	return egressURL + "/" + provider
}
