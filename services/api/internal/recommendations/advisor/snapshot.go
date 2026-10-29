// Package advisor turns the aggregate snapshot of the phone into a short summary and one text per
// opportunity, written by an LLM. The model never calculates: every number on screen comes from
// the phone (M10). This package validates what comes in, checks what the model writes, and
// falls back to the phone's templates when the text cannot be trusted. It stores nothing.
package advisor

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"regexp"
)

// MaxRequestBytes is the largest request accepted (16 KB). The snapshot of a year of data is far
// below it, so anything bigger is not a snapshot (for example raw movements).
const MaxRequestBytes = 16 * 1024

// Snapshot is the AggregateSnapshot of shared contracts 3.5, schemaVersion 1.
type Snapshot struct {
	SchemaVersion             int                `json:"schemaVersion"`
	PeriodEnd                 string             `json:"periodEnd"`
	Months                    int                `json:"months"`
	MonthlyIncomeMinor        []int64            `json:"monthlyIncomeMinor"`
	MonthlySpendMinor         []int64            `json:"monthlySpendMinor"`
	SpendByCategory           []CategorySpend    `json:"spendByCategory"`
	RecurringIncome           []RecurringIncome  `json:"recurringIncome"`
	FixedExpensesMonthlyMinor int64              `json:"fixedExpensesMonthlyMinor"`
	Subscriptions             SubscriptionTotals `json:"subscriptions"`
	Goals                     []Goal             `json:"goals"`
	Caps                      []Cap              `json:"caps"`
	Opportunities             []Opportunity      `json:"opportunities"`
}

type CategorySpend struct {
	CategoryID   string `json:"categoryId"`
	Last30dMinor int64  `json:"last30dMinor"`
	Prev30dMinor int64  `json:"prev30dMinor"`
}

type RecurringIncome struct {
	Kind         string `json:"kind"`
	MonthlyMinor int64  `json:"monthlyMinor"`
}

type SubscriptionTotals struct {
	Count              int   `json:"count"`
	MonthlyMinor       int64 `json:"monthlyMinor"`
	LowUseCount        int   `json:"lowUseCount"`
	LowUseMonthlyMinor int64 `json:"lowUseMonthlyMinor"`
}

type Goal struct {
	Ref         string `json:"ref"`
	CategoryID  string `json:"categoryId"`
	TargetMinor int64  `json:"targetMinor"`
	SavedMinor  int64  `json:"savedMinor"`
	MonthsLeft  int    `json:"monthsLeft"`
	OnTrack     bool   `json:"onTrack"`
}

type Cap struct {
	CategoryID string `json:"categoryId"`
	Period     string `json:"period"`
	CapMinor   int64  `json:"capMinor"`
	SpentMinor int64  `json:"spentMinor"`
}

type Opportunity struct {
	FactKey      string  `json:"factKey"`
	Kind         string  `json:"kind"`
	CategoryID   *string `json:"categoryId"`
	MonthlyMinor int64   `json:"monthlyMinor"`
}

// Request is the body of POST /recommendations.
type Request struct {
	Snapshot Snapshot `json:"snapshot"`
	FactKeys []string `json:"factKeys"`
}

// ErrInvalidSnapshot is returned for any request that is not a valid snapshot.
var ErrInvalidSnapshot = errors.New("invalid snapshot")

func invalid(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalidSnapshot, fmt.Sprintf(format, args...))
}

var (
	categoryIDs = set("salary", "income_other", "rent", "utilities", "telecom", "groceries",
		"restaurants", "cinema", "treats", "transport", "subscriptions", "health", "education",
		"shopping", "gym", "transfers", "savings", "card_payment", "fees", "other")
	opportunityKinds = set("subscriptions", "category_increase", "payday_contribution")
	isoDate          = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
	// Opaque keys only: no spaces, so no merchant or goal name can hide in one.
	factKeyPattern = regexp.MustCompile(`^[a-z0-9_]+(\.[a-z0-9_]+)?$`)
	goalRefPattern = regexp.MustCompile(`^goal_[0-9]{1,2}$`)
)

func set(values ...string) map[string]bool {
	m := make(map[string]bool, len(values))
	for _, v := range values {
		m[v] = true
	}
	return m
}

const (
	maxListItems = 40
	// 1.000 million pesos in centavos: far above any personal monthly amount, so an absurd
	// value is rejected instead of being written by the model.
	maxMinor = 100_000_000_000
)

// Decode reads at most MaxRequestBytes, rejects unknown fields anywhere (the guard against raw
// movements) and validates the snapshot. The error wraps ErrInvalidSnapshot.
func Decode(r io.Reader) (Request, []byte, error) {
	raw, err := io.ReadAll(io.LimitReader(r, MaxRequestBytes+1))
	if err != nil {
		return Request{}, nil, invalid("unreadable body")
	}
	if len(raw) > MaxRequestBytes {
		return Request{}, nil, invalid("body over %d bytes", MaxRequestBytes)
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	var req Request
	if err := dec.Decode(&req); err != nil {
		return Request{}, nil, invalid("not a snapshot")
	}
	if dec.More() {
		return Request{}, nil, invalid("trailing data")
	}
	if err := req.Validate(); err != nil {
		return Request{}, nil, err
	}
	return req, raw, nil
}

func checkMinor(name string, v int64) error {
	if v < 0 || v > maxMinor {
		return invalid("%s out of range", name)
	}
	return nil
}

// Validate checks the snapshot against the contract.
func (r Request) Validate() error {
	s := r.Snapshot
	if s.SchemaVersion != 1 {
		return invalid("schemaVersion must be 1")
	}
	if !isoDate.MatchString(s.PeriodEnd) {
		return invalid("periodEnd must be YYYY-MM-DD")
	}
	if s.Months != 12 || len(s.MonthlyIncomeMinor) != 12 || len(s.MonthlySpendMinor) != 12 {
		return invalid("12 months expected")
	}
	for i := 0; i < 12; i++ {
		if err := checkMinor("monthlyIncomeMinor", s.MonthlyIncomeMinor[i]); err != nil {
			return err
		}
		if err := checkMinor("monthlySpendMinor", s.MonthlySpendMinor[i]); err != nil {
			return err
		}
	}
	if len(s.SpendByCategory) > maxListItems || len(s.RecurringIncome) > maxListItems ||
		len(s.Goals) > maxListItems || len(s.Caps) > maxListItems || len(s.Opportunities) > maxListItems {
		return invalid("too many items")
	}
	for _, c := range s.SpendByCategory {
		if !categoryIDs[c.CategoryID] {
			return invalid("unknown category")
		}
		if err := errors.Join(checkMinor("last30d", c.Last30dMinor), checkMinor("prev30d", c.Prev30dMinor)); err != nil {
			return err
		}
	}
	for _, ri := range s.RecurringIncome {
		if ri.Kind != "salary" && ri.Kind != "other" {
			return invalid("unknown recurring income kind")
		}
		if err := checkMinor("recurringIncome", ri.MonthlyMinor); err != nil {
			return err
		}
	}
	if err := checkMinor("fixedExpenses", s.FixedExpensesMonthlyMinor); err != nil {
		return err
	}
	sub := s.Subscriptions
	if sub.Count < 0 || sub.LowUseCount < 0 || sub.LowUseCount > sub.Count {
		return invalid("subscription counts")
	}
	if err := errors.Join(checkMinor("subscriptions", sub.MonthlyMinor), checkMinor("lowUse", sub.LowUseMonthlyMinor)); err != nil {
		return err
	}
	for _, g := range s.Goals {
		if !goalRefPattern.MatchString(g.Ref) || !categoryIDs[g.CategoryID] || g.MonthsLeft < 0 {
			return invalid("goal")
		}
		if err := errors.Join(checkMinor("target", g.TargetMinor), checkMinor("saved", g.SavedMinor)); err != nil {
			return err
		}
	}
	for _, c := range s.Caps {
		if !categoryIDs[c.CategoryID] || (c.Period != "week" && c.Period != "month") || c.CapMinor <= 0 {
			return invalid("cap")
		}
		if err := errors.Join(checkMinor("cap", c.CapMinor), checkMinor("spent", c.SpentMinor)); err != nil {
			return err
		}
	}
	keys := map[string]bool{}
	for _, o := range s.Opportunities {
		if !factKeyPattern.MatchString(o.FactKey) || !opportunityKinds[o.Kind] || keys[o.FactKey] {
			return invalid("opportunity")
		}
		if o.CategoryID != nil && !categoryIDs[*o.CategoryID] {
			return invalid("opportunity category")
		}
		if err := checkMinor("opportunity", o.MonthlyMinor); err != nil {
			return err
		}
		keys[o.FactKey] = true
	}
	if len(r.FactKeys) > maxListItems {
		return invalid("too many fact keys")
	}
	for _, k := range r.FactKeys {
		if !keys[k] {
			return invalid("fact key not in the snapshot")
		}
	}
	return nil
}

// Hash is the SHA-256 of the snapshot in canonical form. It is the only trace of a snapshot that
// reaches the logs.
func (s Snapshot) Hash() string {
	b, _ := json.Marshal(s)
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}
