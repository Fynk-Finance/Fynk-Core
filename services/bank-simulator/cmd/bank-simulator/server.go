package main

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"log/slog"
	"net/http"
)

func healthMux() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok","simulated":true}`))
	})
	return mux
}

// internalTLSConfig requires a client certificate signed by the CA in caPEM.
func internalTLSConfig(caPEM []byte) (*tls.Config, error) {
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(caPEM) {
		return nil, errors.New("BANK_CLIENT_CA holds no PEM certificate")
	}
	return &tls.Config{
		MinVersion: tls.VersionTLS12,
		ClientAuth: tls.RequireAndVerifyClientCert,
		ClientCAs:  pool,
	}, nil
}

// logClientCert logs the serial and subject of the verified client certificate.
// Only certificate metadata is logged: never headers, bodies or query strings.
func logClientCert(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.TLS != nil && len(r.TLS.PeerCertificates) > 0 {
			c := r.TLS.PeerCertificates[0]
			logger.Info("mtls client", "serial", c.SerialNumber.Text(16), "subject_cn", c.Subject.CommonName)
		}
		next.ServeHTTP(w, r)
	})
}
