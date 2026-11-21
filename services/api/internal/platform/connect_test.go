package platform_test

import (
	"context"
	"strings"
	"testing"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/db"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/redis"
)

func TestOpenDoesNotLeakTheURLOnError(t *testing.T) {
	secret := "s3cr3t-pass"
	if _, err := db.Open(context.Background(), "postgres://u:"+secret+"@host:notaport/db"); err == nil ||
		strings.Contains(err.Error(), secret) {
		t.Fatalf("db.Open err = %v", err)
	}
	if _, err := redis.Open("nope://:" + secret + "@host"); err == nil || strings.Contains(err.Error(), secret) {
		t.Fatalf("redis.Open err = %v", err)
	}
}

func TestOpenIsLazy(t *testing.T) {
	pool, err := db.Open(context.Background(), "postgres://u:p@127.0.0.1:1/db")
	if err != nil {
		t.Fatalf("db.Open: %v", err)
	}
	pool.Close()
	client, err := redis.Open("redis://127.0.0.1:1/0")
	if err != nil {
		t.Fatalf("redis.Open: %v", err)
	}
	_ = client.Close()
}
