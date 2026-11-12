package store

import (
	"fmt"
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/domain"
)

// What a person does in the portal (HU-048) must reach Fynk through the same
// consent, entity by entity: GET accounts and GET transactions of that entity.

// linkedCustomer finds a customer with the given account types at providerID and
// activates a consent for that entity.
func linkedCustomer(t *testing.T, s *BankStore, providerID string, types ...domain.AccountType) (string, string) {
	t.Helper()
	for i := 0; i < 2000; i++ {
		id := fmt.Sprintf("sub-%04d", i)
		have := map[domain.AccountType]bool{}
		for _, a := range s.GetCustomer(id).Accounts {
			if a.ProviderID == providerID {
				have[a.Type] = true
			}
		}
		ok := len(have) > 0
		for _, ty := range types {
			ok = ok && have[ty]
		}
		if !ok {
			continue
		}
		consentID := "c-" + providerID + "-" + id
		s.CreatePendingConsent(consentID, "fynk", providerID, []string{"accounts", "transactions"}, "test", 365)
		if err := s.ActivateConsent(consentID, id); err != nil {
			t.Fatal(err)
		}
		return id, consentID
	}
	t.Fatalf("no customer with %v at %s", types, providerID)
	return "", ""
}

func accountOf(t *testing.T, s *BankStore, customerID, providerID string, ty domain.AccountType) domain.Account {
	t.Helper()
	for _, a := range s.GetCustomer(customerID).Accounts {
		if a.ProviderID == providerID && a.Type == ty {
			return a
		}
	}
	t.Fatalf("no %s at %s", ty, providerID)
	return domain.Account{}
}

// visibleTx returns the movements Fynk reads for an account, as a set of descriptions.
func visibleTx(t *testing.T, s *BankStore, consentID, accountID string) map[string]domain.Transaction {
	t.Helper()
	txs, _, _, err := s.GetTransactions(consentID, accountID, time.Now().Add(-24*time.Hour), "", 200)
	if err != nil {
		t.Fatalf("GET transactions of %s: %v", accountID, err)
	}
	out := map[string]domain.Transaction{}
	for _, tx := range txs {
		out[tx.Description] = tx
	}
	return out
}

func visibleAccounts(t *testing.T, s *BankStore, consentID string) map[string]domain.Account {
	t.Helper()
	accs, err := s.GetAccounts(consentID)
	if err != nil {
		t.Fatal(err)
	}
	out := map[string]domain.Account{}
	for _, a := range accs {
		out[a.ID] = a
	}
	return out
}

func TestPortalActions_ReachFynkThroughTheConsent(t *testing.T) {
	s := NewBankStore(time.Time{})
	p := domain.ProviderBancoDemo
	cust, consent := linkedCustomer(t, s, p, domain.AccountTypeSavings, domain.AccountTypeCreditCard)
	savings := accountOf(t, s, cust, p, domain.AccountTypeSavings)
	card := accountOf(t, s, cust, p, domain.AccountTypeCreditCard)
	if _, err := s.ReceiveMoney(cust, savings.ID, "FONDEO PRUEBA", 10_000_000_00); err != nil {
		t.Fatal(err)
	}

	t.Run("Registrar un pago", func(t *testing.T) {
		if _, err := s.RecordPayment(cust, savings.ID, "TIENDA PRUEBA", "shopping", 50_000_00); err != nil {
			t.Fatal(err)
		}
		tx, ok := visibleTx(t, s, consent, savings.ID)["PAGO TIENDA PRUEBA"]
		if !ok || tx.ProviderID != p {
			t.Errorf("payment not visible to Fynk with provider %s: %+v", p, tx)
		}
	})

	t.Run("Pagar tarjeta", func(t *testing.T) {
		if err := s.PayCard(cust, savings.ID, card.ID, 20_000_00); err != nil {
			t.Fatal(err)
		}
		if _, ok := visibleTx(t, s, consent, card.ID)["ABONO PAGO TARJETA DE CREDITO"]; !ok {
			t.Error("card credit not visible to Fynk")
		}
		if visibleAccounts(t, s, consent)[card.ID].BalanceMinor != card.BalanceMinor+20_000_00 {
			t.Error("card debt did not go down in GET accounts")
		}
	})

	t.Run("Abrir CDT", func(t *testing.T) {
		before := visibleAccounts(t, s, consent)
		if err := s.OpenCDT(cust, savings.ID, "cdt-demo-90", 1_000_000_00); err != nil {
			t.Fatal(err)
		}
		var opened *domain.Account
		for id, a := range visibleAccounts(t, s, consent) {
			if _, old := before[id]; !old && a.Type == domain.AccountTypeCDT {
				a := a
				opened = &a
			}
		}
		if opened == nil {
			t.Fatal("the new CDT is not in GET accounts of the consent")
		}
		if opened.ProviderID != p || opened.CDT == nil || opened.BalanceMinor != 1_000_000_00 {
			t.Errorf("unexpected CDT: %+v", opened)
		}
		if _, _, _, err := s.GetTransactions(consent, opened.ID, time.Time{}, "", 50); err != nil {
			t.Errorf("GET transactions of the new CDT: %v", err)
		}
	})
}

// A transfer between two entities of the same person shows on both sides.
func TestPortalTransfer_ShowsAtBothEntities(t *testing.T) {
	s := NewBankStore(time.Time{})
	for i := 0; i < 2000; i++ {
		cust := fmt.Sprintf("sub-%04d", i)
		var bd, coop *domain.Account
		for _, a := range s.GetCustomer(cust).Accounts {
			a := a
			if a.Type != domain.AccountTypeSavings {
				continue
			}
			switch a.ProviderID {
			case domain.ProviderBancoDemo:
				bd = &a
			case domain.ProviderCooperativaDemo:
				coop = &a
			}
		}
		if bd == nil || coop == nil {
			continue
		}
		for _, p := range []string{domain.ProviderBancoDemo, domain.ProviderCooperativaDemo} {
			s.CreatePendingConsent("c-"+p, "fynk", p, []string{"accounts", "transactions"}, "test", 365)
			if err := s.ActivateConsent("c-"+p, cust); err != nil {
				t.Fatal(err)
			}
		}
		if err := s.TransferOwn(cust, bd.ID, coop.ID, 10_000_00); err != nil {
			t.Fatal(err)
		}
		out := visibleTx(t, s, "c-"+domain.ProviderBancoDemo, bd.ID)["TRANSFERENCIA A "+coop.Name]
		in := visibleTx(t, s, "c-"+domain.ProviderCooperativaDemo, coop.ID)["TRANSFERENCIA DESDE "+bd.Name]
		if out.ProviderID != domain.ProviderBancoDemo || in.ProviderID != domain.ProviderCooperativaDemo {
			t.Errorf("transfer movements: out %+v, in %+v", out, in)
		}
		return
	}
	t.Fatal("no customer with savings at Banco Demo and Cooperativa Demo")
}

// A CDT opened from another entity's account is held where the money came from,
// so it shows in that entity's link.
func TestOpenCDT_BelongsToTheFundingEntity(t *testing.T) {
	s := NewBankStore(time.Time{})
	p := domain.ProviderCooperativaDemo
	cust, consent := linkedCustomer(t, s, p, domain.AccountTypeSavings)
	from := accountOf(t, s, cust, p, domain.AccountTypeSavings)
	if _, err := s.ReceiveMoney(cust, from.ID, "FONDEO PRUEBA", 5_000_000_00); err != nil {
		t.Fatal(err)
	}
	if err := s.OpenCDT(cust, from.ID, "cdt-demo-90", 1_000_000_00); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, a := range visibleAccounts(t, s, consent) {
		found = found || (a.Type == domain.AccountTypeCDT && a.ProviderID == p)
	}
	if !found {
		t.Error("CDT opened from a Cooperativa Demo account is not in that link")
	}
}
