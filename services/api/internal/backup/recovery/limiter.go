package recovery

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

const window = time.Hour

// RedisLimiter counts failures in Redis: the first failure sets a one hour expiry, so the
// window is fixed from the first failure and the counter then disappears. The key holds
// only the user id; it carries no proof or hash.
type RedisLimiter struct{ Client *redis.Client }

func failKey(userID string) string { return "backup:activate-fail:" + userID }

// Blocked implements Limiter.
func (l RedisLimiter) Blocked(ctx context.Context, userID string) (bool, error) {
	n, err := l.Client.Get(ctx, failKey(userID)).Int()
	if errors.Is(err, redis.Nil) {
		return false, nil
	}
	return n >= MaxFailures, err
}

// Fail implements Limiter.
func (l RedisLimiter) Fail(ctx context.Context, userID string) error {
	n, err := l.Client.Incr(ctx, failKey(userID)).Result()
	if err != nil {
		return err
	}
	if n == 1 {
		return l.Client.Expire(ctx, failKey(userID), window).Err()
	}
	return nil
}

// MemoryLimiter is a rolling one hour limiter inside the process. The API uses it when
// there is no Redis (tests, local runs): the limit still holds for one instance, but it
// is lost on restart and not shared between instances, so production must run with Redis.
type MemoryLimiter struct {
	clock clock.Clock
	mu    sync.Mutex
	fails map[string][]time.Time
}

// NewMemoryLimiter returns an in-process limiter.
func NewMemoryLimiter(clk clock.Clock) *MemoryLimiter {
	return &MemoryLimiter{clock: clk, fails: map[string][]time.Time{}}
}

func (l *MemoryLimiter) recent(userID string) []time.Time {
	cut := l.clock.Now().Add(-window)
	var out []time.Time
	for _, t := range l.fails[userID] {
		if t.After(cut) {
			out = append(out, t)
		}
	}
	l.fails[userID] = out
	return out
}

// Blocked implements Limiter.
func (l *MemoryLimiter) Blocked(_ context.Context, userID string) (bool, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.recent(userID)) >= MaxFailures, nil
}

// Fail implements Limiter.
func (l *MemoryLimiter) Fail(_ context.Context, userID string) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.fails[userID] = append(l.recent(userID), l.clock.Now())
	return nil
}
