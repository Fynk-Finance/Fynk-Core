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

var allScopes = []Scope{ScopeBalances, ScopeTransactions, ScopeAccountDetails}

// providerScopes is what each provider of M5's GET /providers supports. It moves behind
// bank/ports when M5 exposes its provider list.
var providerScopes = map[string][]Scope{
	"banco-demo":     allScopes,
	"billetera-demo": allScopes,
	"bancolombia":    allScopes,
}

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
// pending consent with its acceptance evidence.
func NewPending(id string, r Request, text Text, now time.Time) (Consent, error) {
	if !uuidPattern.MatchString(r.DeviceID) {
		return Consent{}, ErrDeviceRequired
	}
	if err := checkScopes(r.Provider, r.Scopes); err != nil {
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
func checkScopes(provider string, scopes []Scope) error {
	supported, ok := providerScopes[provider]
	if !ok {
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
