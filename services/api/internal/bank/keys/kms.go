package keys

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"

	"github.com/golang-jwt/jwt/v5"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

// KMS is the part of AWS KMS the bank keys use (M5 prompt: the private key never leaves KMS).
// An adapter over the AWS SDK implements it in AWS; tests use local keys.
type KMS interface {
	// SignDigest signs a SHA-256 digest with RSASSA_PSS_SHA_256 (MessageType DIGEST).
	SignDigest(ctx context.Context, keyID string, digest []byte) ([]byte, error)
	// GenerateMac returns the HMAC_SHA_256 of message.
	GenerateMac(ctx context.Context, keyID string, message []byte) ([]byte, error)
}

// KMSSigner signs client assertions with an asymmetric KMS key (RSA_3072, RSASSA_PSS_SHA_256),
// the same claims as LocalSigner.
type KMSSigner struct {
	kms      KMS
	keyID    string
	clientID string
	clock    clock.Clock
}

var _ ports.AssertionSigner = (*KMSSigner)(nil)

// NewKMSSigner returns a signer for Fynk's client clientID with the KMS key keyID.
func NewKMSSigner(kms KMS, keyID, clientID string, c clock.Clock) (*KMSSigner, error) {
	if kms == nil || keyID == "" || clientID == "" {
		return nil, errors.New("keys: the KMS signer needs a KMS client, a key id and a client id")
	}
	return &KMSSigner{kms: kms, keyID: keyID, clientID: clientID, clock: c}, nil
}

// ClientAssertion implements ports.AssertionSigner. KMS signs only the digest of
// "header.payload"; the signature is appended as JWS (RFC 7515).
func (s *KMSSigner) ClientAssertion(ctx context.Context, audience string) (string, error) {
	claims, err := assertionClaims(s.clientID, audience, s.clock.Now())
	if err != nil {
		return "", err
	}
	input, err := jwt.NewWithClaims(jwt.SigningMethodPS256, claims).SigningString()
	if err != nil {
		return "", fmt.Errorf("keys: build client assertion: %w", err)
	}
	digest := sha256.Sum256([]byte(input))
	sig, err := s.kms.SignDigest(ctx, s.keyID, digest[:])
	if err != nil {
		return "", fmt.Errorf("keys: KMS sign: %w", err)
	}
	return input + "." + base64.RawURLEncoding.EncodeToString(sig), nil
}

// KMSFingerprinter is the Fingerprinter in AWS: KMS GenerateMac with an HMAC_256 key.
type KMSFingerprinter struct {
	kms   KMS
	keyID string
}

var _ Fingerprinter = (*KMSFingerprinter)(nil)

// NewKMSFingerprinter returns a fingerprinter with the KMS key keyID.
func NewKMSFingerprinter(kms KMS, keyID string) (*KMSFingerprinter, error) {
	if kms == nil || keyID == "" {
		return nil, errors.New("keys: the KMS fingerprinter needs a KMS client and a key id")
	}
	return &KMSFingerprinter{kms: kms, keyID: keyID}, nil
}

// Fingerprint implements Fingerprinter. Its errors never contain the token.
func (f *KMSFingerprinter) Fingerprint(ctx context.Context, token string) ([]byte, error) {
	if token == "" {
		return nil, errors.New("keys: nothing to fingerprint")
	}
	mac, err := f.kms.GenerateMac(ctx, f.keyID, []byte(token))
	if err != nil {
		return nil, fmt.Errorf("keys: KMS generate mac: %w", err)
	}
	return mac, nil
}
