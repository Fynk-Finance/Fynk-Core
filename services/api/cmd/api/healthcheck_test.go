package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthcheck(t *testing.T) {
	ok := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) }))
	defer ok.Close()
	down := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer down.Close()

	ctx := context.Background()
	if got := healthcheck(ctx, ok.Client(), ok.URL); got != 0 {
		t.Errorf("healthy server: exit %d, want 0", got)
	}
	if got := healthcheck(ctx, down.Client(), down.URL); got != 1 {
		t.Errorf("503 server: exit %d, want 1", got)
	}
	if got := healthcheck(ctx, http.DefaultClient, "http://127.0.0.1:1/healthz"); got != 1 {
		t.Errorf("no server: exit %d, want 1", got)
	}
}

func TestHealthURL(t *testing.T) {
	if got := healthURL(""); got != "http://127.0.0.1:8080/healthz" {
		t.Errorf("healthURL(\"\") = %q", got)
	}
	if got := healthURL("9090"); got != "http://127.0.0.1:9090/healthz" {
		t.Errorf("healthURL(9090) = %q", got)
	}
}
