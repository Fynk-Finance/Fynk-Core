package service

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/link"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/store"
	consentports "github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/ports"
)

// linkEntity links the consent id with the given simulated entity and returns the link.
func (f *fixture) linkEntity(t *testing.T, provider *fakeProvider, consentID string) Linked {
	t.Helper()
	f.consents.pending[consentID] = consentports.Pending{ID: consentID, Provider: provider.id, Scopes: []string{"balances"}}
	s, err := f.svc.CreateAuthorization(context.Background(), owner, StartRequest{Provider: provider.id, ConsentID: consentID})
	if err != nil {
		t.Fatal(err)
	}
	l, err := f.svc.Exchange(context.Background(), owner, s.AuthorizationID, "code", "verifier")
	if err != nil {
		t.Fatal(err)
	}
	return l
}

// HU-058: several simulated links work at once, each one reads its own entity, and a revoked
// consent ends only its own link.
func TestSeveralSimulatedLinksWorkAndRevokingOneLeavesTheOthers(t *testing.T) {
	f := setup(t)
	coop := &fakeProvider{id: "cooperativa-demo", tokens: ports.TokenSet{
		AccessToken: "coop-access", RefreshToken: "coop-refresh", ExpiresIn: time.Minute, ProviderConsentID: "bank-consent-coop",
	}, accounts: []ports.Account{{ProviderAccountID: "coop-1"}}}
	f.bank.accounts = []ports.Account{{ProviderAccountID: "bd-1"}, {ProviderAccountID: "bd-2"}}
	f.svc = New(Deps{
		Providers: ProviderMap{"banco-demo": f.bank, "cooperativa-demo": coop}, Pending: f.consents, Consents: f.consents,
		Links: f.links, Authorizations: store.NewMemoryAuthorizations(f.clock), Fingerprints: f.fp,
		Limiter: store.NewMemoryLimits(f.clock), Nonces: store.NewMemoryLimits(f.clock),
		Audit: f.audit, Clock: f.clock, Log: slog.New(slog.NewTextHandler(io.Discard, nil)),
		RedirectURI: "fynk://bank/callback",
	})
	f.consents.active["c-1"], f.consents.active["c-coop"] = true, true

	bd := f.linkEntity(t, f.bank, "c-1")
	co := f.linkEntity(t, coop, "c-coop")
	if bd.Provider != "banco-demo" || co.Provider != "cooperativa-demo" {
		t.Fatalf("links %q and %q", bd.Provider, co.Provider)
	}
	ctx := context.Background()
	if got, err := f.svc.Accounts(ctx, owner, bd.LinkID, bd.AccessToken); err != nil || len(got) != 2 {
		t.Fatalf("banco-demo accounts %v, %v", got, err)
	}
	if got, err := f.svc.Accounts(ctx, owner, co.LinkID, co.AccessToken); err != nil || len(got) != 1 || got[0].ProviderAccountID != "coop-1" {
		t.Fatalf("cooperativa-demo accounts %v, %v", got, err)
	}

	f.consents.active["c-coop"] = false // revoking the Cooperativa Demo consent
	if _, err := f.svc.Accounts(ctx, owner, co.LinkID, co.AccessToken); !errors.Is(err, ErrConsentRevoked) {
		t.Fatalf("revoked entity: got %v, want consent_revoked", err)
	}
	if got, err := f.svc.Accounts(ctx, owner, bd.LinkID, bd.AccessToken); err != nil || len(got) != 2 {
		t.Fatalf("banco-demo after revoking the other: %v, %v", got, err)
	}
	stored, _ := f.links.Get(ctx, bd.LinkID)
	if stored.Status != link.StatusActive {
		t.Fatalf("banco-demo link status %v", stored.Status)
	}
}
