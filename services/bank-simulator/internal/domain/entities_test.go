package domain

import (
	"testing"
	"time"
)

var testRef = time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC)

func TestDemoUserHasProviderIDs(t *testing.T) {
	d := GenerateCustomerData(DemoCustomerID, testRef)
	provider := map[string]string{}
	for _, a := range d.Accounts {
		want := ProviderBancoDemo
		if a.Type == AccountTypeWallet {
			want = ProviderBilleteraDemo
		}
		if a.ProviderID != want {
			t.Fatalf("account %s has provider %q, want %q", a.ID, a.ProviderID, want)
		}
		provider[a.ID] = want
	}
	for _, tx := range d.Transactions {
		if tx.ProviderID != provider[tx.AccountID] {
			t.Fatalf("transaction %s has provider %q", tx.ID, tx.ProviderID)
		}
	}
}
