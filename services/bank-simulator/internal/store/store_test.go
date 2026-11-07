package store

import (
	"errors"
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/domain"
)

func TestLookupToken_ExpiredIsMissing(t *testing.T) {
	s := NewBankStore(time.Time{})
	s.IssueToken("at-live", TokenRecord{Kind: TokenKindAccess, ConsentID: "c1", ExpiresAt: time.Now().Add(time.Minute)})
	s.IssueToken("at-dead", TokenRecord{Kind: TokenKindAccess, ConsentID: "c1", ExpiresAt: time.Now().Add(-time.Second)})

	if rec, ok := s.LookupToken("at-live"); !ok || rec.ConsentID != "c1" {
		t.Errorf("live token not found: %+v", rec)
	}
	if _, ok := s.LookupToken("at-dead"); ok {
		t.Error("expired token must count as missing")
	}
	if _, ok := s.LookupToken("at-never-issued"); ok {
		t.Error("unknown token must be missing")
	}
}

func TestActivateConsent_SetsCustomerAndStatus(t *testing.T) {
	s := NewBankStore(time.Time{})
	s.CreatePendingConsent("c-pending", "fynk", domain.ProviderBancoDemo, []string{"accounts"}, "test", 365)
	if err := s.ActivateConsent("c-pending", "sub-0001"); err != nil {
		t.Fatal(err)
	}
	c, _ := s.GetConsent("c-pending")
	if c.Status != domain.ConsentStatusActive || c.CustomerID != "sub-0001" || c.GrantedAt.IsZero() {
		t.Errorf("unexpected consent: %+v", c)
	}
	if err := s.ActivateConsent("c-pending", "sub-0001"); !errors.Is(err, ErrConsentNotAuthorized) {
		t.Errorf("activating twice: expected ErrConsentNotAuthorized, got %v", err)
	}
	if err := s.ActivateConsent("nope", "sub-0001"); !errors.Is(err, ErrConsentNotFound) {
		t.Errorf("unknown consent: got %v", err)
	}
}
