// Package reference keeps the weekly average CDT rate published by Banco de la República, shown
// in the Inversión tab as a market reference. It refreshes at most once a day when asked, and
// keeps the last good value when the download fails.
package reference

import (
	"context"
	"errors"
	"sync"
	"time"
)

// Rate is one published reference rate.
type Rate struct {
	Week      time.Time // first day of the published week (date only)
	TermDays  int       // 360
	RateEaBps int       // 1085 = 10,85 % E.A.
	SourceURL string
	FetchedAt time.Time
}

// Store persists the rates (Postgres, schema market).
type Store interface {
	Latest(ctx context.Context, termDays int) (Rate, bool, error)
	Save(ctx context.Context, r Rate) error
}

// Fetcher downloads the latest published rate.
type Fetcher interface {
	Fetch(ctx context.Context, termDays int) (Rate, error)
}

// RefreshEvery is how old the stored rate may be before a new download is tried.
const RefreshEvery = 24 * time.Hour

// TermDays is the term shown on the phone.
const TermDays = 360

// ErrUnavailable means nothing was ever downloaded.
var ErrUnavailable = errors.New("cdt reference unavailable")

// Service returns the reference rate.
type Service struct {
	store   Store
	fetcher Fetcher
	now     func() time.Time
	// mu guards lastTry, which keeps a failing source from being hit on every request.
	mu      sync.Mutex
	lastTry time.Time
}

func NewService(store Store, fetcher Fetcher, now func() time.Time) *Service {
	return &Service{store: store, fetcher: fetcher, now: now}
}

// Result is the rate and whether it is older than a week.
type Result struct {
	Rate  Rate
	Stale bool
}

// shouldTry reports whether a download is due, and claims the attempt (one per hour at most).
func (s *Service) shouldTry(ok bool, latest Rate, now time.Time) bool {
	if s.fetcher == nil || (ok && now.Sub(latest.FetchedAt) < RefreshEvery) {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if now.Sub(s.lastTry) < time.Hour {
		return false
	}
	s.lastTry = now
	return true
}

// Get returns the latest rate, downloading a new one when the stored one is a day old.
func (s *Service) Get(ctx context.Context) (Result, error) {
	now := s.now().UTC()
	latest, ok, err := s.store.Latest(ctx, TermDays)
	if err != nil {
		return Result{}, err
	}
	if s.shouldTry(ok, latest, now) {
		fresh, ferr := s.fetcher.Fetch(ctx, TermDays)
		if ferr == nil {
			fresh.FetchedAt = now
			if serr := s.store.Save(ctx, fresh); serr == nil {
				latest, ok = fresh, true
			}
		}
	}
	if !ok {
		return Result{}, ErrUnavailable
	}
	return Result{Rate: latest, Stale: now.Sub(latest.Week) > 14*24*time.Hour}, nil
}
