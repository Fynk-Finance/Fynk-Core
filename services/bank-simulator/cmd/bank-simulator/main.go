// Command bank-simulator is a PLACEHOLDER added by M0 so the local stack runs end to end.
// M16 (Banco Demo) owns this folder and replaces it with the real simulator
// (docs/modules/M16-banco-demo.md): portal, OAuth proxies and the Open Finance API.
//
// It has the two listeners of the target design:
//   - public :8443, plain HTTP locally (the ALB terminates TLS in AWS), /healthz;
//   - internal :9443, mTLS that only accepts client certificates signed by BANK_CLIENT_CA,
//     /healthz, and logs the client certificate serial of every request (HU-031 evidence).
//
// "bank-simulator healthcheck" checks the public listener (Docker HEALTHCHECK).
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	cfg := loadConfig(os.Getenv)
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		os.Exit(healthcheck("http://127.0.0.1" + cfg.PublicAddr + "/healthz"))
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := run(ctx, cfg, logger); err != nil {
		logger.Error("bank simulator stopped", "error", err)
		os.Exit(1)
	}
}

type config struct {
	PublicAddr   string
	InternalAddr string
	CertFile     string // server certificate of the internal listener
	KeyFile      string
	ClientCAFile string // CA that signs the accepted client certificates
}

func loadConfig(getenv func(string) string) config {
	or := func(k, def string) string {
		if v := getenv(k); v != "" {
			return v
		}
		return def
	}
	return config{
		PublicAddr:   or("BANK_PUBLIC_ADDR", ":8443"),
		InternalAddr: or("BANK_INTERNAL_ADDR", ":9443"),
		CertFile:     getenv("BANK_TLS_CERT"),
		KeyFile:      getenv("BANK_TLS_KEY"),
		ClientCAFile: getenv("BANK_CLIENT_CA"),
	}
}

func run(ctx context.Context, cfg config, logger *slog.Logger) error {
	if cfg.CertFile == "" || cfg.KeyFile == "" || cfg.ClientCAFile == "" {
		return errors.New("BANK_TLS_CERT, BANK_TLS_KEY and BANK_CLIENT_CA are required (run make certs)")
	}
	caPEM, err := os.ReadFile(cfg.ClientCAFile)
	if err != nil {
		return err
	}
	tlsCfg, err := internalTLSConfig(caPEM)
	if err != nil {
		return err
	}
	public := &http.Server{Addr: cfg.PublicAddr, Handler: healthMux(), ReadHeaderTimeout: 5 * time.Second}
	internal := &http.Server{
		Addr:              cfg.InternalAddr,
		Handler:           logClientCert(logger, healthMux()),
		TLSConfig:         tlsCfg,
		ReadHeaderTimeout: 5 * time.Second,
	}

	errs := make(chan error, 2)
	go func() { errs <- public.ListenAndServe() }()
	go func() { errs <- internal.ListenAndServeTLS(cfg.CertFile, cfg.KeyFile) }()
	logger.Info("bank simulator placeholder listening", "public", cfg.PublicAddr, "internal_mtls", cfg.InternalAddr)

	select {
	case err := <-errs:
		return err
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return errors.Join(public.Shutdown(shutdown), internal.Shutdown(shutdown))
	}
}

func healthcheck(url string) int {
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return 1
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}
