package store

import (
	"bytes"
	"context"
	"sync"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/link"
)

// Memory is link.Store in memory, with the same rules as Postgres, for tests.
type Memory struct {
	mu    sync.Mutex
	links map[string]link.Link
}

var _ link.Store = (*Memory)(nil)

// NewMemory returns an empty store.
func NewMemory() *Memory { return &Memory{links: map[string]link.Link{}} }

// Insert implements link.Store.
func (m *Memory) Insert(_ context.Context, l link.Link) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, other := range m.links {
		if other.ConsentID == l.ConsentID {
			return link.ErrConsentLinked
		}
	}
	l.Status = link.StatusActive
	l.TokenFingerprint = bytes.Clone(l.TokenFingerprint)
	m.links[l.ID] = l
	return nil
}

// Get implements link.Store.
func (m *Memory) Get(_ context.Context, id string) (link.Link, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	l, ok := m.links[id]
	if !ok {
		return link.Link{}, link.ErrNotFound
	}
	return l, nil
}

// Rotate implements link.Store.
func (m *Memory) Rotate(_ context.Context, id string, old, next []byte, at time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	l, ok := m.links[id]
	if !ok || l.Status != link.StatusActive || !bytes.Equal(l.TokenFingerprint, old) {
		return link.ErrStale
	}
	l.TokenFingerprint = bytes.Clone(next)
	l.LastRefreshedAt = &at
	m.links[id] = l
	return nil
}

// Revoke implements link.Store.
func (m *Memory) Revoke(_ context.Context, id string, at time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	l, ok := m.links[id]
	if !ok || l.Status != link.StatusActive {
		return nil
	}
	l.Status = link.StatusRevoked
	l.RevokedAt = &at
	m.links[id] = l
	return nil
}
