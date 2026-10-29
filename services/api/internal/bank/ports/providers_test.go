package ports

import (
	"errors"
	"fmt"
	"testing"
	"time"
)

// HU-009: the user chooses the entity, and the simulated ones say so.
func TestTheSimulatedBankAndWalletAreListedWithTheirScopes(t *testing.T) {
	list := Providers()
	if len(list) != 2 || list[0].ID != "banco-demo" || list[1].ID != "billetera-demo" {
		t.Fatalf("providers %+v", list)
	}
	want := map[string]Kind{"banco-demo": KindBank, "billetera-demo": KindWallet}
	for _, p := range list {
		if p.Kind != want[p.ID] || !p.IsSimulated || p.LogoKey != p.ID || p.DisplayName == "" {
			t.Errorf("%s: %+v", p.ID, p)
		}
		if len(p.Scopes) != 3 || p.Scopes[0] != ScopeBalances || p.Scopes[1] != ScopeTransactions || p.Scopes[2] != ScopeAccountDetails {
			t.Errorf("%s: scopes %v", p.ID, p.Scopes)
		}
	}
}

// Bancolombia is listed only once its adapter works (M5 work plan step 5).
func TestAProviderWithoutAWorkingAdapterIsNotOffered(t *testing.T) {
	if _, ok := Lookup("bancolombia"); ok {
		t.Fatal("bancolombia must not be offered before its adapter exists")
	}
	if _, ok := Lookup("otro-banco"); ok {
		t.Fatal("unknown provider")
	}
	if p, ok := Lookup("billetera-demo"); !ok || p.Kind != KindWallet {
		t.Fatalf("Lookup = %+v, %v", p, ok)
	}
}

func TestCallersCannotChangeTheCatalog(t *testing.T) {
	list := Providers()
	list[0].DisplayName = "Otro"
	list[0].Scopes[0] = "payments"
	again, _ := Lookup("banco-demo")
	if again.DisplayName != "Banco Demo" || again.Scopes[0] != ScopeBalances {
		t.Fatalf("catalog changed: %+v", again)
	}
}

func TestBankErrorsKeepTheirCodeThroughWrapping(t *testing.T) {
	wrapped := fmt.Errorf("bankdemo: accounts: %w", ErrConsentRevoked)
	if !errors.Is(wrapped, ErrConsentRevoked) || ErrConsentRevoked.Code != "consent_revoked" {
		t.Fatalf("consent revoked: %v", wrapped)
	}
	var limited *RateLimitedError
	err := fmt.Errorf("query: %w", &RateLimitedError{RetryAfter: 30 * time.Second})
	if !errors.As(err, &limited) || limited.RetryAfter != 30*time.Second || limited.Code() != "rate_limited" {
		t.Fatalf("rate limited: %v", err)
	}
	if ErrProviderUnavailable.Code != "provider_unavailable" {
		t.Fatal(ErrProviderUnavailable)
	}
}
