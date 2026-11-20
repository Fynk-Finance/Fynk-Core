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
	"crypto/tls"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/authorize"
	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/store"
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
	CertPEM      string // inline PEM alternative to CertFile (ECS secrets)
	KeyPEM       string
	ClientCAPEM  string

	// ProvisionClientID is Fynk's client id at the bank. Only this client may
	// get the demo:provision scope.
	ProvisionClientID string

	// Login of the authorization page, through the banco-demo realm. With no
	// issuer or no secret the page answers 503.
	PublicURL        string // BANK_PUBLIC_URL, where the browser reaches this listener
	OIDCIssuer       string // BANK_OIDC_ISSUER, public realm URL
	OIDCBackchannel  string // BANK_OIDC_BACKCHANNEL_URL, realm URL for token and keys
	OIDCClientID     string // BANK_OIDC_CLIENT_ID
	OIDCClientSecret string // BANK_OIDC_CLIENT_SECRET, never logged
}

func (c config) authorize(logger *slog.Logger) authorize.Config {
	return authorize.Config{
		PublicURL: c.PublicURL, Issuer: c.OIDCIssuer, BackchannelURL: c.OIDCBackchannel,
		ClientID: c.OIDCClientID, ClientSecret: c.OIDCClientSecret, Logger: logger,
	}
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
		CertPEM:      getenv("BANK_TLS_CERT_PEM"),
		KeyPEM:       getenv("BANK_TLS_KEY_PEM"),
		ClientCAPEM:  getenv("BANK_CLIENT_CA_PEM"),

		ProvisionClientID: or("BANK_PROVISION_CLIENT_ID", defaultProvisionClientID),

		PublicURL:        or("BANK_PUBLIC_URL", "http://localhost:8082"),
		OIDCIssuer:       getenv("BANK_OIDC_ISSUER"),
		OIDCBackchannel:  getenv("BANK_OIDC_BACKCHANNEL_URL"),
		OIDCClientID:     or("BANK_OIDC_CLIENT_ID", "bank-portal"),
		OIDCClientSecret: getenv("BANK_OIDC_CLIENT_SECRET"),
	}
}

// pemToFile writes a PEM given as text (an ECS secret) to a private temporary
// file and returns its path. The simulator keeps working with file paths.
func pemToFile(name, pem string) (string, error) {
	f, err := os.CreateTemp("", "bank-"+name+"-*.pem")
	if err != nil {
		return "", fmt.Errorf("%s: %w", name, err)
	}
	path := f.Name()
	if err := f.Chmod(0o600); err != nil {
		_ = f.Close()
		_ = os.Remove(path)
		return "", fmt.Errorf("%s: %w", name, err)
	}
	if _, err := f.WriteString(pem); err != nil {
		_ = f.Close()
		_ = os.Remove(path)
		return "", fmt.Errorf("%s: %w", name, err)
	}
	if err := f.Close(); err != nil {
		_ = os.Remove(path)
		return "", fmt.Errorf("%s: %w", name, err)
	}
	return path, nil
}

// resolveTLSFiles materializes any *_PEM fields into private temporary files
// so ListenAndServeTLS and os.ReadFile work identically in ECS and locally.
func resolveTLSFiles(cfg *config) (func(), error) {
	var tempPaths []string
	cleanup := func() {
		for _, p := range tempPaths {
			_ = os.Remove(p)
		}
	}

	pairs := []struct {
		envName string
		path    *string
		pem     string
	}{
		{"BANK_TLS_CERT", &cfg.CertFile, cfg.CertPEM},
		{"BANK_TLS_KEY", &cfg.KeyFile, cfg.KeyPEM},
		{"BANK_CLIENT_CA", &cfg.ClientCAFile, cfg.ClientCAPEM},
	}

	for _, p := range pairs {
		if *p.path != "" && p.pem != "" {
			cleanup()
			return func() {}, fmt.Errorf("set %s or %s_PEM, not both", p.envName, p.envName)
		}
		if *p.path == "" && p.pem != "" {
			written, err := pemToFile(p.envName, p.pem)
			if err != nil {
				cleanup()
				return func() {}, err
			}
			tempPaths = append(tempPaths, written)
			*p.path = written
		}
	}
	return cleanup, nil
}

func run(ctx context.Context, cfg config, logger *slog.Logger) error {
	cleanupTLS, err := resolveTLSFiles(&cfg)
	if err != nil {
		return err
	}
	defer cleanupTLS()

	var tlsCfg *tls.Config
	if cfg.CertFile == "" || cfg.KeyFile == "" || cfg.ClientCAFile == "" {
		if os.Getenv("BANK_DEV_MODE") != "1" {
			return errors.New("BANK_TLS_CERT, BANK_TLS_KEY and BANK_CLIENT_CA are required (run make certs)")
		}
		logger.Warn("BANK_DEV_MODE=1 enabled; mTLS certificates not configured, internal listener disabled")
	} else {
		caPEM, err := os.ReadFile(cfg.ClientCAFile)
		if err != nil {
			return err
		}
		var errTLS error
		tlsCfg, errTLS = internalTLSConfig(caPEM)
		if errTLS != nil {
			return errTLS
		}
	}

	bankStore := store.NewBankStore(time.Time{})
	bankMux := newBankMux(bankStore, cfg.ProvisionClientID, cfg.authorize(logger))

	public := &http.Server{Addr: cfg.PublicAddr, Handler: bankMux, ReadHeaderTimeout: 5 * time.Second}
	errs := make(chan error, 2)
	go func() { errs <- public.ListenAndServe() }()

	var internal *http.Server
	if tlsCfg != nil {
		internal = &http.Server{
			Addr:              cfg.InternalAddr,
			Handler:           logClientCert(logger, bankMux),
			TLSConfig:         tlsCfg,
			ReadHeaderTimeout: 5 * time.Second,
		}
		go func() { errs <- internal.ListenAndServeTLS(cfg.CertFile, cfg.KeyFile) }()
		logger.Info("bank simulator listening", "public", cfg.PublicAddr, "internal_mtls", cfg.InternalAddr)
	} else {
		logger.Info("bank simulator listening in dev mode", "public", cfg.PublicAddr, "internal_mtls", "disabled")
	}

	select {
	case err := <-errs:
		return err
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if internal != nil {
			return errors.Join(public.Shutdown(shutdown), internal.Shutdown(shutdown))
		}
		return public.Shutdown(shutdown)
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
