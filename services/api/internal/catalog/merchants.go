package catalog

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"
	"time"
)

// Merchant is one entry of the shared catalog. It holds no personal data.
type Merchant struct {
	Key            string    `json:"key"`
	DisplayName    string    `json:"displayName"`
	Category       string    `json:"category"`
	IsSubscription bool      `json:"isSubscription"`
	MatchPatterns  []string  `json:"matchPatterns"`
	CancelURL      *string   `json:"cancelUrl"`
	CancelSteps    []string  `json:"cancelSteps"`
	UpdatedAt      time.Time `json:"-"`
}

// Store reads the catalog, ordered by key.
type Store interface {
	List(ctx context.Context) ([]Merchant, error)
}

// Catalog is the list with its version.
type Catalog struct {
	Merchants []Merchant
	UpdatedAt time.Time
	// ETag is a strong validator of the content: the same merchants give the same ETag.
	ETag string
}

// Load reads the catalog and computes its ETag from its content, so any change in a merchant
// gives a new one and the phone downloads it again.
func Load(ctx context.Context, s Store) (Catalog, error) {
	merchants, err := s.List(ctx)
	if err != nil {
		return Catalog{}, err
	}
	var updated time.Time
	for _, m := range merchants {
		if m.UpdatedAt.After(updated) {
			updated = m.UpdatedAt
		}
	}
	body, err := json.Marshal(merchants)
	if err != nil {
		return Catalog{}, err
	}
	sum := sha256.Sum256(body)
	return Catalog{
		Merchants: merchants,
		UpdatedAt: updated.UTC(),
		ETag:      `"` + hex.EncodeToString(sum[:8]) + `"`,
	}, nil
}

// Matches reports whether the If-None-Match header names this ETag. It accepts a list and the
// weak form, as RFC 9110 says for If-None-Match.
func Matches(ifNoneMatch, etag string) bool {
	for _, part := range strings.Split(ifNoneMatch, ",") {
		part = strings.TrimSpace(part)
		if part == "*" || part == etag || part == "W/"+etag {
			return true
		}
	}
	return false
}
