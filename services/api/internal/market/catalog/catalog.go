// Package catalog is the CDT catalog of the Inversión tab: the same list for every user.
// Nothing in this package receives a user, a balance or a profile, so it cannot filter, sort
// or highlight a product for someone (Decreto 2555, art. 2.40.1.1.2 and 2.40.1.1.3).
package catalog

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"
)

// Risk levels shown as bars on the phone.
const (
	RiskLow      = "low"
	RiskModerate = "moderate"
	RiskHigh     = "high"
)

// Product is one CDT of a simulated or real bank.
type Product struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Issuer         string `json:"issuer"`
	TermDays       int    `json:"termDays"`
	RateEaBps      int    `json:"rateEaBps"`
	MinAmountMinor int64  `json:"minAmountMinor"`
	Risk           string `json:"risk"`
	Simulated      bool   `json:"simulated"`
}

// Source is the bank side: M5's Provider.Products() (shared contracts 4.4).
type Source interface {
	Products(ctx context.Context) ([]Product, error)
}

// Cache keeps the catalog for an hour (Redis).
type Cache interface {
	Get(ctx context.Context, key string, v any) (bool, error)
	Set(ctx context.Context, key string, v any, ttl time.Duration) error
}

// TTL of the cached catalog.
const TTL = time.Hour

const cacheKey = "market:cdt-products:v1"

// Catalog is the answer of GET /market/cdt-products.
type Catalog struct {
	Products  []Product `json:"products"`
	FetchedAt time.Time `json:"fetchedAt"`
}

// ErrUnavailable means no source answered and nothing is cached.
var ErrUnavailable = errors.New("cdt catalog unavailable")

// Service serves the catalog.
type Service struct {
	sources []Source
	cache   Cache
	now     func() time.Time
}

// NewService builds the service. cache may be nil.
func NewService(cache Cache, now func() time.Time, sources ...Source) *Service {
	return &Service{sources: sources, cache: cache, now: now}
}

// NormalizeRisk maps the bank's words to low, moderate or high.
func NormalizeRisk(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "alto", "high":
		return RiskHigh
	case "medio", "moderado", "moderate", "medium":
		return RiskModerate
	default:
		return RiskLow
	}
}

// Get returns the catalog, from the cache when it is fresh. The order is by name, a neutral
// order: the phone lets the person sort it.
func (s *Service) Get(ctx context.Context) (Catalog, error) {
	if s.cache != nil {
		var c Catalog
		if ok, err := s.cache.Get(ctx, cacheKey, &c); err == nil && ok {
			return c, nil
		}
	}
	var all []Product
	var errs []error
	for _, src := range s.sources {
		ps, err := src.Products(ctx)
		if err != nil {
			errs = append(errs, err)
			continue
		}
		all = append(all, ps...)
	}
	if len(all) == 0 {
		return Catalog{}, errors.Join(append([]error{ErrUnavailable}, errs...)...)
	}
	sort.SliceStable(all, func(i, j int) bool { return all[i].Name < all[j].Name })
	c := Catalog{Products: all, FetchedAt: s.now().UTC()}
	if s.cache != nil {
		_ = s.cache.Set(ctx, cacheKey, c, TTL)
	}
	return c, nil
}
