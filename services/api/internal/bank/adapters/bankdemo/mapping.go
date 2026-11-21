package bankdemo

import (
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
)

// bankAccount is an account as contracts/bank-simulator.yaml sends it.
type bankAccount struct {
	ID               string  `json:"id"`
	Type             string  `json:"type"`
	MaskedNumber     string  `json:"maskedNumber"`
	Currency         string  `json:"currency"`
	Balance          string  `json:"balance"`
	BalanceMinor     *int64  `json:"balanceMinor"`
	Available        string  `json:"available"`
	AvailableMinor   *int64  `json:"availableMinor"`
	CreditLimit      *string `json:"creditLimit"`
	CreditLimitMinor *int64  `json:"creditLimitMinor"`
	PaymentDueDate   *int    `json:"paymentDueDate"` // day of the month
	Status           string  `json:"status"`
	Simulated        bool    `json:"simulated"`
	CDT              *struct {
		RateEaBps int    `json:"rateEaBps"`
		TermDays  int    `json:"termDays"`
		Opened    string `json:"opened"`
		Maturity  string `json:"maturity"`
	} `json:"cdt"`
}

var kinds = map[string]ports.AccountKind{
	"SAVINGS":     ports.AccountSavings,
	"WALLET":      ports.AccountWallet,
	"CREDIT_CARD": ports.AccountCreditCard,
	"CDT":         ports.AccountCDT,
}

// toPort maps b to the shared shape. ok is false for a product type Fynk does not show.
// today is the current date in Bogotá.
func (b bankAccount) toPort(today time.Time) (acc ports.Account, ok bool, err error) {
	kind, known := kinds[b.Type]
	if !known {
		return ports.Account{}, false, nil
	}
	balance, err := amount(b.BalanceMinor, b.Balance)
	if err != nil {
		return ports.Account{}, false, err
	}
	acc = ports.Account{
		ProviderAccountID: b.ID,
		Kind:              kind,
		Last4:             last4(b.MaskedNumber),
		Currency:          b.Currency,
		BalanceMinor:      balance,
		Closed:            b.Status == "CLOSED" || b.Status == "INACTIVE",
		IsSimulated:       b.Simulated,
	}
	if b.AvailableMinor != nil || b.Available != "" {
		available, err := amount(b.AvailableMinor, b.Available)
		if err != nil {
			return ports.Account{}, false, err
		}
		acc.AvailableMinor = &available
	}
	if kind == ports.AccountCreditCard {
		// The simulator reports the debt as a negative balance; the shared shape wants the
		// amount owed as a positive number.
		if acc.BalanceMinor < 0 {
			acc.BalanceMinor = -acc.BalanceMinor
		}
		if b.CreditLimitMinor != nil || b.CreditLimit != nil {
			raw := ""
			if b.CreditLimit != nil {
				raw = *b.CreditLimit
			}
			limit, err := amount(b.CreditLimitMinor, raw)
			if err != nil {
				return ports.Account{}, false, err
			}
			acc.CreditLimitMinor = &limit
		}
		if b.PaymentDueDate != nil {
			due := nextDay(today, *b.PaymentDueDate)
			acc.PaymentDueOn = &due
		}
	}
	if kind == ports.AccountCDT && b.CDT != nil {
		opened, err1 := time.Parse(time.DateOnly, b.CDT.Opened)
		matures, err2 := time.Parse(time.DateOnly, b.CDT.Maturity)
		if err := errors.Join(err1, err2); err != nil {
			return ports.Account{}, false, err
		}
		acc.CDT = &ports.CDT{RateEaBps: b.CDT.RateEaBps, TermDays: b.CDT.TermDays, OpenedOn: opened, MaturesOn: matures}
	}
	return acc, true, nil
}

// bankTransaction is a movement as contracts/bank-simulator.yaml sends it.
type bankTransaction struct {
	ID              string    `json:"id"`
	BookingDateTime time.Time `json:"bookingDateTime"`
	AmountMinor     int64     `json:"amountMinor"`
	Status          string    `json:"status"`
	Description     string    `json:"description"`
	MerchantName    *string   `json:"merchantName"`
	Category        *string   `json:"category"`
}

func (b bankTransaction) toPort() ports.Transaction {
	t := ports.Transaction{
		ProviderTxID: b.ID,
		BookedAt:     b.BookingDateTime.UTC(),
		AmountMinor:  b.AmountMinor,
		Description:  b.Description,
		Status:       ports.TxBooked,
	}
	if b.Status == "PENDING" {
		t.Status = ports.TxPending
	}
	if b.MerchantName != nil {
		t.MerchantRaw = *b.MerchantName
	}
	if b.Category != nil {
		t.BankCategory = *b.Category
	}
	return t
}

// amount prefers the integer centavos and falls back to the decimal string.
func amount(minor *int64, decimal string) (int64, error) {
	if minor != nil {
		return *minor, nil
	}
	return parseMinor(decimal)
}

// parseMinor turns a COP decimal string ("-500000.00", "+5200000.00") into centavos exactly,
// without floating point.
func parseMinor(s string) (int64, error) {
	sign := int64(1)
	switch {
	case strings.HasPrefix(s, "-"):
		sign, s = -1, s[1:]
	case strings.HasPrefix(s, "+"):
		s = s[1:]
	}
	whole, frac, _ := strings.Cut(s, ".")
	if whole == "" || len(frac) > 2 || !digits(whole) || !digits(frac) {
		return 0, errors.New("bankdemo: invalid amount")
	}
	frac += strings.Repeat("0", 2-len(frac))
	n, err := strconv.ParseInt(whole+frac, 10, 64)
	if err != nil {
		return 0, errors.New("bankdemo: invalid amount")
	}
	return sign * n, nil
}

func digits(s string) bool {
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

// last4 keeps only the last 4 digits of a masked number. Fewer than 4 digits give "".
func last4(masked string) string {
	var d []rune
	for _, r := range masked {
		if r >= '0' && r <= '9' {
			d = append(d, r)
		}
	}
	if len(d) < 4 {
		return ""
	}
	return string(d[len(d)-4:])
}

// nextDay is the next date, today included, that falls on day of the month (the last day of
// a shorter month). The result is a date at 00:00 UTC.
func nextDay(today time.Time, day int) time.Time {
	y, m, d := today.Date()
	if d > clampDay(y, m, day) {
		m++
	}
	first := time.Date(y, m, 1, 0, 0, 0, 0, time.UTC)
	return time.Date(first.Year(), first.Month(), clampDay(first.Year(), first.Month(), day), 0, 0, 0, 0, time.UTC)
}

func clampDay(y int, m time.Month, day int) int {
	last := time.Date(y, m+1, 0, 0, 0, 0, 0, time.UTC).Day()
	if day > last {
		return last
	}
	if day < 1 {
		return 1
	}
	return day
}
