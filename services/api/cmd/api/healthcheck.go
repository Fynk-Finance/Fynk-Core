package main

import (
	"context"
	"net/http"
	"time"
)

// healthcheck backs "api healthcheck", the Docker HEALTHCHECK of the distroless image,
// which has no curl or shell. It returns the process exit code: 0 when /healthz answers 200.
func healthcheck(ctx context.Context, client *http.Client, url string) int {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 1
	}
	resp, err := client.Do(req)
	if err != nil {
		return 1
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}

// healthURL is the local /healthz address for the PORT setting (8080 when empty).
func healthURL(port string) string {
	if port == "" {
		port = "8080"
	}
	return "http://127.0.0.1:" + port + "/healthz"
}
