// Package devices is the domain and service of the devices a user registered (M1).
// It has no SQL: the postgres package implements Repo.
package devices

import (
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

// Status of a device. A pending device waits for M2 to approve it.
type Status string

// Device statuses.
const (
	StatusPending Status = "pending"
	StatusActive  Status = "active"
	StatusRemoved Status = "removed"
)

// Platform of a device.
type Platform string

// Device platforms.
const (
	PlatformIOS     Platform = "ios"
	PlatformAndroid Platform = "android"
)

// PublicKeySize is the size of an X25519 public key.
const PublicKeySize = 32

// MaxNameRunes is the longest device name.
const MaxNameRunes = 64

// Errors of the service. None of them carries a name, a key or a token.
var (
	// ErrNotFound is also returned for a device of another user, so its existence is not revealed.
	ErrNotFound = errors.New("device not found")
	ErrRemoved  = errors.New("device removed")
	// ErrNotActive: the calling device is not active (pending, or no trusted device id), so it
	// cannot remove other devices or sign them out.
	ErrNotActive = errors.New("device not active")
	ErrInvalid   = errors.New("invalid device")
	// ErrKeyRemoved: the public key belongs to a removed device. The phone makes a new key pair.
	ErrKeyRemoved = errors.New("device public key was removed")
	// ErrDuplicate is returned by a Repo when a unique constraint is hit by a race.
	ErrDuplicate = errors.New("device already registered")
)

// Device is one registered phone.
type Device struct {
	ID         string
	UserID     string
	Name       string
	Platform   Platform
	PublicKey  []byte
	Status     Status
	SessionID  string
	CreatedAt  time.Time
	LastSeenAt time.Time
}

// String never prints the name or the key.
func (d Device) String() string {
	return fmt.Sprintf("device{id=%s status=%s platform=%s}", d.ID, d.Status, d.Platform)
}

// GoString keeps %#v from printing the name or the key.
func (d Device) GoString() string { return d.String() }

// RegisterInput is what the phone sends at registration.
type RegisterInput struct {
	Name      string
	Platform  Platform
	PublicKey []byte
}

// Validate trims the name and checks every field. Errors name the field, never the value.
func (in RegisterInput) Validate() (RegisterInput, error) {
	in.Name = strings.TrimSpace(in.Name)
	if n := utf8.RuneCountInString(in.Name); n < 1 || n > MaxNameRunes {
		return in, fmt.Errorf("%w: name", ErrInvalid)
	}
	for _, r := range in.Name {
		if unicode.IsControl(r) {
			return in, fmt.Errorf("%w: name", ErrInvalid)
		}
	}
	if in.Platform != PlatformIOS && in.Platform != PlatformAndroid {
		return in, fmt.Errorf("%w: platform", ErrInvalid)
	}
	if len(in.PublicKey) != PublicKeySize {
		return in, fmt.Errorf("%w: publicKey", ErrInvalid)
	}
	return in, nil
}
