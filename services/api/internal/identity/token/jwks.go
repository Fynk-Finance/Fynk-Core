package token

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math/big"
	"net/http"
	"sync"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

const (
	keysTTL           = 10 * time.Minute // how long fetched keys are trusted
	unknownKidRefetch = 30 * time.Second // at most one refetch for unknown kids in this window
	fetchTimeout      = 5 * time.Second
	maxJWKSBytes      = 1 << 20
	minRSABits        = 2048
)

var errUnknownKey = errors.New("no PS256 signing key with this kid")

// keySet caches the PS256 signing keys of the realm's JWKS. Keys older than keysTTL are never
// used: when they cannot be refreshed, every token is rejected (fail closed).
type keySet struct {
	url    string
	client *http.Client
	clock  clock.Clock
	log    *slog.Logger

	mu               sync.Mutex
	keys             map[string]*rsa.PublicKey
	fetchedAt        time.Time
	lastUnknownFetch time.Time
}

// key returns the public key for kid. The lock is held during a fetch, so concurrent
// requests wait for the same fetch instead of starting their own.
func (s *keySet) key(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := s.clock.Now()
	if !s.fetchedAt.IsZero() && now.Sub(s.fetchedAt) < keysTTL {
		if k, ok := s.keys[kid]; ok {
			return k, nil
		}
		// Keycloak may have rotated its key. Refetch, but not for every random kid.
		if now.Sub(s.lastUnknownFetch) < unknownKidRefetch {
			return nil, errUnknownKey
		}
		s.lastUnknownFetch = now
	}

	keys, err := s.fetch(ctx)
	if err != nil {
		s.log.WarnContext(ctx, "jwks fetch failed, rejecting tokens until it works", "error", err)
		return nil, err
	}
	s.keys, s.fetchedAt = keys, now
	if k, ok := keys[kid]; ok {
		return k, nil
	}
	return nil, errUnknownKey
}

// jwk is one key of a JSON Web Key Set (RFC 7517). Only RSA fields are read.
type jwk struct {
	Kid string `json:"kid"`
	Kty string `json:"kty"`
	Alg string `json:"alg"`
	Use string `json:"use"`
	N   string `json:"n"`
	E   string `json:"e"`
}

func (s *keySet) fetch(ctx context.Context) (map[string]*rsa.PublicKey, error) {
	ctx, cancel := context.WithTimeout(ctx, fetchTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("get jwks: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("get jwks: status %d", resp.StatusCode)
	}
	var doc struct {
		Keys []jwk `json:"keys"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxJWKSBytes)).Decode(&doc); err != nil {
		return nil, fmt.Errorf("decode jwks: %w", err)
	}

	keys := make(map[string]*rsa.PublicKey)
	for _, k := range doc.Keys {
		// Keycloak publishes every realm key; keep only RSA signing keys for PS256.
		if k.Kid == "" || k.Kty != "RSA" || (k.Use != "" && k.Use != "sig") || (k.Alg != "" && k.Alg != "PS256") {
			continue
		}
		if pub, err := k.rsaPublicKey(); err == nil {
			keys[k.Kid] = pub
		}
	}
	if len(keys) == 0 {
		return nil, errors.New("jwks has no PS256 signing key")
	}
	return keys, nil
}

func (k jwk) rsaPublicKey() (*rsa.PublicKey, error) {
	n, err := base64.RawURLEncoding.DecodeString(k.N)
	if err != nil {
		return nil, err
	}
	e, err := base64.RawURLEncoding.DecodeString(k.E)
	if err != nil {
		return nil, err
	}
	pub := &rsa.PublicKey{N: new(big.Int).SetBytes(n)}
	exp := new(big.Int).SetBytes(e)
	if !exp.IsInt64() || exp.Int64() < 3 || exp.Int64() > 1<<31-1 || pub.N.BitLen() < minRSABits {
		return nil, errors.New("unusable RSA key")
	}
	pub.E = int(exp.Int64())
	return pub, nil
}
