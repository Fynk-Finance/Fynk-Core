// Package domain holds the consent rules of M4: what a specific consent is, how it is granted
// and when it stops being active. Pure code: no I/O, the time is always passed in.
package domain

import (
	"encoding/hex"
	"regexp"
	"time"
)

// Scope is one kind of data the entity shares with Fynk.
type Scope string

// Scopes shown on Conectar banco.
const (
	ScopeBalances       Scope = "balances"        // Saldos
	ScopeTransactions   Scope = "transactions"    // Movimientos
	ScopeAccountDetails Scope = "account_details" // Datos de la cuenta
)

// Status of a consent.
type Status string

// Consent statuses (M4 prompt, schema consents).
const (
	StatusPending Status = "pending"
	StatusActive  Status = "active"
	StatusRevoked Status = "revoked"
	StatusExpired Status = "expired"
	StatusFailed  Status = "failed"
)

// Purpose, term and locale shown on Conectar banco. Changing any of them needs the team.
const (
	Purpose  = "Mostrarte tus finanzas y recomendaciones dentro de Fynk."
	TermDays = 365
	Locale   = "es-CO"
)

// Text is one published version of the consent text.
type Text struct {
	Version     string
	BodyMD      string
	SHA256      []byte
	PublishedAt time.Time
}

// Evidence proves what the user accepted, where and when. It is stored in clear on purpose.
type Evidence struct {
	TextSHA256 string    `json:"text_sha256"`
	AcceptedAt time.Time `json:"accepted_at"`
	DeviceID   string    `json:"device_id"`
	AppVersion string    `json:"app_version"`
	Locale     string    `json:"locale"`
}

func (e Evidence) complete() bool {
	return e.TextSHA256 != "" && !e.AcceptedAt.IsZero() && e.DeviceID != "" && e.AppVersion != "" && e.Locale != ""
}

// Consent is the user's authorization for Fynk to receive data from one entity.
// It never holds financial data or tokens.
type Consent struct {
	ID                string
	UserID            string
	DeviceID          string
	Provider          string
	Scopes            []Scope
	Purpose           string
	TermDays          int
	Status            Status
	TextVersion       string
	Evidence          Evidence
	ProviderConsentID string
	CreatedAt         time.Time
	GrantedAt         *time.Time
	ExpiresAt         *time.Time
	RevokedAt         *time.Time
	RevokedReason     string
	// Notice of a revocation to the entity (HU-008, "notificar al proveedor").
	ProviderNotifiedAt *time.Time
	NextNotifyAt       *time.Time
	NotifyAttempts     int
}

// Request is what the app sends when the user ticks the checkbox and continues.
type Request struct {
	UserID      string
	DeviceID    string
	Provider    string
	Scopes      []Scope
	Purpose     string
	TermDays    int
	TextVersion string
	TextSHA256  string // hex, of the text the app showed
	AppVersion  string
	Locale      string
}

var uuidPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

// NewPending checks that r is exactly what Conectar banco showed with text, and returns the
// pending consent with its acceptance evidence. supported is what the provider offers (M5's
// provider list); nil means the provider is unknown or not offered.
func NewPending(id string, r Request, supported []Scope, text Text, now time.Time) (Consent, error) {
	if !uuidPattern.MatchString(r.DeviceID) {
		return Consent{}, ErrDeviceRequired
	}
	if err := checkScopes(supported, r.Scopes); err != nil {
		return Consent{}, err
	}
	if r.Purpose != Purpose {
		return Consent{}, ErrPurposeMismatch
	}
	if r.TermDays != TermDays {
		return Consent{}, ErrTermMismatch
	}
	if r.TextVersion != text.Version {
		return Consent{}, ErrUnknownTextVersion
	}
	if r.TextSHA256 != hex.EncodeToString(text.SHA256) {
		return Consent{}, ErrTextMismatch
	}
	if r.AppVersion == "" || r.Locale != Locale {
		return Consent{}, ErrMissingEvidence
	}
	return Consent{
		ID:          id,
		UserID:      r.UserID,
		DeviceID:    r.DeviceID,
		Provider:    r.Provider,
		Scopes:      append([]Scope(nil), r.Scopes...),
		Purpose:     r.Purpose,
		TermDays:    r.TermDays,
		Status:      StatusPending,
		TextVersion: text.Version,
		Evidence: Evidence{
			TextSHA256: r.TextSHA256,
			AcceptedAt: now,
			DeviceID:   r.DeviceID,
			AppVersion: r.AppVersion,
			Locale:     r.Locale,
		},
		CreatedAt: now,
	}, nil
}

// checkScopes accepts a non-empty subset, without repeats, of what the provider supports.
func checkScopes(supported, scopes []Scope) error {
	if supported == nil {
		return ErrUnsupportedProvider
	}
	if len(scopes) == 0 {
		return ErrInvalidScopes
	}
	seen := map[Scope]bool{}
	for _, s := range scopes {
		if seen[s] || !contains(supported, s) {
			return ErrInvalidScopes
		}
		seen[s] = true
	}
	return nil
}

func contains(list []Scope, s Scope) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}
	return false
}

// Grant activates a pending consent once the bank returned tokens. text is the version the
// consent references: a consent cannot become active without evidence of that exact text.
func (c Consent) Grant(providerConsentID string, text Text, now time.Time) (Consent, error) {
	if c.Status != StatusPending {
		return Consent{}, ErrNotPending
	}
	if !c.Evidence.complete() {
		return Consent{}, ErrMissingEvidence
	}
	if c.TextVersion == "" || c.TextVersion != text.Version {
		return Consent{}, ErrUnknownTextVersion
	}
	if c.Evidence.TextSHA256 != hex.EncodeToString(text.SHA256) {
		return Consent{}, ErrTextMismatch
	}
	if providerConsentID == "" {
		return Consent{}, ErrMissingProviderConsent
	}
	expires := now.AddDate(0, 0, c.TermDays)
	c.Status = StatusActive
	c.ProviderConsentID = providerConsentID
	c.GrantedAt = &now
	c.ExpiresAt = &expires
	return c, nil
}

// StatusAt is the status as of now: an active consent past its expiry is expired, even
// before the daily job writes it.
func (c Consent) StatusAt(now time.Time) Status {
	if c.Status == StatusActive && c.ExpiresAt != nil && !now.Before(*c.ExpiresAt) {
		return StatusExpired
	}
	return c.Status
}

// ActiveAt reports whether Fynk may receive data under this consent at now.
func (c Consent) ActiveAt(now time.Time) bool { return c.StatusAt(now) == StatusActive }

// Revocation reasons stored in revoked_reason.
const (
	ReasonUserRequest = "user_request"
)

// How long and how often Fynk tries to tell the entity about a revocation (M4 prompt).
const (
	NotifyRetryEvery = 10 * time.Minute
	NotifyFor        = 24 * time.Hour
)

// Revoke ends an active or pending consent at now. It takes effect in Fynk at once; an
// active one also has the entity to notify, first right away and then by the retry job, so
// the first retry is due after NotifyRetryEvery.
func (c Consent) Revoke(reason string, now time.Time) (Consent, error) {
	switch c.StatusAt(now) {
	case StatusRevoked:
		return Consent{}, ErrAlreadyRevoked
	case StatusActive, StatusPending:
	default:
		return Consent{}, ErrNotRevocable
	}
	c.Status = StatusRevoked
	c.RevokedAt = &now
	c.RevokedReason = reason
	if c.ProviderConsentID != "" {
		next := now.Add(NotifyRetryEvery)
		c.NextNotifyAt = &next
	}
	return c, nil
}

// NoticeFailed schedules the next try to notify the entity, or none once the 24 hours pass.
func (c Consent) NoticeFailed(now time.Time) Consent {
	c.NotifyAttempts++
	next := now.Add(NotifyRetryEvery)
	if c.RevokedAt == nil || !next.Before(c.RevokedAt.Add(NotifyFor)) {
		c.NextNotifyAt = nil
		return c
	}
	c.NextNotifyAt = &next
	return c
}

// Notified records that the entity confirmed the revocation.
func (c Consent) Notified(now time.Time) Consent {
	c.NotifyAttempts++
	c.ProviderNotifiedAt = &now
	c.NextNotifyAt = nil
	return c
}
