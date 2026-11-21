// Package redis opens the Redis client used for nonces, rate limits and caches.
package redis

import (
	"context"
	"errors"

	goredis "github.com/redis/go-redis/v9"
)

// Open parses url and returns a client. It does not connect until first use.
func Open(url string) (*goredis.Client, error) {
	opts, err := goredis.ParseURL(url)
	if err != nil {
		// The parse error can echo the URL, which may hold a password: keep it out.
		return nil, errors.New("redis: invalid REDIS_URL")
	}
	return goredis.NewClient(opts), nil
}

// Pinger adapts a client to the Ping(ctx) error shape used by /readyz.
type Pinger struct {
	Client *goredis.Client
}

// Ping implements the readiness check.
func (p Pinger) Ping(ctx context.Context) error {
	return p.Client.Ping(ctx).Err()
}
