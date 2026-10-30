// Package keys holds the bank module's key operations: the private_key_jwt client assertion
// signer and the refresh token fingerprint. In AWS both are KMS keys that never leave KMS
// (an asymmetric RSASSA_PSS_SHA_256 key and an HMAC_SHA_256 key, M14). On a developer machine
// they are local files behind the same interfaces, so nothing else changes between the two.
package keys

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

// AssertionLifetime is how long a client assertion is valid (M5 prompt: exp 60 s).
const AssertionLifetime = 60 * time.Second

// LocalSigner signs client assertions with an RSA key file, PS256 (RFC 7523, FAPI 2.0).
type LocalSigner struct {
	key      *rsa.PrivateKey
	clientID string
	clock    clock.Clock
}

var _ ports.AssertionSigner = (*LocalSigner)(nil)

// NewLocalSigner returns a signer for Fynk's client clientID at a bank.
func NewLocalSigner(key *rsa.PrivateKey, clientID string, c clock.Clock) (*LocalSigner, error) {
	if key == nil || clientID == "" {
		return nil, errors.New("keys: the signer needs a key and a client id")
	}
	if key.N.BitLen() < 2048 {
		return nil, errors.New("keys: the signer key must have at least 2048 bits")
	}
	return &LocalSigner{key: key, clientID: clientID, clock: c}, nil
}

// LoadLocalSigner reads a PEM RSA private key (PKCS #1 or PKCS #8) from path.
func LoadLocalSigner(path, clientID string, c clock.Clock) (*LocalSigner, error) {
	raw, err := os.ReadFile(path) //nolint:gosec // the path comes from the API's own settings
	if err != nil {
		return nil, fmt.Errorf("keys: read signer key: %w", err)
	}
	block, _ := pem.Decode(raw)
	if block == nil {
		return nil, errors.New("keys: the signer key is not PEM")
	}
	key, err := parseRSA(block.Bytes)
	if err != nil {
		return nil, err
	}
	return NewLocalSigner(key, clientID, c)
}

func parseRSA(der []byte) (*rsa.PrivateKey, error) {
	if k, err := x509.ParsePKCS1PrivateKey(der); err == nil {
		return k, nil
	}
	k, err := x509.ParsePKCS8PrivateKey(der)
	if err != nil {
		return nil, fmt.Errorf("keys: parse signer key: %w", err)
	}
	rsaKey, ok := k.(*rsa.PrivateKey)
	if !ok {
		return nil, errors.New("keys: the signer key is not RSA")
	}
	return rsaKey, nil
}

// ClientAssertion implements ports.AssertionSigner: iss and sub are Fynk's client id, aud the
// bank, a random jti so the bank can refuse a replay, and exp 60 s after iat.
func (s *LocalSigner) ClientAssertion(_ context.Context, audience string) (string, error) {
	claims, err := assertionClaims(s.clientID, audience, s.clock.Now())
	if err != nil {
		return "", err
	}
	signed, err := jwt.NewWithClaims(jwt.SigningMethodPS256, claims).SignedString(s.key)
	if err != nil {
		return "", fmt.Errorf("keys: sign client assertion: %w", err)
	}
	return signed, nil
}

// assertionClaims are the claims of every client assertion, local or KMS.
func assertionClaims(clientID, audience string, now time.Time) (jwt.RegisteredClaims, error) {
	if audience == "" {
		return jwt.RegisteredClaims{}, errors.New("keys: a client assertion needs an audience")
	}
	jti, err := randomID()
	if err != nil {
		return jwt.RegisteredClaims{}, err
	}
	return jwt.RegisteredClaims{
		Issuer:    clientID,
		Subject:   clientID,
		Audience:  jwt.ClaimStrings{audience},
		ID:        jti,
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(AssertionLifetime)),
	}, nil
}

func randomID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("keys: random jti: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
