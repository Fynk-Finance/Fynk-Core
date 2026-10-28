package store

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/domain"
)

// Memory is an in-memory store with the same rules as Postgres, for tests.
type Memory struct {
	mu    sync.Mutex
	texts map[string]domain.Text
	last  string
	rows  map[string]domain.Consent
	keys  map[[2]string]string // (user, idempotency key) -> consent id
}

// NewMemory returns an empty store with texts published in order (the last is current).
func NewMemory(texts ...domain.Text) *Memory {
	m := &Memory{texts: map[string]domain.Text{}, rows: map[string]domain.Consent{}, keys: map[[2]string]string{}}
	for _, t := range texts {
		m.texts[t.Version] = t
		m.last = t.Version
	}
	return m
}

// CurrentText implements service.Store.
func (m *Memory) CurrentText(context.Context) (domain.Text, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.texts[m.last], nil
}

// TextByVersion implements service.Store.
func (m *Memory) TextByVersion(_ context.Context, v string) (domain.Text, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	t, ok := m.texts[v]
	if !ok {
		return domain.Text{}, domain.ErrUnknownTextVersion
	}
	return t, nil
}

// Insert implements service.Store.
func (m *Memory) Insert(_ context.Context, c domain.Consent, key string) (domain.Consent, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if key != "" {
		if id, ok := m.keys[[2]string{c.UserID, key}]; ok {
			return m.rows[id], false, nil
		}
		m.keys[[2]string{c.UserID, key}] = c.ID
	}
	m.rows[c.ID] = c
	return c, true, nil
}

// Get implements service.Store.
func (m *Memory) Get(_ context.Context, id string) (domain.Consent, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	c, ok := m.rows[id]
	if !ok {
		return domain.Consent{}, domain.ErrNotFound
	}
	return c, nil
}

// ListByUser implements service.Store.
func (m *Memory) ListByUser(_ context.Context, userID string) ([]domain.Consent, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []domain.Consent
	for _, c := range m.rows {
		if c.UserID == userID {
			out = append(out, c)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out, nil
}

// Activate implements service.Store.
func (m *Memory) Activate(_ context.Context, c domain.Consent) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.rows[c.ID].Status != domain.StatusPending {
		return domain.ErrNotPending
	}
	m.rows[c.ID] = c
	return nil
}

// ExpireDue implements service.Store.
func (m *Memory) ExpireDue(_ context.Context, now time.Time) ([]domain.Consent, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []domain.Consent
	for id, c := range m.rows {
		if c.Status == domain.StatusActive && !now.Before(*c.ExpiresAt) {
			c.Status = domain.StatusExpired
			m.rows[id] = c
			out = append(out, c)
		}
	}
	return out, nil
}

// MarkRevoked implements service.Store.
func (m *Memory) MarkRevoked(_ context.Context, c domain.Consent) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if st := m.rows[c.ID].Status; st != domain.StatusActive && st != domain.StatusPending {
		return domain.ErrNotRevocable
	}
	m.rows[c.ID] = c
	return nil
}

// SaveNotice implements service.Store.
func (m *Memory) SaveNotice(_ context.Context, c domain.Consent) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	row := m.rows[c.ID]
	row.ProviderNotifiedAt, row.NextNotifyAt, row.NotifyAttempts = c.ProviderNotifiedAt, c.NextNotifyAt, c.NotifyAttempts
	m.rows[c.ID] = row
	return nil
}

// ClaimNotices implements service.Store.
func (m *Memory) ClaimNotices(_ context.Context, now, lease time.Time, limit int) ([]domain.Consent, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []domain.Consent
	for id, c := range m.rows {
		if len(out) == limit {
			break
		}
		if c.Status == domain.StatusRevoked && c.ProviderNotifiedAt == nil && c.NextNotifyAt != nil &&
			!c.NextNotifyAt.After(now) && now.Before(c.RevokedAt.Add(domain.NotifyFor)) {
			l := lease
			c.NextNotifyAt = &l
			m.rows[id] = c
			out = append(out, c)
		}
	}
	return out, nil
}

// Edit changes a stored row directly, to build states the API cannot produce.
func (m *Memory) Edit(id string, fn func(*domain.Consent)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	c := m.rows[id]
	fn(&c)
	m.rows[id] = c
}

// Len is the number of stored consents.
func (m *Memory) Len() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.rows)
}
