package domain

import (
	"testing"
	"time"
)

func TestGeneratorDeterminism(t *testing.T) {
	refTime := time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC)
	customerID := "cliente.demo@bancodemo.local"

	run1 := GenerateCustomerData(customerID, refTime)
	run2 := GenerateCustomerData(customerID, refTime)

	if len(run1.Accounts) != len(run2.Accounts) {
		t.Fatalf("account count mismatch: %d vs %d", len(run1.Accounts), len(run2.Accounts))
	}
	if len(run1.Transactions) != len(run2.Transactions) {
		t.Fatalf("transaction count mismatch: %d vs %d", len(run1.Transactions), len(run2.Transactions))
	}

	for i := range run1.Accounts {
		a1 := run1.Accounts[i]
		a2 := run2.Accounts[i]
		if a1.ID != a2.ID || a1.BalanceMinor != a2.BalanceMinor {
			t.Fatalf("account mismatch at %d: %+v vs %+v", i, a1, a2)
		}
	}

	for i := range run1.Transactions {
		tx1 := run1.Transactions[i]
		tx2 := run2.Transactions[i]
		if tx1.ID != tx2.ID || tx1.AmountMinor != tx2.AmountMinor || !tx1.BookingDateTime.Equal(tx2.BookingDateTime) {
			t.Fatalf("transaction mismatch at %d: %+v vs %+v", i, tx1, tx2)
		}
	}
}

func TestGeneratorTargetBalances(t *testing.T) {
	refTime := time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC)
	customerID := "cliente.demo@bancodemo.local"

	data := GenerateCustomerData(customerID, refTime)

	var ahorros, wallet, card, cdt *Account
	for i := range data.Accounts {
		acc := &data.Accounts[i]
		switch acc.Type {
		case AccountTypeSavings:
			ahorros = acc
		case AccountTypeWallet:
			wallet = acc
		case AccountTypeCreditCard:
			card = acc
		case AccountTypeCDT:
			cdt = acc
		}
	}

	if ahorros == nil || wallet == nil || card == nil || cdt == nil {
		t.Fatalf("missing one of the 4 required accounts")
	}

	// Verify target balances from specification
	if ahorros.BalanceMinor != 320000000 {
		t.Errorf("expected Ahorros balance 320000000, got %d", ahorros.BalanceMinor)
	}
	if wallet.BalanceMinor != 460000000 {
		t.Errorf("expected Wallet balance 460000000, got %d", wallet.BalanceMinor)
	}
	if card.BalanceMinor != -50000000 {
		t.Errorf("expected Card balance -50000000 (owed 500.000), got %d", card.BalanceMinor)
	}
	if cdt.BalanceMinor != 200000000 {
		t.Errorf("expected CDT balance 200000000, got %d", cdt.BalanceMinor)
	}

	// Verify that summing transactions per account matches reported balance
	sumByAcc := make(map[string]int64)
	for _, tx := range data.Transactions {
		sumByAcc[tx.AccountID] += tx.AmountMinor
	}

	if sumByAcc[ahorros.ID] != ahorros.BalanceMinor {
		t.Errorf("Ahorros transactions sum %d != balance %d", sumByAcc[ahorros.ID], ahorros.BalanceMinor)
	}
	if sumByAcc[wallet.ID] != wallet.BalanceMinor {
		t.Errorf("Wallet transactions sum %d != balance %d", sumByAcc[wallet.ID], wallet.BalanceMinor)
	}
	if sumByAcc[card.ID] != card.BalanceMinor {
		t.Errorf("Card transactions sum %d != balance %d", sumByAcc[card.ID], card.BalanceMinor)
	}
}

func TestGeneratorSubscriptions(t *testing.T) {
	refTime := time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC)
	customerID := "cliente.demo@bancodemo.local"

	data := GenerateCustomerData(customerID, refTime)

	if len(data.Subscriptions) != 4 {
		t.Fatalf("expected 4 subscriptions, got %d", len(data.Subscriptions))
	}

	var totalSubsMinor int64
	for _, s := range data.Subscriptions {
		totalSubsMinor += s.AmountMinor
	}

	// 38.900 + 32.900 + 16.900 + 23.900 = 112.600 -> 11260000 minor
	if totalSubsMinor != 11260000 {
		t.Errorf("expected total subscriptions 11260000, got %d", totalSubsMinor)
	}
}

func TestMinorToDecimal(t *testing.T) {
	cases := []struct {
		minor    int64
		signed   bool
		expected string
	}{
		{320000000, false, "3200000.00"},
		{320000000, true, "+3200000.00"},
		{-50000000, false, "-500000.00"},
		{-50000000, true, "-500000.00"},
		{0, false, "0.00"},
		{0, true, "0.00"},
		{18600000, true, "+186000.00"},
		{-3890000, true, "-38900.00"},
	}

	for _, c := range cases {
		res := MinorToDecimal(c.minor, c.signed)
		if res != c.expected {
			t.Errorf("MinorToDecimal(%d, %v) = %s, expected %s", c.minor, c.signed, res, c.expected)
		}
	}
}
