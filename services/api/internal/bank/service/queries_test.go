package service

import (
	"context"
	"errors"
	"testing"
	"time"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/link"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
	consentports "github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/ports"
)

var owner = User{userA, deviceA}

// linkWith links consent id with the bank answering refresh as the refresh token.
func (f *fixture) linkWith(t *testing.T, consentID, refresh string) Linked {
	t.Helper()
	f.consents.pending[consentID] = consentports.Pending{ID: consentID, Provider: "banco-demo", Scopes: []string{"balances"}}
	f.bank.tokens = ports.TokenSet{AccessToken: "access-" + refresh, RefreshToken: refresh, ExpiresIn: time.Minute}
	s, err := f.svc.CreateAuthorization(context.Background(), owner, StartRequest{Provider: "banco-demo", ConsentID: consentID})
	if err != nil {
		t.Fatal(err)
	}
	l, err := f.svc.Exchange(context.Background(), owner, s.AuthorizationID, "code", "verifier")
	if err != nil {
		t.Fatal(err)
	}
	return l
}

func TestAccountsComeThroughForTheOwnerAndAreAudited(t *testing.T) {
	f := setup(t)
	l := f.link(t)
	f.bank.accounts = []ports.Account{{ProviderAccountID: "acc-1"}, {ProviderAccountID: "acc-2"}}
	got, err := f.svc.Accounts(context.Background(), owner, l.LinkID, "access-1")
	if err != nil || len(got) != 2 {
		t.Fatalf("got %v %v", got, err)
	}
	last := f.audit.events[len(f.audit.events)-1]
	if last.Type != audit.BankSync || last.Meta["accounts_count"] != "2" || last.Meta["provider"] != "banco-demo" {
		t.Fatalf("event = %+v", last)
	}
}

func TestARevokedConsentAnswersConsentRevokedAndEndsTheLink(t *testing.T) {
	f := setup(t)
	l := f.link(t)
	f.consents.active["c-1"] = false // M4 revoked it
	if _, err := f.svc.Accounts(context.Background(), owner, l.LinkID, "access-1"); !errors.Is(err, ErrConsentRevoked) {
		t.Fatalf("got %v, want consent_revoked", err)
	}
	stored, _ := f.links.Get(context.Background(), l.LinkID)
	if stored.Status != link.StatusRevoked {
		t.Fatal("the link must end with its consent")
	}
	f.consents.active["c-1"] = true // even if M4 answered otherwise, an ended link stays ended
	if _, err := f.svc.Transactions(context.Background(), owner, l.LinkID, "a", "acc", time.Time{}, ""); !errors.Is(err, ErrConsentRevoked) {
		t.Fatalf("after the link ended: got %v", err)
	}
}

func TestTheBankRefusingTheConsentEndsTheLinkToo(t *testing.T) {
	f := setup(t)
	l := f.link(t)
	f.bank.err = ports.ErrConsentRevoked
	if _, err := f.svc.Transactions(context.Background(), owner, l.LinkID, "a", "acc", time.Time{}, ""); !errors.Is(err, ErrConsentRevoked) {
		t.Fatalf("got %v", err)
	}
	stored, _ := f.links.Get(context.Background(), l.LinkID)
	if stored.Status != link.StatusRevoked {
		t.Fatal("the link must end")
	}
	last := f.audit.events[len(f.audit.events)-1]
	if last.Type != audit.BankSyncFailed || last.Meta["error_code"] != "consent_revoked" {
		t.Fatalf("event = %+v", last)
	}
}

func TestOnlyTheOwnerOnItsDeviceCanUseTheLink(t *testing.T) {
	f := setup(t)
	l := f.link(t)
	ctx := context.Background()
	for name, u := range map[string]User{"another user": {userB, deviceB}, "another device": {userA, deviceB}} {
		if _, err := f.svc.Accounts(ctx, u, l.LinkID, "access-1"); !errors.Is(err, ErrLinkNotFound) {
			t.Errorf("%s: got %v, want link_not_found", name, err)
		}
		if _, err := f.svc.Refresh(ctx, u, l.LinkID, "refresh-1"); !errors.Is(err, ErrLinkNotFound) {
			t.Errorf("%s refresh: got %v, want link_not_found", name, err)
		}
	}
}

func TestARefreshTokenOfAnotherLinkIsRejected(t *testing.T) {
	f := setup(t)
	mine := f.linkWith(t, "c-1", "refresh-mine")
	f.linkWith(t, "c-2", "refresh-other")
	if _, err := f.svc.Refresh(context.Background(), owner, mine.LinkID, "refresh-other"); !errors.Is(err, ErrRefreshMismatch) {
		t.Fatalf("got %v, want refresh_token_mismatch", err)
	}
	if len(f.bank.refreshes) != 0 {
		t.Fatal("a token that is not the link's must never reach the bank")
	}
}

func TestARefreshRotatesTheFingerprintSoTheOldTokenStopsWorking(t *testing.T) {
	f := setup(t)
	l := f.linkWith(t, "c-1", "refresh-1")
	ctx := context.Background()
	f.bank.tokens = ports.TokenSet{AccessToken: "access-2", RefreshToken: "refresh-2", ExpiresIn: time.Minute}
	got, err := f.svc.Refresh(ctx, owner, l.LinkID, "refresh-1")
	if err != nil {
		t.Fatal(err)
	}
	if got.AccessToken != "access-2" || got.RefreshToken != "refresh-2" || got.LinkID != l.LinkID {
		t.Fatalf("got %+v", got)
	}
	if _, err := f.svc.Refresh(ctx, owner, l.LinkID, "refresh-1"); !errors.Is(err, ErrRefreshMismatch) {
		t.Fatalf("the old token: got %v, want refresh_token_mismatch", err)
	}
	f.bank.tokens = ports.TokenSet{AccessToken: "access-3", RefreshToken: "refresh-3"}
	if _, err := f.svc.Refresh(ctx, owner, l.LinkID, "refresh-2"); err != nil {
		t.Fatalf("the new token: %v", err)
	}
	last := f.audit.events[len(f.audit.events)-1]
	if last.Type != audit.BankTokenRefreshed || last.Meta["provider"] != "banco-demo" {
		t.Fatalf("event = %+v", last)
	}
}

func TestThirtyQueriesAMinutePerUserThenRetryAfter(t *testing.T) {
	f := setup(t)
	l := f.link(t)
	ctx := context.Background()
	for i := range QueriesPerMinute {
		if _, err := f.svc.Accounts(ctx, owner, l.LinkID, "a"); err != nil {
			t.Fatalf("query %d: %v", i+1, err)
		}
	}
	_, err := f.svc.Accounts(ctx, owner, l.LinkID, "a")
	var limited *RateLimited
	if !errors.As(err, &limited) || limited.RetryAfter <= 0 || limited.RetryAfter > time.Minute {
		t.Fatalf("the 31st query: got %v", err)
	}
	f.clock.Advance(time.Minute)
	if _, err := f.svc.Accounts(ctx, owner, l.LinkID, "a"); err != nil {
		t.Fatalf("after the minute: %v", err)
	}
}

func TestTheBanksOwnRateLimitIsPassedBack(t *testing.T) {
	f := setup(t)
	l := f.link(t)
	f.bank.err = &ports.RateLimitedError{RetryAfter: 7 * time.Second}
	_, err := f.svc.Accounts(context.Background(), owner, l.LinkID, "a")
	var limited *RateLimited
	if !errors.As(err, &limited) || limited.RetryAfter != 7*time.Second {
		t.Fatalf("got %v", err)
	}
}

func TestAReplayedNonceIsRejected(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	if err := f.svc.CheckNonce(ctx, owner, "nonce-0123456789abcdef"); err != nil {
		t.Fatal(err)
	}
	if err := f.svc.CheckNonce(ctx, owner, "nonce-0123456789abcdef"); !errors.Is(err, ErrReplayed) {
		t.Fatalf("replay: got %v, want replayed_request", err)
	}
	f.clock.Advance(NonceTTL)
	if err := f.svc.CheckNonce(ctx, owner, "nonce-0123456789abcdef"); err != nil {
		t.Fatalf("after 5 minutes: %v", err)
	}
	for _, n := range []string{"", "short"} {
		if err := f.svc.CheckNonce(ctx, owner, n); !errors.Is(err, ErrNonceRequired) {
			t.Fatalf("%q: got %v, want nonce_required", n, err)
		}
	}
}
