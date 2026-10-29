package store

import (
	"context"
	"fmt"
	"sync"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

// Nonces remember the X-Request-Nonce of each phone request to /bank/* for a while, so a
// replayed request is refused (CLAUDE.md, Security rules: nonces in Redis, 5 minute TTL).
type Nonces interface {
	// FirstUse reports whether nonce is new for the user, and remembers it for ttl.
	FirstUse(ctx context.Context, userID, nonce string, ttl time.Duration) (bool, error)
}

// Limiter counts a user's bank queries in fixed windows.
type Limiter interface {
	// Allow counts one query. When the user is over limit in this window it answers false and
	// how long until the window ends.
	Allow(ctx context.Context, userID string, limit int, window time.Duration) (bool, time.Duration, error)
}

// RedisLimits implements Nonces and Limiter.
type RedisLimits struct {
	rdb *goredis.Client
}

// NewRedisLimits returns the Redis store.
func NewRedisLimits(rdb *goredis.Client) *RedisLimits { return &RedisLimits{rdb: rdb} }

// FirstUse implements Nonces with SET NX, so only one of two equal requests gets through.
func (r *RedisLimits) FirstUse(ctx context.Context, userID, nonce string, ttl time.Duration) (bool, error) {
	ok, err := r.rdb.SetNX(ctx, "bank:nonce:"+userID+":"+nonce, 1, ttl).Result()
	if err != nil {
		return false, fmt.Errorf("bank: nonce: %w", err)
	}
	return ok, nil
}

// Allow implements Limiter: INCR, and the window starts with the first query.
func (r *RedisLimits) Allow(ctx context.Context, userID string, limit int, window time.Duration) (bool, time.Duration, error) {
	key := "bank:rate:" + userID
	n, err := r.rdb.Incr(ctx, key).Result()
	if err != nil {
		return false, 0, fmt.Errorf("bank: rate limit: %w", err)
	}
	if n == 1 {
		if err := r.rdb.Expire(ctx, key, window).Err(); err != nil {
			return false, 0, fmt.Errorf("bank: rate limit: %w", err)
		}
	}
	if n <= int64(limit) {
		return true, 0, nil
	}
	ttl, err := r.rdb.TTL(ctx, key).Result()
	if err != nil {
		return false, 0, fmt.Errorf("bank: rate limit: %w", err)
	}
	if ttl <= 0 { // a key left without expiry would block the user forever
		_ = r.rdb.Expire(ctx, key, window).Err()
		ttl = window
	}
	return false, ttl, nil
}

// MemoryLimits is Nonces and Limiter in memory, with the same rules, for tests.
type MemoryLimits struct {
	mu     sync.Mutex
	clock  clock.Clock
	nonces map[string]time.Time
	counts map[string]window
}

type window struct {
	n    int
	ends time.Time
}

// NewMemoryLimits returns empty limits that use c for time.
func NewMemoryLimits(c clock.Clock) *MemoryLimits {
	return &MemoryLimits{clock: c, nonces: map[string]time.Time{}, counts: map[string]window{}}
}

// FirstUse implements Nonces.
func (m *MemoryLimits) FirstUse(_ context.Context, userID, nonce string, ttl time.Duration) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	key, now := userID+":"+nonce, m.clock.Now()
	if ends, ok := m.nonces[key]; ok && now.Before(ends) {
		return false, nil
	}
	m.nonces[key] = now.Add(ttl)
	return true, nil
}

// Allow implements Limiter.
func (m *MemoryLimits) Allow(_ context.Context, userID string, limit int, d time.Duration) (bool, time.Duration, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := m.clock.Now()
	w := m.counts[userID]
	if !now.Before(w.ends) {
		w = window{ends: now.Add(d)}
	}
	w.n++
	m.counts[userID] = w
	if w.n <= limit {
		return true, 0, nil
	}
	return false, w.ends.Sub(now), nil
}
