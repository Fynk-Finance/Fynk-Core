package domain

import (
	"fmt"
	"reflect"
	"testing"
	"time"
)

var testRef = time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC)

const manyCustomers = 1000

func testCustomerID(i int) string { return fmt.Sprintf("sub-%04d", i) }

func pesos(n int64) int64 { return n * 100 }

func accountsOf(data *CustomerData, provider string, t AccountType) []Account {
	var out []Account
	for _, a := range data.Accounts {
		if a.ProviderID == provider && a.Type == t {
			out = append(out, a)
		}
	}
	return out
}

func inRange(minor, minPesos, maxPesos int64) bool {
	return minor%100 == 0 && minor >= pesos(minPesos) && minor <= pesos(maxPesos)
}

func TestEntitiesDeterministic(t *testing.T) {
	a := GenerateCustomerData("sub-0042", testRef)
	b := GenerateCustomerData("sub-0042", testRef)
	if !reflect.DeepEqual(a, b) {
		t.Fatal("same customer gave different data")
	}
}

func TestEntitiesDifferBetweenCustomers(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 50; i++ {
		d := GenerateCustomerData(testCustomerID(i), testRef)
		key := ""
		for _, acc := range d.Accounts {
			key += fmt.Sprintf("%s/%s/%d;", acc.ProviderID, acc.Type, acc.BalanceMinor)
		}
		seen[key] = true
	}
	if len(seen) < 40 {
		t.Fatalf("only %d distinct results over 50 customers", len(seen))
	}
}

func TestEntitiesDoNotDependOnEachOther(t *testing.T) {
	// Each entity's accounts depend only on the customer id and the provider id.
	id := "sub-0007"
	full := GenerateCustomerData(id, testRef)
	for _, e := range entities {
		again := entityAccounts(id, e, testRef)
		var got []Account
		for _, a := range full.Accounts {
			if a.ProviderID == e.ProviderID {
				got = append(got, a)
			}
		}
		if len(got) > 0 && !reflect.DeepEqual(got, again) {
			t.Fatalf("accounts of %s depend on other entities", e.ProviderID)
		}
	}
}

func TestEntitiesRulesOverManyCustomers(t *testing.T) {
	known := map[string]bool{}
	for _, e := range entities {
		known[e.ProviderID] = true
	}
	products := DefaultCdtProducts()
	present := map[string]int{}
	drawn := map[string]int{}

	for i := 0; i < manyCustomers; i++ {
		id := testCustomerID(i)
		d := GenerateCustomerData(id, testRef)

		if len(accountsOf(d, ProviderBancoDemo, AccountTypeSavings)) != 1 || len(accountsOf(d, ProviderBancoDemo, AccountTypeCreditCard)) != 1 {
			t.Fatalf("%s: Banco Demo must have Ahorros and a card", id)
		}
		bil, dig, coop := drawPresence(id)
		for p, ok := range map[string]bool{ProviderBilleteraDemo: bil, ProviderBancoDigitalDemo: dig, ProviderCooperativaDemo: coop} {
			if ok {
				drawn[p]++
			}
		}
		sums := EntitySummaries(d)
		if len(sums) < 2 {
			t.Fatalf("%s: fewer than 2 entities", id)
		}
		for _, s := range sums {
			present[s.ProviderID]++
		}

		perType := map[string]int{}
		for _, a := range d.Accounts {
			if !a.Simulated || !known[a.ProviderID] || a.CustomerID != id {
				t.Fatalf("%s: bad account flags %+v", id, a)
			}
			if a.BalanceMinor%100 != 0 {
				t.Fatalf("%s: balance not in whole pesos", id)
			}
			key := a.ProviderID + "/" + string(a.Type)
			perType[key]++
			if perType[key] > 1 {
				t.Fatalf("%s: two accounts of one type in %s", id, a.ProviderID)
			}
			checkAccountRange(t, id, a, products)
		}
	}

	// The check uses the random draw. The fallback rule adds Billetera Demo on top of it.
	check := func(provider string, pct float64) {
		got := float64(drawn[provider]) / manyCustomers * 100
		if got < pct-8 || got > pct+8 {
			t.Errorf("%s presence %.1f%%, want %v%% +/- 8", provider, got, pct)
		}
	}
	if present[ProviderBancoDemo] != manyCustomers {
		t.Errorf("Banco Demo not always present")
	}
	check(ProviderBilleteraDemo, PctBilletera)
	check(ProviderBancoDigitalDemo, PctBancoDigital)
	check(ProviderCooperativaDemo, PctCooperativa)
}

func checkAccountRange(t *testing.T, id string, a Account, products []CdtProduct) {
	t.Helper()
	switch {
	case a.Type == AccountTypeSavings && a.ProviderID == ProviderBancoDemo:
		if !inRange(a.BalanceMinor, bancoDemoSavingsMin, bancoDemoSavingsMax) {
			t.Fatalf("%s: Banco Demo Ahorros out of range: %d", id, a.BalanceMinor)
		}
	case a.Type == AccountTypeSavings && a.ProviderID == ProviderBancoDigitalDemo:
		if !inRange(a.BalanceMinor, digitalSavingsMin, digitalSavingsMax) {
			t.Fatalf("%s: Banco Digital Ahorros out of range: %d", id, a.BalanceMinor)
		}
	case a.Type == AccountTypeSavings && a.ProviderID == ProviderCooperativaDemo:
		if !inRange(a.BalanceMinor, coopSavingsMin, coopSavingsMax) {
			t.Fatalf("%s: Cooperativa Ahorros out of range: %d", id, a.BalanceMinor)
		}
	case a.Type == AccountTypeWallet:
		if a.ProviderID != ProviderBilleteraDemo || !inRange(a.BalanceMinor, walletMin, walletMax) {
			t.Fatalf("%s: wallet out of range: %d", id, a.BalanceMinor)
		}
	case a.Type == AccountTypeCreditCard:
		if a.CreditLimitMinor == nil || a.PaymentDueDate == nil {
			t.Fatalf("%s: card without limit or due day", id)
		}
		limit := *a.CreditLimitMinor
		if !inRange(limit, cardLimitMin, cardLimitMax) || limit%pesos(cardLimitStepPesos) != 0 {
			t.Fatalf("%s: card limit %d", id, limit)
		}
		debt := -a.BalanceMinor
		if debt < 0 || debt >= limit || debt%100 != 0 {
			t.Fatalf("%s: card debt %d with limit %d", id, debt, limit)
		}
		if a.AvailableMinor != limit-debt {
			t.Fatalf("%s: card available %d", id, a.AvailableMinor)
		}
	case a.Type == AccountTypeCDT:
		if a.ProviderID != ProviderBancoDemo || a.CDT == nil {
			t.Fatalf("%s: bad CDT", id)
		}
		if !inRange(a.BalanceMinor, cdtAmountMin, cdtAmountMax) || a.BalanceMinor%pesos(cdtAmountStepPesos) != 0 {
			t.Fatalf("%s: CDT amount %d", id, a.BalanceMinor)
		}
		ok := false
		for _, p := range products {
			if p.TermDays == a.CDT.TermDays && p.RateEaBps == a.CDT.RateEaBps && a.BalanceMinor >= p.MinAmountMinor {
				ok = true
			}
		}
		if !ok {
			t.Fatalf("%s: CDT does not match a product: %+v", id, a.CDT)
		}
	default:
		t.Fatalf("%s: unexpected account %s/%s", id, a.ProviderID, a.Type)
	}
}

func TestEntitiesTransactionsAddUpToBalance(t *testing.T) {
	for i := 0; i < manyCustomers; i++ {
		id := testCustomerID(i)
		d := GenerateCustomerData(id, testRef)
		sums := map[string]int64{}
		providers := map[string]string{}
		for _, a := range d.Accounts {
			providers[a.ID] = a.ProviderID
		}
		for _, tx := range d.Transactions {
			sums[tx.AccountID] += tx.AmountMinor
			if !tx.Simulated || tx.ProviderID != providers[tx.AccountID] {
				t.Fatalf("%s: bad transaction %+v", id, tx)
			}
		}
		for _, a := range d.Accounts {
			if sums[a.ID] != a.BalanceMinor {
				t.Fatalf("%s: %s sums %d, balance %d", id, a.ID, sums[a.ID], a.BalanceMinor)
			}
		}
	}
}

func TestEntitySummaries(t *testing.T) {
	d := GenerateCustomerData(DemoCustomerID, testRef)
	sums := EntitySummaries(d)
	if len(sums) != 2 || sums[0].ProviderID != ProviderBancoDemo || sums[0].AccountCount != 3 ||
		sums[1].ProviderID != ProviderBilleteraDemo || sums[1].AccountCount != 1 || sums[1].Kind != EntityKindWallet {
		t.Fatalf("unexpected summaries: %+v", sums)
	}
}

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
