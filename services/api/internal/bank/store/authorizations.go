package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/link"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

// Authorizations keep a started link for 10 minutes, in Redis ("Nonces, refresh rate limits,
// caches" in CLAUDE.md, Where data lives). It holds ids only: no code, verifier or token.
type Authorizations interface {
	// Save keeps a until ttl passes.
	Save(ctx context.Context, a link.Authorization, ttl time.Duration) error
	// Take returns a and forgets it, so an authorization works once. ErrAuthorizationNotFound
	// when it is unknown, already used or expired.
	Take(ctx context.Context, id string) (link.Authorization, error)
}

const authorizationPrefix = "bank:authorization:"

// RedisAuthorizations implements Authorizations.
type RedisAuthorizations struct {
	rdb *goredis.Client
}

// NewRedisAuthorizations returns the Redis store.
func NewRedisAuthorizations(rdb *goredis.Client) *RedisAuthorizations {
	return &RedisAuthorizations{rdb: rdb}
}

// Save implements Authorizations.
func (r *RedisAuthorizations) Save(ctx context.Context, a link.Authorization, ttl time.Duration) error {
	raw, err := json.Marshal(a)
	if err != nil {
		return err
	}
	ok, err := r.rdb.SetNX(ctx, authorizationPrefix+a.ID, raw, ttl).Result()
	if err != nil {
		return fmt.Errorf("bank: save authorization: %w", err)
	}
	if !ok {
		return errors.New("bank: authorization id already used")
	}
	return nil
}

// Take implements Authorizations with GETDEL, so two exchanges can never both get it.
func (r *RedisAuthorizations) Take(ctx context.Context, id string) (link.Authorization, error) {
	raw, err := r.rdb.GetDel(ctx, authorizationPrefix+id).Bytes()
	if errors.Is(err, goredis.Nil) {
		return link.Authorization{}, link.ErrAuthorizationNotFound
	}
	if err != nil {
		return link.Authorization{}, fmt.Errorf("bank: take authorization: %w", err)
	}
	var a link.Authorization
	if err := json.Unmarshal(raw, &a); err != nil {
		return link.Authorization{}, fmt.Errorf("bank: read authorization: %w", err)
	}
	return a, nil
}

// MemoryAuthorizations is Authorizations in memory, with the same rules, for tests.
type MemoryAuthorizations struct {
	mu    sync.Mutex
	clock clock.Clock
	items map[string]memoryAuthorization
}

type memoryAuthorization struct {
	a       link.Authorization
	expires time.Time
}

// NewMemoryAuthorizations returns an empty store that expires items with c.
func NewMemoryAuthorizations(c clock.Clock) *MemoryAuthorizations {
	return &MemoryAuthorizations{clock: c, items: map[string]memoryAuthorization{}}
}

// Save implements Authorizations.
func (m *MemoryAuthorizations) Save(_ context.Context, a link.Authorization, ttl time.Duration) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.items[a.ID]; ok {
		return errors.New("bank: authorization id already used")
	}
	m.items[a.ID] = memoryAuthorization{a: a, expires: m.clock.Now().Add(ttl)}
	return nil
}

// Take implements Authorizations.
func (m *MemoryAuthorizations) Take(_ context.Context, id string) (link.Authorization, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	it, ok := m.items[id]
	delete(m.items, id)
	if !ok || !m.clock.Now().Before(it.expires) {
		return link.Authorization{}, link.ErrAuthorizationNotFound
	}
	return it.a, nil
}
