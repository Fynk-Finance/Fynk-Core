package approvals

import (
	"context"
	"errors"
	"fmt"
	"time"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	identity "github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

// Service holds the approval rules. Keys, ids and device names never reach a log, an audit
// event or an error.
type Service struct {
	repo    Repo
	devices identity.Devices
	act     identity.Activator
	clock   clock.Clock
	audit   audit.Recorder
	newID   func() string
}

// NewService returns a service. newID makes the id of a new request (a UUID string).
func NewService(repo Repo, devices identity.Devices, act identity.Activator, clk clock.Clock, rec audit.Recorder, newID func() string) *Service {
	return &Service{repo: repo, devices: devices, act: act, clock: clk, audit: rec, newID: newID}
}

// device returns the caller's own device. A missing, foreign, removed or unidentified one is
// ErrNotActive.
func (s *Service) device(ctx context.Context, user auth.User) (identity.DeviceInfo, error) {
	if user.DeviceID == "" {
		return identity.DeviceInfo{}, ErrNotActive
	}
	d, err := s.devices.Get(ctx, user.ID, user.DeviceID)
	switch {
	case errors.Is(err, identity.ErrRemoved), errors.Is(err, identity.ErrNotFound):
		return identity.DeviceInfo{}, ErrNotActive
	case err != nil:
		return identity.DeviceInfo{}, err
	}
	return d, nil
}

func (s *Service) activeDevice(ctx context.Context, user auth.User) error {
	d, err := s.device(ctx, user)
	if err != nil {
		return err
	}
	if d.Status != "active" {
		return ErrNotActive
	}
	return nil
}

// Create opens a request for the calling pending device, with its public key from identity.
// It expires the device's older open requests. The same non-empty key from the same device
// returns the first request.
func (s *Service) Create(ctx context.Context, user auth.User, key string) (Approval, error) {
	d, err := s.device(ctx, user)
	if err != nil {
		return Approval{}, err
	}
	switch d.Status {
	case "active":
		return Approval{}, ErrAlreadyActive
	case "pending":
	default:
		return Approval{}, ErrNotActive
	}
	now := s.clock.Now()
	var out Approval
	err = s.repo.InTx(ctx, user.ID, func(tx Tx) error {
		if key != "" {
			first, ok, err := tx.ByKey(ctx, user.DeviceID, key)
			if err != nil {
				return err
			}
			if ok {
				out = first
				return nil
			}
		}
		if err := tx.ExpirePending(ctx, user.DeviceID, now); err != nil {
			return err
		}
		out = Approval{ID: s.newID(), UserID: user.ID, NewDeviceID: user.DeviceID,
			NewDevicePublicKey: d.PublicKey, Status: Pending, CreatedAt: now, ExpiresAt: now.Add(TTL)}
		return tx.Insert(ctx, out, key)
	})
	if err != nil {
		return Approval{}, err
	}
	out.NewDevicePublicKey = nil
	return out, nil
}

// Pending lists the open requests of the user for an active device, newest first. A request
// whose new device is gone or no longer pending is skipped.
func (s *Service) Pending(ctx context.Context, user auth.User) ([]Open, error) {
	if err := s.activeDevice(ctx, user); err != nil {
		return nil, err
	}
	as, err := s.repo.Open(ctx, user.ID, s.clock.Now())
	if err != nil {
		return nil, err
	}
	out := make([]Open, 0, len(as))
	for _, a := range as {
		d, err := s.devices.Get(ctx, user.ID, a.NewDeviceID)
		switch {
		case errors.Is(err, identity.ErrRemoved), errors.Is(err, identity.ErrNotFound):
			continue
		case err != nil:
			return nil, err
		case d.Status != "pending":
			continue
		}
		out = append(out, Open{Approval: a, DeviceName: d.Name, Platform: d.Platform})
	}
	return out, nil
}

// Get returns the request to the new device that created it; anything else is ErrNotFound. A
// pending request past its expiry is reported (and stored) as expired. The grant is returned
// once: the same transaction clears it and audits the read.
func (s *Service) Get(ctx context.Context, user auth.User, id string) (View, error) {
	if _, err := s.device(ctx, user); err != nil {
		return View{}, ErrNotFound
	}
	now := s.clock.Now()
	var out View
	err := s.repo.InTx(ctx, user.ID, func(tx Tx) error {
		a, err := tx.Lock(ctx, id)
		if err != nil {
			return err
		}
		if a.UserID != user.ID || a.NewDeviceID != user.DeviceID {
			return ErrNotFound
		}
		if a.Status == Pending && !now.Before(a.ExpiresAt) {
			if err := tx.Decide(ctx, id, Expired, now); err != nil {
				return err
			}
			a.Status = Expired
		}
		g := a.Grant
		a.Grant, a.NewDevicePublicKey = Grant{}, nil
		out = View{Approval: a}
		if a.Status != Approved || len(g.WrappedDEK) == 0 {
			return nil
		}
		if err := tx.ClearGrant(ctx, id); err != nil {
			return err
		}
		if err := s.record(ctx, audit.BackupRestored, user, user.DeviceID, now, nil); err != nil {
			return err
		}
		out.Keys = &g
		return nil
	})
	if err != nil {
		return View{}, err
	}
	return out, nil
}

// Approve stores the grant of an open request, activates the new device and audits it. The
// caller has checked the sizes of the grant.
func (s *Service) Approve(ctx context.Context, user auth.User, id string, g Grant) (Approval, error) {
	return s.decide(ctx, user, id, &g)
}

// Reject refuses an open request. The new device stays pending.
func (s *Service) Reject(ctx context.Context, user auth.User, id string) (Approval, error) {
	return s.decide(ctx, user, id, nil)
}

// decide approves (g set) or rejects an open request for an active device.
func (s *Service) decide(ctx context.Context, user auth.User, id string, g *Grant) (Approval, error) {
	if err := s.activeDevice(ctx, user); err != nil {
		return Approval{}, err
	}
	now := s.clock.Now()
	var out Approval
	// An expired request is stored as expired. The transaction must commit that, so it reports
	// ErrExpired through this flag: an error from fn would roll the status back.
	var expired bool
	err := s.repo.InTx(ctx, user.ID, func(tx Tx) error {
		a, err := tx.Lock(ctx, id)
		if err != nil {
			return err
		}
		if a.UserID != user.ID {
			return ErrNotFound
		}
		switch {
		case a.Status == Expired:
			expired = true
			return nil
		case a.Status != Pending:
			return ErrNotPending
		case !now.Before(a.ExpiresAt):
			expired = true
			return tx.Decide(ctx, id, Expired, now)
		}
		d, err := s.devices.Get(ctx, user.ID, a.NewDeviceID)
		switch {
		case errors.Is(err, identity.ErrRemoved), errors.Is(err, identity.ErrNotFound):
			return ErrNotPending
		case err != nil:
			return err
		case d.Status != "pending":
			return ErrNotPending
		}
		if g == nil {
			if err := tx.Decide(ctx, id, Rejected, now); err != nil {
				return err
			}
			a.Status = Rejected
		} else {
			if err := tx.Approve(ctx, id, *g, now); err != nil {
				return err
			}
			a.Status = Approved
			// Before the commit: if the activation fails the request stays pending.
			if err := s.act.ActivateDevice(ctx, a.NewDeviceID); err != nil {
				if errors.Is(err, identity.ErrRemoved) || errors.Is(err, identity.ErrNotFound) {
					return ErrNotPending
				}
				return err
			}
		}
		a.Grant, a.NewDevicePublicKey = Grant{}, nil
		out = a
		return nil
	})
	if err != nil {
		return Approval{}, err
	}
	if expired {
		return Approval{}, ErrExpired
	}
	typ, key := audit.DeviceRejected, "rejectedBy"
	if g != nil {
		typ, key = audit.DeviceApproved, "approvedBy"
	}
	if err := s.record(ctx, typ, user, out.NewDeviceID, now, map[string]string{key: user.DeviceID}); err != nil {
		return Approval{}, err
	}
	return out, nil
}

// record audits an event of the approval flow. extra never holds key material.
func (s *Service) record(ctx context.Context, typ string, user auth.User, deviceID string, at time.Time, extra map[string]string) error {
	meta := map[string]string{"method": "device_approval"}
	for k, v := range extra {
		meta[k] = v
	}
	err := s.audit.Record(ctx, audit.Event{Type: typ, UserID: user.ID, DeviceID: deviceID, At: at, Meta: meta})
	if err != nil {
		return fmt.Errorf("audit %s: %w", typ, err)
	}
	return nil
}
