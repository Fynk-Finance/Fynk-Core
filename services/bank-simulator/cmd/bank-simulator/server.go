package main

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/api"
	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/oauth"
	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/portal"
	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/store"
)

func newBankMux(s *store.BankStore) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok","simulated":true}`))
	})

	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/portal", http.StatusSeeOther)
	})

	handler := api.NewHandler(s)
	handler.RegisterRoutes(mux)

	oauthService := oauth.NewService(s)
	oauthService.RegisterRoutes(mux)
	portalHandler := portal.NewHandler(s)
	portalHandler.RegisterRoutes(mux)
	return mux
}

func healthMux() http.Handler {
	return newBankMux(store.NewBankStore(time.Time{}))
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
