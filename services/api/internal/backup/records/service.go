package records

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	identity "github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

// Service holds the record rules. It never logs or audits ciphertext, ids or collections.
type Service struct {
	repo    Repo
	devices identity.Devices
	clock   clock.Clock
	audit   audit.Recorder
}

// NewService returns a service.
func NewService(repo Repo, devices identity.Devices, clk clock.Clock, rec audit.Recorder) *Service {
	return &Service{repo: repo, devices: devices, clock: clk, audit: rec}
}

// active allows only the caller's own device in status active; anything else is ErrNotActive.
func (s *Service) active(ctx context.Context, user auth.User) error {
	if user.DeviceID == "" {
		return ErrNotActive
	}
	d, err := s.devices.Get(ctx, user.ID, user.DeviceID)
	switch {
	case errors.Is(err, identity.ErrRemoved), errors.Is(err, identity.ErrNotFound):
		return ErrNotActive
	case err != nil:
		return err
	case d.Status != "active":
		return ErrNotActive
	}
	return nil
}

// Put stores the already validated batch atomically. A stored version greater than an
// incoming one (ErrStale) or a total above the quota (ErrQuota) stores nothing.
func (s *Service) Put(ctx context.Context, user auth.User, batch []Envelope) (int, error) {
	if err := s.active(ctx, user); err != nil {
		return 0, err
	}
	now := s.clock.Now()
	err := s.repo.InTx(ctx, user.ID, func(tx Tx) error {
		for _, e := range batch {
			ok, err := tx.Upsert(ctx, user.ID, e, now)
			if err != nil {
				return err
			}
			if !ok {
				return ErrStale
			}
		}
		used, err := tx.Usage(ctx, user.ID)
		if err != nil {
			return err
		}
		if used > QuotaBytes {
			return ErrQuota
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	err = s.audit.Record(ctx, audit.Event{Type: audit.BackupUploaded, UserID: user.ID, DeviceID: user.DeviceID,
		At: now, Meta: map[string]string{"count": strconv.Itoa(len(batch))}})
	if err != nil {
		return 0, fmt.Errorf("audit %s: %w", audit.BackupUploaded, err)
	}
	return len(batch), nil
}

// List returns up to limit records after the cursor and the cursor of the next page ("" on
// the last one). The caller has checked limit.
func (s *Service) List(ctx context.Context, user auth.User, cursor string, limit int) (Page, error) {
	after, err := DecodeCursor(cursor)
	if err != nil {
		return Page{}, err
	}
	if err := s.active(ctx, user); err != nil {
		return Page{}, err
	}
	rs, err := s.repo.After(ctx, user.ID, after, limit)
	if err != nil {
		return Page{}, err
	}
	p := Page{Records: rs}
	if len(rs) == limit {
		p.Next = EncodeCursor(rs[len(rs)-1].Seq)
	}
	return p, nil
}
