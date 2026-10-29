package devices

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

// Reader reads devices.
type Reader interface {
	// Get returns ErrNotFound when the device does not exist or belongs to another user.
	Get(ctx context.Context, userID, id string) (Device, error)
	// List returns the user's devices that are not removed, newest last_seen_at first.
	List(ctx context.Context, userID string) ([]Device, error)
}

// Tx is a repository transaction. Its reads lock the rows they return.
type Tx interface {
	Reader
	ByIdempotencyKey(ctx context.Context, userID, key string) (Device, bool, error)
	ByPublicKey(ctx context.Context, userID string, key []byte) (Device, bool, error)
	HasActive(ctx context.Context, userID string) (bool, error)
	// Insert returns ErrDuplicate when a unique constraint is hit. A blank key stores no key.
	Insert(ctx context.Context, d Device, idempotencyKey string) error
	Update(ctx context.Context, d Device) error
}

// Repo stores devices.
type Repo interface {
	Reader
	// InTx runs fn in one transaction, after taking the user's advisory lock
	// (pg_advisory_xact_lock(hashtext('identity.devices:' || user_id))) so the same
	// user's writes serialize. fn's error rolls back.
	InTx(ctx context.Context, userID string, fn func(Tx) error) error
	// Activate moves a pending device to active. Active stays active. ErrRemoved, ErrNotFound.
	Activate(ctx context.Context, id string) error
}

// Service holds the device rules.
type Service struct {
	repo  Repo
	clock clock.Clock
	audit audit.Recorder
	newID func() string
}

// NewService returns a service. newID may be nil: random UUID v4.
func NewService(repo Repo, clk clock.Clock, rec audit.Recorder, newID func() string) *Service {
	if newID == nil {
		newID = uuid.NewString
	}
	return &Service{repo: repo, clock: clk, audit: rec, newID: newID}
}

// Register adds the user's device. created is false when an earlier call already did.
func (s *Service) Register(ctx context.Context, user auth.User, in RegisterInput, idempotencyKey string) (Device, bool, error) {
	in, err := in.Validate()
	if err != nil {
		return Device{}, false, err
	}
	var (
		dev     Device
		created bool
	)
	for attempt := 0; ; attempt++ {
		dev, created, err = s.registerOnce(ctx, user, in, idempotencyKey)
		// A race on a unique constraint is settled by reading the winner on the second pass.
		if errors.Is(err, ErrDuplicate) && attempt == 0 {
			continue
		}
		break
	}
	if err != nil {
		return Device{}, false, err
	}
	if created {
		err = s.audit.Record(ctx, audit.Event{
			Type: audit.DeviceRegistered, UserID: dev.UserID, DeviceID: dev.ID, At: dev.CreatedAt,
			Meta: map[string]string{"platform": string(dev.Platform), "status": string(dev.Status)},
		})
		if err != nil {
			return Device{}, false, fmt.Errorf("audit device.registered: %w", err)
		}
	}
	return dev, created, nil
}

func (s *Service) registerOnce(ctx context.Context, user auth.User, in RegisterInput, key string) (Device, bool, error) {
	var (
		dev     Device
		created bool
	)
	err := s.repo.InTx(ctx, user.ID, func(tx Tx) error {
		created = false
		if key != "" {
			d, ok, err := tx.ByIdempotencyKey(ctx, user.ID, key)
			if err != nil {
				return err
			}
			if ok {
				dev = d
				return nil
			}
		}
		d, ok, err := tx.ByPublicKey(ctx, user.ID, in.PublicKey)
		if err != nil {
			return err
		}
		if ok {
			if d.Status == StatusRemoved {
				return ErrKeyRemoved
			}
			dev = d
			return nil
		}
		hasActive, err := tx.HasActive(ctx, user.ID)
		if err != nil {
			return err
		}
		status := StatusPending
		if !hasActive {
			status = StatusActive
		}
		now := s.clock.Now()
		d = Device{
			ID: s.newID(), UserID: user.ID, Name: in.Name, Platform: in.Platform,
			PublicKey: append([]byte(nil), in.PublicKey...), Status: status,
			SessionID: user.SessionID, CreatedAt: now, LastSeenAt: now,
		}
		if err := tx.Insert(ctx, d, key); err != nil {
			return err
		}
		dev, created = d, true
		return nil
	})
	return dev, created, err
}

// List returns the user's active and pending devices, newest last seen first.
func (s *Service) List(ctx context.Context, userID string) ([]Device, error) {
	return s.repo.List(ctx, userID)
}

// Current records that the device is in use and returns it.
func (s *Service) Current(ctx context.Context, user auth.User, deviceID string) (Device, error) {
	var dev Device
	err := s.repo.InTx(ctx, user.ID, func(tx Tx) error {
		d, err := tx.Get(ctx, user.ID, deviceID)
		if err != nil {
			return err
		}
		if d.Status == StatusRemoved {
			return ErrRemoved
		}
		d.LastSeenAt = s.clock.Now()
		if user.SessionID != "" {
			d.SessionID = user.SessionID
		}
		if err := tx.Update(ctx, d); err != nil {
			return err
		}
		dev = d
		return nil
	})
	return dev, err
}

// Remove removes one device and returns its Keycloak session id for the caller to revoke.
// Removing a removed device is not an error: it returns an empty session id and audits nothing.
func (s *Service) Remove(ctx context.Context, userID, deviceID string) (string, error) {
	var (
		sid     string
		removed bool
	)
	err := s.repo.InTx(ctx, userID, func(tx Tx) error {
		sid, removed = "", false
		d, err := tx.Get(ctx, userID, deviceID)
		if err != nil {
			return err
		}
		if d.Status == StatusRemoved {
			return nil
		}
		d.Status = StatusRemoved
		if err := tx.Update(ctx, d); err != nil {
			return err
		}
		sid, removed = d.SessionID, true
		return nil
	})
	if err != nil || !removed {
		return "", err
	}
	if err := s.auditRemoved(ctx, userID, deviceID, "user"); err != nil {
		return "", err
	}
	return sid, nil
}

// RemoveOthers removes every device of the user except currentDeviceID, which must be
// usable. It returns the Keycloak session ids of the removed devices (blank ones left out).
func (s *Service) RemoveOthers(ctx context.Context, userID, currentDeviceID string) ([]string, error) {
	var sids, ids []string
	err := s.repo.InTx(ctx, userID, func(tx Tx) error {
		sids, ids = nil, nil
		cur, err := tx.Get(ctx, userID, currentDeviceID)
		if err != nil {
			return err
		}
		if cur.Status == StatusRemoved {
			return ErrRemoved
		}
		all, err := tx.List(ctx, userID)
		if err != nil {
			return err
		}
		for _, d := range all {
			if d.ID == currentDeviceID {
				continue
			}
			d.Status = StatusRemoved
			if err := tx.Update(ctx, d); err != nil {
				return err
			}
			ids = append(ids, d.ID)
			if d.SessionID != "" {
				sids = append(sids, d.SessionID)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	for _, id := range ids {
		if err := s.auditRemoved(ctx, userID, id, "others"); err != nil {
			return nil, err
		}
	}
	return sids, nil
}

// Usable reports whether the device exists, belongs to the user and is not removed.
// A pending device is usable. It satisfies token.DeviceChecker.
func (s *Service) Usable(ctx context.Context, userID, deviceID string) (bool, error) {
	d, err := s.repo.Get(ctx, userID, deviceID)
	if errors.Is(err, ErrNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return d.Status != StatusRemoved, nil
}

// Activate moves a pending device to active (see ports.Activator).
func (s *Service) Activate(ctx context.Context, deviceID string) error {
	return s.repo.Activate(ctx, deviceID)
}

func (s *Service) auditRemoved(ctx context.Context, userID, deviceID, reason string) error {
	err := s.audit.Record(ctx, audit.Event{
		Type: audit.DeviceRemoved, UserID: userID, DeviceID: deviceID, At: s.clock.Now(),
		Meta: map[string]string{"reason": reason},
	})
	if err != nil {
		return fmt.Errorf("audit device.removed: %w", err)
	}
	return nil
}
