package reset

import (
	"context"
	"errors"
	"fmt"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	identity "github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

// Service holds the reset rules. Ids, times and session ids never reach a log, an audit event
// or an error.
type Service struct {
	repo     Repo
	devices  identity.Devices
	act      identity.Activator
	resets   identity.EmailResets
	sessions identity.Sessions
	clock    clock.Clock
	audit    audit.Recorder
}

// NewService returns a service. devices must remove the other devices and revoke their sessions.
func NewService(repo Repo, devices identity.Devices, act identity.Activator, resets identity.EmailResets,
	sessions identity.Sessions, clk clock.Clock, rec audit.Recorder) *Service {
	return &Service{repo: repo, devices: devices, act: act, resets: resets, sessions: sessions, clock: clk, audit: rec}
}

// Reset deletes the user's backup and every other device, and activates the calling device.
// It needs a caller device that is pending or active, an email-code reset at most Window ago,
// and a caller session that started after that reset. Each step is idempotent, so repeating the
// call after a failure finishes the job.
func (s *Service) Reset(ctx context.Context, user auth.User) error {
	if user.DeviceID == "" {
		return ErrNotActive
	}
	d, err := s.devices.Get(ctx, user.ID, user.DeviceID)
	switch {
	case errors.Is(err, identity.ErrRemoved), errors.Is(err, identity.ErrNotFound):
		return ErrNotActive
	case err != nil:
		return err
	}
	if d.Status != "pending" && d.Status != "active" {
		return ErrNotActive
	}
	if err := s.allowed(ctx, user); err != nil {
		return err
	}
	if err := s.repo.DeleteBackup(ctx, user.ID); err != nil {
		return err
	}
	if err := s.devices.RemoveOthers(ctx, user.ID, user.DeviceID); err != nil {
		return err
	}
	if d.Status == "pending" {
		if err := s.act.ActivateDevice(ctx, user.DeviceID); err != nil {
			return err
		}
	}
	err = s.audit.Record(ctx, audit.Event{Type: AuditBackupReset, UserID: user.ID, DeviceID: user.DeviceID,
		At: s.clock.Now(), Meta: map[string]string{"method": "email_code"}})
	if err != nil {
		return fmt.Errorf("reset: audit: %w", err)
	}
	return nil
}

// allowed checks the email-code reset window and that the caller's session is newer than it.
func (s *Service) allowed(ctx context.Context, user auth.User) error {
	resetAt, ok, err := s.resets.EmailResetAt(ctx, user.ID)
	switch {
	case errors.Is(err, identity.ErrNotFound):
		return ErrNotAllowed
	case err != nil:
		return err
	case !ok:
		return ErrNotAllowed
	}
	now := s.clock.Now()
	if now.Sub(resetAt) > Window || resetAt.After(now.Add(Skew)) {
		return ErrNotAllowed
	}
	if user.SessionID == "" {
		return ErrNotAllowed
	}
	start, found, err := s.sessions.SessionStart(ctx, user.ID, user.SessionID)
	switch {
	case errors.Is(err, identity.ErrNotFound):
		return ErrNotAllowed
	case err != nil:
		return err
	case !found:
		return ErrNotAllowed
	}
	if start.Before(resetAt.Add(-Skew)) {
		return ErrNotAllowed
	}
	return nil
}
