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

// finishTransactions returns the transactions newest first and numbers them.
// Equal times keep their build order when read oldest first, so walking the
// list backwards gives the same order the history was built in.
func finishTransactions(txs []Transaction) []Transaction {
	sort.SliceStable(txs, func(i, j int) bool {
		return txs[i].BookingDateTime.Before(txs[j].BookingDateTime)
	})
	for i, j := 0, len(txs)-1; i < j; i, j = i+1, j-1 {
		txs[i], txs[j] = txs[j], txs[i]
	}
	for i := range txs {
		txs[i].ID = fmt.Sprintf("tx-%05d", i+1)
	}
	return txs
}
