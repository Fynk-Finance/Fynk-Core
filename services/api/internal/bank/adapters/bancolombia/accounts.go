package bancolombia

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
)

// History is how far back Bancolombia gives movements: its consents allow at most 90 days, so
// the first sync has 90 days, not Fynk's 12 months (ADR 0003).
const History = 90 * 24 * time.Hour

// maxPages stops a bank that keeps sending a next page.
const maxPages = 50

// kinds maps Bancolombia's account types (ISO 20022) to Fynk's. Loans (LAAC) are not shown.
var kinds = map[string]struct {
	kind  ports.AccountKind
	label string
}{
	"SVGS": {ports.AccountSavings, "Ahorros"},
	"CACC": {ports.AccountChecking, "Corriente"},
}

type amount struct {
	Amount   decimal `json:"Amount"`
	Currency string  `json:"Currency"`
}

type accountReport struct {
	AccountIdentification string `json:"AccountIdentification"`
	AccountType           string `json:"AccountType"`
	AccountReference      string `json:"AccountReference"`
	AccountStatus         string `json:"AccountStatus"`
	MultilateralBalance   []struct {
		amount
		Type string `json:"Type"`
	} `json:"MultilateralBalance"`
}

type links struct {
	Next string `json:"Next"`
}

// Accounts implements ports.Provider: savings and checking accounts with their available
// balance (AVLB), from the balances API, which also carries the basic account data.
func (a *Adapter) Accounts(ctx context.Context, accessToken string) ([]ports.Account, error) {
	var accounts []ports.Account
	page := ""
	for i := 0; i < maxPages; i++ {
		path := depositsPath + "/accounts/balances"
		if page != "" {
			path += "?" + url.Values{"pageNumber": {page}}.Encode()
		}
		var out struct {
			Data struct {
				AccountReport []accountReport `json:"AccountReport"`
			} `json:"Data"`
			Links links `json:"Links"`
		}
		if err := a.resource(ctx, http.MethodGet, path, accessToken, nil, &out); err != nil {
			return nil, err
		}
		for _, r := range out.Data.AccountReport {
			acc, ok, err := a.toAccount(r)
			if err != nil {
				return nil, err
			}
			if ok {
				accounts = append(accounts, acc)
			}
		}
		if page = pageOf(out.Links.Next); page == "" {
			break
		}
	}
	return accounts, nil
}

func (a *Adapter) toAccount(r accountReport) (ports.Account, bool, error) {
	k, ok := kinds[r.AccountType]
	if !ok || r.AccountIdentification == "" {
		return ports.Account{}, false, nil
	}
	acc := ports.Account{
		ProviderAccountID: r.AccountIdentification,
		Kind:              k.kind,
		DisplayName:       "Bancolombia · " + k.label,
		Last4:             last4(r.AccountReference),
		Currency:          "COP",
		Closed:            r.AccountStatus != "Enabled",
		IsSimulated:       a.cfg.Sandbox,
	}
	for _, b := range r.MultilateralBalance {
		if b.Type != "AVLB" {
			continue
		}
		if b.Currency != "" && b.Currency != "COP" {
			return ports.Account{}, false, nil // Fynk shows COP only
		}
		minor, err := b.Amount.minor()
		if err != nil {
			return ports.Account{}, false, fmt.Errorf("bancolombia: balance: %w", errors.Join(ports.ErrProviderUnavailable, err))
		}
		acc.BalanceMinor = minor
	}
	return acc, true, nil
}

type transactionReport struct {
	TransactionIdentification string `json:"TransactionIdentification"`
	TransactionInformation    string `json:"TransactionInformation"`
	CreditDebitIndicator      string `json:"CreditDebitIndicator"`
	BookingDateTime           string `json:"BookingDateTime"`
	Status                    string `json:"Status"`
	InstructedAmount          amount `json:"InstructedAmount"`
	Creditor                  struct {
		Name string `json:"Name"`
	} `json:"Creditor"`
}

// Transactions implements ports.Provider: one page of 40 movements. since is moved up to the
// 90 days Bancolombia keeps, so the range always fits its 4-month limit. The cursor is the
// bank's page number.
func (a *Adapter) Transactions(ctx context.Context, accessToken, accountID string, since time.Time, cursor string) (ports.TxPage, error) {
	now := a.cfg.Clock.Now().UTC()
	from := since.UTC()
	if oldest := now.Add(-History); from.Before(oldest) {
		from = oldest
	}
	q := url.Values{
		"fromValueDate": {from.Truncate(time.Second).Format(time.RFC3339)},
		"toValueDate":   {now.Truncate(time.Second).Format(time.RFC3339)},
	}
	if cursor != "" {
		q.Set("pageNumber", cursor)
	}
	var out struct {
		Data struct {
			TransactionReport []transactionReport `json:"TransactionReport"`
		} `json:"Data"`
		Links links `json:"Links"`
	}
	path := depositsPath + "/accounts/" + url.PathEscape(accountID) + "/transactions?" + q.Encode()
	err := a.resource(ctx, http.MethodGet, path, accessToken, nil, &out)
	if errors.Is(err, errNoData) {
		return ports.TxPage{}, nil
	}
	if err != nil {
		return ports.TxPage{}, err
	}
	page := ports.TxPage{Items: make([]ports.Transaction, 0, len(out.Data.TransactionReport))}
	for _, r := range out.Data.TransactionReport {
		tx, ok, err := toTransaction(r)
		if err != nil {
			return ports.TxPage{}, err
		}
		if ok {
			page.Items = append(page.Items, tx)
		}
	}
	page.NextCursor = pageOf(out.Links.Next)
	return page, nil
}

// toTransaction maps one movement. Rejected and cancelled ones never moved money and are left
// out; finalized but not yet settled ones are pending.
func toTransaction(r transactionReport) (ports.Transaction, bool, error) {
	status := ports.TxBooked
	switch r.Status {
	case "RJTD", "CAND":
		return ports.Transaction{}, false, nil
	case "FNLD":
		status = ports.TxPending
	}
	if r.InstructedAmount.Currency != "" && r.InstructedAmount.Currency != "COP" {
		return ports.Transaction{}, false, nil
	}
	minor, err := r.InstructedAmount.Amount.minor()
	if err != nil {
		return ports.Transaction{}, false, fmt.Errorf("bancolombia: movement amount: %w", errors.Join(ports.ErrProviderUnavailable, err))
	}
	booked, err := time.Parse(time.RFC3339, r.BookingDateTime)
	if err != nil {
		return ports.Transaction{}, false, fmt.Errorf("bancolombia: movement date: %w", errors.Join(ports.ErrProviderUnavailable, err))
	}
	if minor < 0 {
		minor = -minor
	}
	if r.CreditDebitIndicator == "DBIT" {
		minor = -minor
	}
	tx := ports.Transaction{
		ProviderTxID: r.TransactionIdentification,
		BookedAt:     booked.UTC(),
		AmountMinor:  minor,
		Description:  r.TransactionInformation,
		Status:       status,
	}
	if minor < 0 {
		tx.MerchantRaw = r.Creditor.Name
	}
	return tx, true, nil
}

// pageOf reads pageNumber from a pagination link, or "" for none.
func pageOf(link string) string {
	if link == "" {
		return ""
	}
	u, err := url.Parse(link)
	if err != nil {
		return ""
	}
	return u.Query().Get("pageNumber")
}

// last4 keeps only the last 4 digits of an account number (CLAUDE.md, Security rules).
func last4(reference string) string {
	var digits []byte
	for i := 0; i < len(reference); i++ {
		if reference[i] >= '0' && reference[i] <= '9' {
			digits = append(digits, reference[i])
		}
	}
	if len(digits) < 4 {
		return ""
	}
	return string(digits[len(digits)-4:])
}

// decimal is an amount with up to 2 decimals that the bank sends as a string ("950000.00") or
// as a JSON number. It is turned into centavos without floating point.
type decimal string

func (d *decimal) UnmarshalJSON(b []byte) error {
	b = bytes.TrimSpace(b)
	if len(b) > 0 && b[0] == '"' {
		var s string
		if err := json.Unmarshal(b, &s); err != nil {
			return err
		}
		*d = decimal(s)
		return nil
	}
	*d = decimal(b)
	return nil
}

// minor returns the amount in centavos.
func (d decimal) minor() (int64, error) {
	s := strings.TrimSpace(string(d))
	neg := strings.HasPrefix(s, "-")
	s = strings.TrimPrefix(s, "-")
	whole, frac, _ := strings.Cut(s, ".")
	if whole == "" || len(frac) > 2 {
		return 0, fmt.Errorf("amount %q", string(d))
	}
	frac += strings.Repeat("0", 2-len(frac))
	n, err := strconv.ParseInt(whole+frac, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("amount %q", string(d))
	}
	if neg {
		n = -n
	}
	return n, nil
}
