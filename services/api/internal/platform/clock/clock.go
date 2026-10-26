// Package clock gives code the current time, so tests can fix it.
package clock

import (
	"sync"
	"time"
)

// Clock returns the current time.
type Clock interface {
	Now() time.Time
}

// System is the real clock, in UTC.
type System struct{}

// Now implements Clock.
func (System) Now() time.Time { return time.Now().UTC() }

// Fixed is a clock for tests that only moves when told to.
type Fixed struct {
	mu sync.Mutex
	at time.Time
}

// NewFixed returns a clock stopped at t.
func NewFixed(t time.Time) *Fixed { return &Fixed{at: t} }

// Now implements Clock.
func (f *Fixed) Now() time.Time {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.at
}

// Set moves the clock to t.
func (f *Fixed) Set(t time.Time) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.at = t
}

// Advance moves the clock forward by d.
func (f *Fixed) Advance(d time.Duration) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.at = f.at.Add(d)
}
