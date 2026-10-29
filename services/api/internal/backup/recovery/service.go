package recovery

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"errors"
	"fmt"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	identity "github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

// Service holds the recovery key rules. Nothing in it is logged: keys, proofs and hashes
// never leave these calls except into the repository.
type Service struct {
	repo    Repo
	devices identity.Devices
	act     identity.Activator
	limiter Limiter
	clock   clock.Clock
	audit   audit.Recorder
}

// NewService returns a service.
func NewService(repo Repo, devices identity.Devices, act identity.Activator, lim Limiter, clk clock.Clock, rec audit.Recorder) *Service {
	return &Service{repo: repo, devices: devices, act: act, limiter: lim, clock: clk, audit: rec}
}

// device returns the calling device's status. A missing, foreign or unidentified device is
// ErrNotActive; a removed one is ErrRemoved.
func (s *Service) device(ctx context.Context, user auth.User) (string, error) {
	if user.DeviceID == "" {
		return "", ErrNotActive
	}
	d, err := s.devices.Get(ctx, user.ID, user.DeviceID)
	switch {
	case errors.Is(err, identity.ErrRemoved):
		return "", ErrRemoved
	case errors.Is(err, identity.ErrNotFound):
		return "", ErrNotActive
	case err != nil:
		return "", err
	}
	return d.Status, nil
}

// Set replaces the user's recovery key. Only an active device may call it. The caller has
// already checked the sizes and the KDF parameters.
func (s *Service) Set(ctx context.Context, user auth.User, k Key) error {
	st, err := s.device(ctx, user)
	if errors.Is(err, ErrRemoved) || (err == nil && st != "active") {
		return ErrNotActive
	}
	if err != nil {
		return err
	}
	k.CreatedAt = s.clock.Now()
	if err := s.repo.Put(ctx, user.ID, k); err != nil {
		return err
	}
	return s.record(ctx, user, audit.RecoveryKeySet, map[string]string{"kdf": k.KDF})
}

// Get returns the key without its proof hash. Any device that is not removed may read it.
func (s *Service) Get(ctx context.Context, user auth.User) (Key, error) {
	if _, err := s.device(ctx, user); err != nil {
		if errors.Is(err, ErrRemoved) {
			return Key{}, ErrNotActive
		}
		return Key{}, err
	}
	k, err := s.repo.Get(ctx, user.ID)
	k.ProofHash = nil
	return k, err
}

// Activate activates the calling pending device when SHA-256(proof) matches the stored hash.
// An active device gets nil with no audit event. After MaxFailures wrong proofs in an hour
// it answers ErrTooMany without comparing.
func (s *Service) Activate(ctx context.Context, user auth.User, proof []byte) error {
	st, err := s.device(ctx, user)
	if err != nil {
		return err
	}
	if st == "active" {
		return nil
	}
	blocked, err := s.limiter.Blocked(ctx, user.ID)
	if err != nil {
		return err
	}
	if blocked {
		return ErrTooMany
	}
	k, err := s.repo.Get(ctx, user.ID)
	if err != nil {
		return err
	}
	sum := sha256.Sum256(proof)
	if subtle.ConstantTimeCompare(sum[:], k.ProofHash) != 1 {
		if err := s.limiter.Fail(ctx, user.ID); err != nil {
			return err
		}
		return ErrMismatch
	}
	if err := s.act.ActivateDevice(ctx, user.DeviceID); err != nil {
		if errors.Is(err, identity.ErrRemoved) {
			return ErrRemoved
		}
		return err
	}
	meta := map[string]string{"method": "recovery_code"}
	if err := s.record(ctx, user, audit.DeviceApproved, meta); err != nil {
		return err
	}
	return s.record(ctx, user, audit.BackupRestored, meta)
}

func (s *Service) record(ctx context.Context, user auth.User, typ string, meta map[string]string) error {
	err := s.audit.Record(ctx, audit.Event{
		Type: typ, UserID: user.ID, DeviceID: user.DeviceID, At: s.clock.Now(), Meta: meta,
	})
	if err != nil {
		return fmt.Errorf("audit %s: %w", typ, err)
	}
	return nil
}
