package keys

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"errors"
	"fmt"
	"os"
)

// Fingerprinter computes the fingerprint kept with a bank link instead of its refresh token
// (CLAUDE.md, Where data lives). In AWS it is KMS GenerateMac with an HMAC_SHA_256 key.
type Fingerprinter interface {
	Fingerprint(ctx context.Context, token string) ([]byte, error)
}

// MinHMACKeyBytes is the shortest local HMAC key accepted.
const MinHMACKeyBytes = 32

// LocalHMAC is the local Fingerprinter: HMAC-SHA-256 with a key file.
type LocalHMAC struct {
	key []byte
}

var _ Fingerprinter = (*LocalHMAC)(nil)

// NewLocalHMAC returns a fingerprinter with key, which must have at least 32 bytes.
func NewLocalHMAC(key []byte) (*LocalHMAC, error) {
	if len(key) < MinHMACKeyBytes {
		return nil, fmt.Errorf("keys: the fingerprint key needs at least %d bytes", MinHMACKeyBytes)
	}
	return &LocalHMAC{key: append([]byte(nil), key...)}, nil
}

// LoadLocalHMAC reads the key file at path.
func LoadLocalHMAC(path string) (*LocalHMAC, error) {
	key, err := os.ReadFile(path) //nolint:gosec // the path comes from the API's own settings
	if err != nil {
		return nil, fmt.Errorf("keys: read fingerprint key: %w", err)
	}
	return NewLocalHMAC(key)
}

// Fingerprint implements Fingerprinter.
func (h *LocalHMAC) Fingerprint(_ context.Context, token string) ([]byte, error) {
	if token == "" {
		return nil, errors.New("keys: nothing to fingerprint")
	}
	mac := hmac.New(sha256.New, h.key)
	mac.Write([]byte(token))
	return mac.Sum(nil), nil
}

// Matches reports whether token has the fingerprint want, in constant time.
func Matches(ctx context.Context, f Fingerprinter, token string, want []byte) (bool, error) {
	got, err := f.Fingerprint(ctx, token)
	if err != nil {
		return false, err
	}
	return hmac.Equal(got, want), nil
}
