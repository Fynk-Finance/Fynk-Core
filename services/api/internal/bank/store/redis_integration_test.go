//go:build integration

// Runs against a real Redis: REDIS_URL=redis://... go test -tags integration ./internal/bank/store/
package store

import (
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/redis"
)

func TestRedisAuthorizations(t *testing.T) {
	url := os.Getenv("REDIS_URL")
	if url == "" {
		t.Skip("REDIS_URL is not set")
	}
	rdb, err := redis.Open(url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = rdb.Close() })
	id := fmt.Sprintf("it-%d", time.Now().UnixNano())
	testAuthorizations(t, NewRedisAuthorizations(rdb), id, func() { time.Sleep(1100 * time.Millisecond) })
}
