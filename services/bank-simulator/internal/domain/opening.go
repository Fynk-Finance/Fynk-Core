package domain

import (
	"fmt"
	"sort"
	"time"
)

// openingTx is the "SALDO INICIAL" transaction of an account: it carries the
// amount that makes the account's transactions add up to its balance.
func openingTx(acc Account, amount int64, at time.Time) Transaction {
	desc := "SALDO INICIAL " + openingLabel(acc)
	cat := "income_other"
	if acc.Type == AccountTypeCreditCard {
		cat = "other"
	}
	return Transaction{
		AccountID:       acc.ID,
		BookingDateTime: at,
		Amount:          MinorToDecimal(amount, true),
		AmountMinor:     amount,
		Status:          TransactionStatusBooked,
		Description:     desc,
		MerchantName:    strPtr(entityByID(acc.ProviderID).DisplayName),
		Category:        strPtr(cat),
		Simulated:       true,
		ProviderID:      acc.ProviderID,
	}
}

func openingLabel(acc Account) string {
	switch acc.Type {
	case AccountTypeSavings:
		return "CUENTA DE AHORROS"
	case AccountTypeWallet:
		return "BILLETERA DIGITAL"
	case AccountTypeCreditCard:
		return "TARJETA DE CREDITO"
	default:
		return "CDT"
	}
}

// buildTransactions returns the transactions of all accounts, newest first,
// with ids unique per customer.
func buildTransactions(accounts []Account, refTime time.Time) []Transaction {
	start := windowStart(refTime)
	var txs []Transaction
	for _, acc := range accounts {
		if acc.BalanceMinor == 0 {
			continue
		}
		txs = append(txs, openingTx(acc, acc.BalanceMinor, start))
	}
	return finishTransactions(txs)
}

// finishTransactions sorts newest first and numbers the transactions.
// The sort is stable, so equal times keep their build order.
func finishTransactions(txs []Transaction) []Transaction {
	sort.SliceStable(txs, func(i, j int) bool {
		return txs[i].BookingDateTime.After(txs[j].BookingDateTime)
	})
	for i := range txs {
		txs[i].ID = fmt.Sprintf("tx-%05d", i+1)
	}
	return txs
}
