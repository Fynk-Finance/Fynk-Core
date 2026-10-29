package domain

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"testing"
	"time"
)

var (
	now  = time.Date(2026, 10, 27, 15, 4, 5, 0, time.UTC)
	body = "# Autorización\n"
	sum  = sha256.Sum256([]byte(body))
	text = Text{Version: "2026-10-v1", BodyMD: body, SHA256: sum[:], PublishedAt: now.Add(-time.Hour)}
	// supported is what M5's provider list says Banco Demo offers.
	supported = []Scope{ScopeBalances, ScopeTransactions, ScopeAccountDetails}
)

func request() Request {
	return Request{
		UserID: "u1", DeviceID: "0192f0a0-0000-7000-8000-000000000001", Provider: "banco-demo",
		Scopes:      []Scope{ScopeBalances, ScopeTransactions, ScopeAccountDetails},
		Purpose:     Purpose,
		TermDays:    TermDays,
		TextVersion: text.Version, TextSHA256: hex.EncodeToString(sum[:]),
		AppVersion: "0.1.0", Locale: Locale,
	}
}

func pending(t *testing.T) Consent {
	t.Helper()
	c, err := NewPending("c1", request(), supported, text, now)
	if err != nil {
		t.Fatalf("NewPending: %v", err)
	}
	return c
}

// HU-006: the consent is recorded explicitly, with its scope, term and acceptance evidence.
func TestNewPendingRecordsScopeTermAndEvidence(t *testing.T) {
	c := pending(t)
	if c.Status != StatusPending || c.TermDays != 365 || c.Purpose != Purpose || len(c.Scopes) != 3 {
		t.Fatalf("consent %+v", c)
	}
	e := c.Evidence
	if e.TextSHA256 != hex.EncodeToString(sum[:]) || !e.AcceptedAt.Equal(now) || e.DeviceID != request().DeviceID ||
		e.AppVersion != "0.1.0" || e.Locale != "es-CO" {
		t.Fatalf("evidence %+v", e)
	}
	if c.GrantedAt != nil || c.ExpiresAt != nil {
		t.Fatal("a pending consent has no grant or expiry date")
	}
}

// HU-006: no open or general consents, and only what was shown is accepted.
func TestNewPendingRejectsWhatWasNotShown(t *testing.T) {
	if _, err := NewPending("c1", request(), nil, text, now); !errors.Is(err, ErrUnsupportedProvider) {
		t.Errorf("provider not offered: err = %v", err)
	}
	cases := map[string]struct {
		edit func(*Request)
		want error
	}{
		"no scopes":          {func(r *Request) { r.Scopes = nil }, ErrInvalidScopes},
		"unknown scope":      {func(r *Request) { r.Scopes = []Scope{"payments"} }, ErrInvalidScopes},
		"repeated scope":     {func(r *Request) { r.Scopes = []Scope{ScopeBalances, ScopeBalances} }, ErrInvalidScopes},
		"other purpose":      {func(r *Request) { r.Purpose = "Cualquier uso." }, ErrPurposeMismatch},
		"open term":          {func(r *Request) { r.TermDays = 0 }, ErrTermMismatch},
		"longer term":        {func(r *Request) { r.TermDays = 730 }, ErrTermMismatch},
		"other text version": {func(r *Request) { r.TextVersion = "2026-09-v0" }, ErrUnknownTextVersion},
		"text not shown":     {func(r *Request) { r.TextSHA256 = hex.EncodeToString(make([]byte, 32)) }, ErrTextMismatch},
		"no device":          {func(r *Request) { r.DeviceID = "" }, ErrDeviceRequired},
		"device not a uuid":  {func(r *Request) { r.DeviceID = "phone-1" }, ErrDeviceRequired},
		"no app version":     {func(r *Request) { r.AppVersion = "" }, ErrMissingEvidence},
		"other locale":       {func(r *Request) { r.Locale = "en-US" }, ErrMissingEvidence},
	}
	for name, tc := range cases {
		r := request()
		tc.edit(&r)
		if _, err := NewPending("c1", r, supported, text, now); !errors.Is(err, tc.want) {
			t.Errorf("%s: err = %v, want %v", name, err, tc.want)
		}
	}
}

func TestASubsetOfScopesIsAccepted(t *testing.T) {
	r := request()
	r.Scopes = []Scope{ScopeBalances}
	if _, err := NewPending("c1", r, supported, text, now); err != nil {
		t.Fatalf("err = %v", err)
	}
}

func TestGrantActivatesForTheTerm(t *testing.T) {
	granted, err := pending(t).Grant("bd-consent-1", text, now.Add(time.Minute))
	if err != nil {
		t.Fatalf("Grant: %v", err)
	}
	wantExpiry := now.Add(time.Minute).AddDate(0, 0, 365)
	if granted.Status != StatusActive || granted.ProviderConsentID != "bd-consent-1" ||
		!granted.GrantedAt.Equal(now.Add(time.Minute)) || !granted.ExpiresAt.Equal(wantExpiry) {
		t.Fatalf("granted %+v", granted)
	}
}

// Module test: a consent cannot become active without evidence and a known text version.
func TestGrantNeedsEvidenceAndTheTextThatWasAccepted(t *testing.T) {
	noEvidence := pending(t)
	noEvidence.Evidence = Evidence{}
	if _, err := noEvidence.Grant("p1", text, now); !errors.Is(err, ErrMissingEvidence) {
		t.Errorf("without evidence: err = %v", err)
	}
	otherText := text
	otherText.Version = "2026-11-v2"
	if _, err := pending(t).Grant("p1", otherText, now); !errors.Is(err, ErrUnknownTextVersion) {
		t.Errorf("other text version: err = %v", err)
	}
	changedText := text
	changedText.SHA256 = make([]byte, 32)
	if _, err := pending(t).Grant("p1", changedText, now); !errors.Is(err, ErrTextMismatch) {
		t.Errorf("changed text: err = %v", err)
	}
	if _, err := pending(t).Grant("", text, now); !errors.Is(err, ErrMissingProviderConsent) {
		t.Errorf("no provider consent id: err = %v", err)
	}
}

func TestOnlyAPendingConsentCanBeGranted(t *testing.T) {
	granted, _ := pending(t).Grant("p1", text, now)
	if _, err := granted.Grant("p1", text, now); !errors.Is(err, ErrNotPending) {
		t.Fatalf("err = %v", err)
	}
}

// HU-007 and module test: the status is up to date, and expiry happens after term_days.
func TestStatusAtReportsExpiryAfterTheTerm(t *testing.T) {
	c, _ := pending(t).Grant("p1", text, now)
	if c.StatusAt(now) != StatusActive || !c.ActiveAt(now) {
		t.Fatal("active right after the grant")
	}
	lastSecond := now.AddDate(0, 0, 365).Add(-time.Second)
	if c.StatusAt(lastSecond) != StatusActive {
		t.Fatal("still active one second before the term ends")
	}
	end := now.AddDate(0, 0, 365)
	if c.StatusAt(end) != StatusExpired || c.ActiveAt(end) {
		t.Fatal("expired when the term ends")
	}
	if p := pending(t); p.ActiveAt(now) || p.StatusAt(now) != StatusPending {
		t.Fatal("a pending consent is never active")
	}
}

func active(t *testing.T) Consent {
	t.Helper()
	c, err := pending(t).Grant("bd-1", text, now)
	if err != nil {
		t.Fatal(err)
	}
	return c
}

// HU-008: revocation takes effect at once and schedules the notice to the entity.
func TestRevokeStopsTheConsentAtOnceAndSchedulesTheNotice(t *testing.T) {
	at := now.Add(time.Hour)
	r, err := active(t).Revoke(ReasonUserRequest, at)
	if err != nil {
		t.Fatal(err)
	}
	if r.Status != StatusRevoked || !r.RevokedAt.Equal(at) || r.RevokedReason != "user_request" || r.ActiveAt(at) {
		t.Fatalf("revoked %+v", r)
	}
	if r.NextNotifyAt == nil || !r.NextNotifyAt.Equal(at.Add(NotifyRetryEvery)) || r.ProviderNotifiedAt != nil {
		t.Fatalf("notice not scheduled: %+v", r)
	}
}

func TestAPendingConsentIsRevokedWithoutANoticeToTheEntity(t *testing.T) {
	r, err := pending(t).Revoke(ReasonUserRequest, now)
	if err != nil || r.Status != StatusRevoked || r.NextNotifyAt != nil {
		t.Fatalf("revoked %+v, %v", r, err)
	}
}

func TestOnlyALiveConsentCanBeRevoked(t *testing.T) {
	r, _ := active(t).Revoke(ReasonUserRequest, now)
	if _, err := r.Revoke(ReasonUserRequest, now); !errors.Is(err, ErrAlreadyRevoked) {
		t.Errorf("twice: err = %v", err)
	}
	ended := now.AddDate(0, 0, 365)
	if _, err := active(t).Revoke(ReasonUserRequest, ended); !errors.Is(err, ErrNotRevocable) {
		t.Errorf("expired: err = %v", err)
	}
	failed := pending(t)
	failed.Status = StatusFailed
	if _, err := failed.Revoke(ReasonUserRequest, now); !errors.Is(err, ErrNotRevocable) {
		t.Errorf("failed: err = %v", err)
	}
}

// HU-008: when the entity cannot be reached, try again every 10 minutes for 24 hours.
func TestAFailedNoticeIsRetriedEveryTenMinutesForADay(t *testing.T) {
	r, _ := active(t).Revoke(ReasonUserRequest, now)
	r = r.NoticeFailed(now)
	if r.NotifyAttempts != 1 || !r.NextNotifyAt.Equal(now.Add(10*time.Minute)) {
		t.Fatalf("after one failure %+v", r)
	}
	late := now.Add(24*time.Hour - 5*time.Minute)
	if r = r.NoticeFailed(late); r.NextNotifyAt != nil {
		t.Fatalf("a retry after the 24 hours was scheduled: %v", r.NextNotifyAt)
	}
	ok, _ := active(t).Revoke(ReasonUserRequest, now)
	ok = ok.Notified(now.Add(time.Second))
	if ok.ProviderNotifiedAt == nil || ok.NextNotifyAt != nil {
		t.Fatalf("notified %+v", ok)
	}
}
