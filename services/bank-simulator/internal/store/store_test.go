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

func TestTakeRefreshToken_WorksOnceAndOnlyForRefreshTokens(t *testing.T) {
	s := NewBankStore(time.Time{})
	s.IssueToken("rt-live", TokenRecord{Kind: TokenKindRefresh, ConsentID: "c1", ExpiresAt: time.Now().Add(time.Minute)})
	s.IssueToken("rt-dead", TokenRecord{Kind: TokenKindRefresh, ConsentID: "c1", ExpiresAt: time.Now().Add(-time.Second)})
	s.IssueToken("at-live", TokenRecord{Kind: TokenKindAccess, ConsentID: "c1", ExpiresAt: time.Now().Add(time.Minute)})

	if rec, ok := s.TakeRefreshToken("rt-live"); !ok || rec.ConsentID != "c1" {
		t.Errorf("live refresh token not found: %+v", rec)
	}
	if _, ok := s.TakeRefreshToken("rt-live"); ok {
		t.Error("a refresh token must work once")
	}
	if _, ok := s.TakeRefreshToken("rt-dead"); ok {
		t.Error("an expired refresh token must count as missing")
	}
	if _, ok := s.TakeRefreshToken("at-live"); ok {
		t.Error("an access token is not a refresh token")
	}
	if _, ok := s.LookupToken("at-live"); !ok {
		t.Error("an access token must survive a wrong refresh attempt")
	}
}

// Fynk reads movements while the person acts in the portal. Run with -race (CI does): reading
// the customer's movements outside the store lock is a data race with RecordPayment.
func TestGetTransactions_IsSafeWhileThePortalWrites(t *testing.T) {
	s := NewBankStore(time.Time{})
	p := domain.ProviderBancoDemo
	cust, consent := linkedCustomer(t, s, p, domain.AccountTypeSavings)
	savings := accountOf(t, s, cust, p, domain.AccountTypeSavings)
	if _, err := s.ReceiveMoney(cust, savings.ID, "FONDEO PRUEBA", 1_000_000_00); err != nil {
		t.Fatal(err)
	}

	done := make(chan struct{})
	go func() {
		defer close(done)
		for i := 0; i < 200; i++ {
			if _, err := s.RecordPayment(cust, savings.ID, "TIENDA", "shopping", 1_00); err != nil {
				t.Errorf("payment %d: %v", i, err)
				return
			}
		}
	}()
	for i := 0; i < 200; i++ {
		if _, _, _, err := s.GetTransactions(consent, savings.ID, time.Time{}, "", 50); err != nil {
			t.Fatalf("read %d: %v", i, err)
		}
	}
	<-done

	txs, _, _, err := s.GetTransactions(consent, savings.ID, time.Now().Add(-time.Hour), "", 200)
	if err != nil {
		t.Fatal(err)
	}
	payments := 0
	for _, tx := range txs {
		if tx.Description == "PAGO TIENDA" {
			payments++
		}
	}
	if payments != 200 {
		t.Errorf("Fynk sees %d of the 200 payments", payments)
	}
}
