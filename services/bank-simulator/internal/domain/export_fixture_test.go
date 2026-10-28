package domain

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

type FixtureUser struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

type FixtureCdtDetails struct {
	RateEaBps int    `json:"rateEaBps"`
	TermDays  int    `json:"termDays"`
	OpenedOn  string `json:"openedOn"`
	MaturesOn string `json:"maturesOn"`
}

type FixtureAccount struct {
	ID                string             `json:"id"`
	ProviderAccountID string             `json:"providerAccountId"`
	Name              string             `json:"name"`
	Type              string             `json:"type"` // 'savings', 'wallet', 'credit_card', 'cdt'
	Currency          string             `json:"currency"`
	BalanceMinor      int64              `json:"balanceMinor"`
	AvailableMinor    int64              `json:"availableMinor"`
	CreditLimitMinor  *int64             `json:"creditLimitMinor"`
	PaymentDueDay     *int               `json:"paymentDueDay"`
	Mask              string             `json:"mask"`
	Status            string             `json:"status"`
	LinkedAt          string             `json:"linkedAt"`
	LastSyncedAt      string             `json:"lastSyncedAt"`
	CDT               *FixtureCdtDetails `json:"cdt"`
}

type FixtureTransaction struct {
	ID             string  `json:"id"`
	AccountID      string  `json:"accountId"`
	ProviderTxID   *string `json:"providerTxId"`
	Source         string  `json:"source"`
	BookedAt       string  `json:"bookedAt"`
	AmountMinor    int64   `json:"amountMinor"`
	Description    string  `json:"description"`
	MerchantRaw    *string `json:"merchantRaw"`
	MerchantKey    *string `json:"merchantKey"`
	CategoryID     string  `json:"categoryId"`
	CategorySource string  `json:"categorySource"`
	Status         string  `json:"status"`
	GoalID         *string `json:"goalId"`
}

type SharedFixture struct {
	User         FixtureUser          `json:"user"`
	Accounts     []FixtureAccount     `json:"accounts"`
	Transactions []FixtureTransaction `json:"transactions"`
}

func normalizeMerchantKey(raw string) string {
	lowered := strings.ToLower(raw)
	replacer := strings.NewReplacer(
		"sas", "",
		"demo", "",
		"plus", "",
		"storage", "nube",
		"  ", " ",
	)
	res := strings.TrimSpace(replacer.Replace(lowered))
	return res
}

func TestExportDemoUserFixture(t *testing.T) {
	refTime := time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC)
	customerID := "cliente.demo@bancodemo.local"

	data := GenerateCustomerData(customerID, refTime)

	fixture := SharedFixture{
		User: FixtureUser{
			ID:    "usr-demo-001",
			Email: "cliente.demo@bancodemo.local",
			Name:  "Cliente Demo",
		},
	}

	linkedAt := refTime.AddDate(0, -1, 0).Format(time.RFC3339)
	lastSyncedAt := refTime.Format(time.RFC3339)

	for _, acc := range data.Accounts {
		var fCdt *FixtureCdtDetails
		if acc.CDT != nil {
			fCdt = &FixtureCdtDetails{
				RateEaBps: acc.CDT.RateEaBps,
				TermDays:  acc.CDT.TermDays,
				OpenedOn:  acc.CDT.Opened,
				MaturesOn: acc.CDT.Maturity,
			}
		}

		accType := strings.ToLower(string(acc.Type))
		fixture.Accounts = append(fixture.Accounts, FixtureAccount{
			ID:                acc.ID,
			ProviderAccountID: acc.ID,
			Name:              acc.Name,
			Type:              accType,
			Currency:          acc.Currency,
			BalanceMinor:      acc.BalanceMinor,
			AvailableMinor:    acc.AvailableMinor,
			CreditLimitMinor:  acc.CreditLimitMinor,
			PaymentDueDay:     acc.PaymentDueDate,
			Mask:              acc.MaskedNumber,
			Status:            "active",
			LinkedAt:          linkedAt,
			LastSyncedAt:      lastSyncedAt,
			CDT:               fCdt,
		})
	}

	for _, tx := range data.Transactions {
		txID := tx.ID
		cat := "other"
		if tx.Category != nil {
			cat = *tx.Category
		}
		var mKey *string
		if tx.MerchantName != nil {
			k := normalizeMerchantKey(*tx.MerchantName)
			mKey = &k
		}

		fixture.Transactions = append(fixture.Transactions, FixtureTransaction{
			ID:             tx.ID,
			AccountID:      tx.AccountID,
			ProviderTxID:   &txID,
			Source:         "bank",
			BookedAt:       tx.BookingDateTime.Format(time.RFC3339),
			AmountMinor:    tx.AmountMinor,
			Description:    tx.Description,
			MerchantRaw:    tx.MerchantName,
			MerchantKey:    mKey,
			CategoryID:     cat,
			CategorySource: "bank",
			Status:         strings.ToLower(string(tx.Status)),
			GoalID:         nil,
		})
	}

	rawJSON, err := json.MarshalIndent(fixture, "", "  ")
	if err != nil {
		t.Fatalf("failed to marshal fixture: %v", err)
	}

	outPath := filepath.Join("..", "..", "..", "..", "fixtures", "demo-user.json")
	if err := os.WriteFile(outPath, rawJSON, 0644); err != nil {
		t.Fatalf("failed to write demo-user.json: %v", err)
	}
}
