package domain

import (
	"reflect"
	"testing"
	"time"
)

// monthKey is year*12+month, used to group transactions by month.
func monthKey(t time.Time) int { return t.Year()*12 + int(t.Month()) }

func lastCompleteMonths(ref time.Time, n int) []int {
	var out []int
	for k := 1; k <= n; k++ {
		out = append(out, monthKey(ref)-k)
	}
	return out
}

// byAccount returns each account's transactions oldest first.
func byAccount(d *CustomerData) map[string][]Transaction {
	out := map[string][]Transaction{}
	for i := len(d.Transactions) - 1; i >= 0; i-- {
		tx := d.Transactions[i]
		out[tx.AccountID] = append(out[tx.AccountID], tx)
	}
	return out
}

func TestHistoryDeterministic(t *testing.T) {
	a := GenerateCustomerData("sub-0042", testRef)
	b := GenerateCustomerData("sub-0042", testRef)
	if !reflect.DeepEqual(a, b) {
		t.Fatal("same customer gave different history")
	}
}

func TestHistoryBalancesAndLimits(t *testing.T) {
	for i := 0; i < manyCustomers; i++ {
		id := testCustomerID(i)
		d := GenerateCustomerData(id, testRef)
		txs := byAccount(d)
		for _, a := range d.Accounts {
			var running, total int64
			for _, tx := range txs[a.ID] {
				total += tx.AmountMinor
			}
			if total != a.BalanceMinor {
				t.Fatalf("%s: %s sums %d, balance %d", id, a.ID, total, a.BalanceMinor)
			}
			// Opening balance is the first transaction, so start at zero.
			for _, tx := range txs[a.ID] {
				running += tx.AmountMinor
				switch a.Type {
				case AccountTypeSavings, AccountTypeWallet:
					if running < 0 {
						t.Fatalf("%s: %s negative at %s: %d", id, a.ID, tx.BookingDateTime, running)
					}
				case AccountTypeCreditCard:
					if running > 0 || -running > *a.CreditLimitMinor {
						t.Fatalf("%s: card %s balance %d with limit %d", id, a.ID, running, *a.CreditLimitMinor)
					}
				}
			}
		}
	}
}

func TestHistoryFixedItems(t *testing.T) {
	months := lastCompleteMonths(testRef, 12)
	for i := 0; i < manyCustomers; i++ {
		id := testCustomerID(i)
		d := GenerateCustomerData(id, testRef)
		providers := map[string]string{}
		var savings, card string
		hasWallet := false
		for _, a := range d.Accounts {
			providers[a.ID] = a.ProviderID
			hasWallet = hasWallet || a.Type == AccountTypeWallet
			if a.ProviderID == ProviderBancoDemo && a.Type == AccountTypeSavings {
				savings = a.ID
			}
			if a.ProviderID == ProviderBancoDemo && a.Type == AccountTypeCreditCard {
				card = a.ID
			}
		}

		if len(d.Subscriptions) < 4 {
			t.Fatalf("%s: %d subscriptions", id, len(d.Subscriptions))
		}
		seen := map[string]map[int]bool{} // "account|merchant" -> months
		categories := map[string]map[int]bool{}
		transport := map[string]bool{}
		var paired int64
		for j, tx := range d.Transactions {
			if tx.ProviderID != providers[tx.AccountID] || !tx.Simulated {
				t.Fatalf("%s: bad provider or flag on %+v", id, tx)
			}
			if j > 0 && tx.BookingDateTime.After(d.Transactions[j-1].BookingDateTime) {
				t.Fatalf("%s: transactions not newest first at %d", id, j)
			}
			k := monthKey(tx.BookingDateTime)
			if tx.MerchantName != nil {
				key := tx.AccountID + "|" + *tx.MerchantName
				if seen[key] == nil {
					seen[key] = map[int]bool{}
				}
				seen[key][k] = true
			}
			if tx.Category != nil {
				c := *tx.Category
				if tx.AccountID == savings {
					if categories[c] == nil {
						categories[c] = map[int]bool{}
					}
					categories[c][k] = true
				}
				if c == "transport" {
					transport[tx.AccountID] = true
				}
				if c == "transfers" || c == "card_payment" || c == "savings" {
					paired += tx.AmountMinor
				}
			}
		}
		if paired != 0 {
			t.Fatalf("%s: transfers between own accounts do not appear on both sides (%d)", id, paired)
		}
		ids := map[string]bool{}
		for _, tx := range d.Transactions {
			if ids[tx.ID] {
				t.Fatalf("%s: duplicate transaction id %s", id, tx.ID)
			}
			ids[tx.ID] = true
		}

		for _, s := range d.Subscriptions {
			for _, k := range months {
				if !seen[s.AccountID+"|"+s.Merchant][k] {
					t.Fatalf("%s: %s missing in month %d on %s", id, s.Merchant, k, s.AccountID)
				}
			}
		}
		for _, c := range []string{"salary", "rent"} {
			for _, k := range months {
				if !categories[c][k] {
					t.Fatalf("%s: no %s in month %d", id, c, k)
				}
			}
		}
		if !hasWallet && !transport[card] {
			t.Fatalf("%s: no wallet but transport is not on the card", id)
		}
		if hasWallet && transport[card] {
			t.Fatalf("%s: transport on the card although the user has a wallet", id)
		}
	}
}

func TestHistoryRunsFast(t *testing.T) {
	start := time.Now()
	for i := 0; i < manyCustomers; i++ {
		GenerateCustomerData(testCustomerID(i), testRef)
	}
	if d := time.Since(start); d > 20*time.Second {
		t.Fatalf("1000 customers took %s", d)
	}
}
