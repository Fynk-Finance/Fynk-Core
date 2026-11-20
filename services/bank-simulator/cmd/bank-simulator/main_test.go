package main

import (
	"context"
	"io"
	"log/slog"
	"os"
	"strings"
	"testing"
	"time"
)

func TestResolveTLSFilesFromPEM(t *testing.T) {
	cfg := config{
		CertPEM:     "cert-pem-body",
		KeyPEM:      "key-pem-body",
		ClientCAPEM: "ca-pem-body",
	}

	cleanup, err := resolveTLSFiles(&cfg)
	if err != nil {
		t.Fatalf("resolveTLSFiles failed: %v", err)
	}
	defer cleanup()

	checks := []struct {
		name string
		path string
		want string
	}{
		{"cert", cfg.CertFile, "cert-pem-body"},
		{"key", cfg.KeyFile, "key-pem-body"},
		{"ca", cfg.ClientCAFile, "ca-pem-body"},
	}

	for _, tc := range checks {
		info, err := os.Stat(tc.path)
		if err != nil {
			t.Fatalf("%s stat %q: %v", tc.name, tc.path, err)
		}
		if mode := info.Mode().Perm(); mode != 0o600 {
			t.Fatalf("%s mode = %o, want 0600", tc.name, mode)
		}
		got, err := os.ReadFile(tc.path)
		if err != nil {
			t.Fatalf("%s read %q: %v", tc.name, tc.path, err)
		}
		if string(got) != tc.want {
			t.Fatalf("%s content = %q, want %q", tc.name, string(got), tc.want)
		}
	}

	cleanup()
	for _, tc := range checks {
		if _, err := os.Stat(tc.path); !os.IsNotExist(err) {
			t.Fatalf("%s temp file %q still exists after cleanup", tc.name, tc.path)
		}
	}
}

func TestResolveTLSFilesRejectsBothPathAndPEM(t *testing.T) {
	cases := []struct {
		name string
		cfg  config
		want string
	}{
		{
			name: "cert",
			cfg:  config{CertFile: "/tmp/c.pem", CertPEM: "pem"},
			want: "BANK_TLS_CERT",
		},
		{
			name: "key",
			cfg:  config{KeyFile: "/tmp/k.pem", KeyPEM: "pem"},
			want: "BANK_TLS_KEY",
		},
		{
			name: "client_ca",
			cfg:  config{ClientCAFile: "/tmp/ca.pem", ClientCAPEM: "pem"},
			want: "BANK_CLIENT_CA",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := tc.cfg
			cleanup, err := resolveTLSFiles(&cfg)
			defer cleanup()
			if err == nil {
				t.Fatal("expected error when both path and PEM are set, got nil")
			}
			if !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("error %q does not mention %s", err.Error(), tc.want)
			}
		})
	}
}

func TestRunDevModeWithoutTLS(t *testing.T) {
	t.Setenv("BANK_DEV_MODE", "1")
	cfg := config{
		PublicAddr:   "127.0.0.1:0",
		InternalAddr: "127.0.0.1:0",
	}

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	if err := run(ctx, cfg, logger); err != nil {
		t.Fatalf("run in dev mode failed: %v", err)
	}
}

func TestRunInvalidClientCAPEM(t *testing.T) {
	cfg := config{
		PublicAddr:   "127.0.0.1:0",
		InternalAddr: "127.0.0.1:0",
		CertPEM:      "dummy-cert",
		KeyPEM:       "dummy-key",
		ClientCAPEM:  "not-a-valid-pem-certificate",
	}

	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	err := run(context.Background(), cfg, logger)
	if err == nil {
		t.Fatal("expected startup error for invalid ClientCAPEM, got nil")
	}
	if !strings.Contains(err.Error(), "BANK_CLIENT_CA") {
		t.Fatalf("unexpected error: %v", err)
	}
}
