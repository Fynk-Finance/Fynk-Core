package domain

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"math/rand"
	"time"
)

// Provider ids of the simulated entities.
const (
	ProviderBancoDemo        = "banco-demo"
	ProviderBilleteraDemo    = "billetera-demo"
	ProviderBancoDigitalDemo = "banco-digital-demo"
	ProviderCooperativaDemo  = "cooperativa-demo"
)

type EntityKind string

const (
	EntityKindBank   EntityKind = "bank"
	EntityKindWallet EntityKind = "wallet"
)

type Entity struct {
	ProviderID  string
	DisplayName string
	Kind        EntityKind
	short       string // used in account ids
}

// entities is the fixed table, in display order.
var entities = []Entity{
	{ProviderBancoDemo, "Banco Demo", EntityKindBank, "bd"},
	{ProviderBilleteraDemo, "Billetera Demo", EntityKindWallet, "bil"},
	{ProviderBancoDigitalDemo, "Banco Digital Demo", EntityKindBank, "bdd"},
	{ProviderCooperativaDemo, "Cooperativa Demo", EntityKindBank, "coop"},
}

// Presence probabilities, in percent. Banco Demo is always present.
const (
	PctBilletera         = 80
	PctBancoDigital      = 50
	PctCooperativa       = 25
	PctBancoDigitalCard  = 40
	PctBancoDemoCDT      = 50
	cardLimitStepPesos   = 500_000
	cdtAmountStepPesos   = 500_000
	centavosPerPeso      = 100
	openingTimeOfDayMins = 1
)

// Balance ranges in whole pesos.
const (
	bancoDemoSavingsMin = 500_000
	bancoDemoSavingsMax = 8_000_000
	walletMin           = 20_000
	walletMax           = 1_500_000
	digitalSavingsMin   = 100_000
	digitalSavingsMax   = 5_000_000
	coopSavingsMin      = 200_000
	coopSavingsMax      = 3_000_000
	cardLimitMin        = 2_000_000
	cardLimitMax        = 10_000_000
	cardMaxDebtPct      = 40
	cdtAmountMin        = 1_000_000
	cdtAmountMax        = 10_000_000
)

// EntitySummary is what the sign-up flow shows for each entity of a customer.
type EntitySummary struct {
	ProviderID   string
	DisplayName  string
	Kind         EntityKind
	AccountCount int
}

// EntitySummaries lists the entities where the customer has accounts, in table order.
func EntitySummaries(data *CustomerData) []EntitySummary {
	counts := map[string]int{}
	for _, a := range data.Accounts {
		counts[a.ProviderID]++
	}
	var out []EntitySummary
	for _, e := range entities {
		if counts[e.ProviderID] > 0 {
			out = append(out, EntitySummary{e.ProviderID, e.DisplayName, e.Kind, counts[e.ProviderID]})
		}
	}
	return out
}

func hashOf(parts ...string) [32]byte {
	s := ""
	for i, p := range parts {
		if i > 0 {
			s += "|"
		}
		s += p
	}
	return sha256.Sum256([]byte(s))
}

func rngFrom(h [32]byte) *rand.Rand {
	return rand.New(rand.NewSource(int64(binary.BigEndian.Uint64(h[:8]))))
}

// drawPresence makes the random draws for the optional entities.
func drawPresence(customerID string) (billetera, digital, coop bool) {
	rng := rngFrom(hashOf(customerID, "entities"))
	// Always draw the three values so each decision is independent of the others.
	billetera = rng.Intn(100) < PctBilletera
	digital = rng.Intn(100) < PctBancoDigital
	coop = rng.Intn(100) < PctCooperativa
	return
}

// presentEntities decides which entities a customer has, from the customer id alone.
// If no optional entity comes out, Billetera Demo is added.
func presentEntities(customerID string) map[string]bool {
	bil, dig, coop := drawPresence(customerID)
	if !bil && !dig && !coop {
		bil = true
	}
	return map[string]bool{
		ProviderBancoDemo:        true,
		ProviderBilleteraDemo:    bil,
		ProviderBancoDigitalDemo: dig,
		ProviderCooperativaDemo:  coop,
	}
}

// pesosBetween returns a random whole-peso amount in [min, max], in centavos.
func pesosBetween(rng *rand.Rand, min, max int64) int64 {
	return (min + rng.Int63n(max-min+1)) * centavosPerPeso
}

// stepsBetween returns min + k*step in [min, max], in centavos.
func stepsBetween(rng *rand.Rand, min, max, step int64) int64 {
	return (min + rng.Int63n((max-min)/step+1)*step) * centavosPerPeso
}

type accountBuilder struct {
	customerID string
	entity     Entity
	hash       [32]byte
}

func (b accountBuilder) newAccount(t AccountType, kind, name string, balance int64) Account {
	maskH := hashOf(b.customerID, b.entity.ProviderID, kind, "mask")
	mask := fmt.Sprintf("****%04d", binary.BigEndian.Uint32(maskH[:4])%10000)
	return Account{
		ID:             fmt.Sprintf("acc-%s-%s-%x", kind, b.entity.short, b.hash[:4]),
		CustomerID:     b.customerID,
		Type:           t,
		Name:           name,
		MaskedNumber:   mask,
		Currency:       "COP",
		Balance:        MinorToDecimal(balance, balance < 0),
		BalanceMinor:   balance,
		Available:      MinorToDecimal(balance, false),
		AvailableMinor: balance,
		Status:         AccountStatusActive,
		Simulated:      true,
		ProviderID:     b.entity.ProviderID,
	}
}

func (b accountBuilder) savings(balance int64) Account {
	return b.newAccount(AccountTypeSavings, "savings", "Cuenta de Ahorros "+b.entity.DisplayName, balance)
}

func (b accountBuilder) wallet(balance int64) Account {
	return b.newAccount(AccountTypeWallet, "wallet", b.entity.DisplayName, balance)
}

func (b accountBuilder) card(rng *rand.Rand) Account {
	limit := stepsBetween(rng, cardLimitMin, cardLimitMax, cardLimitStepPesos)
	// Debt is a whole number of pesos, from 0 % up to 40 % of the limit.
	debt := limit / centavosPerPeso * int64(rng.Intn(cardMaxDebtPct+1)) / 100 * centavosPerPeso
	acc := b.newAccount(AccountTypeCreditCard, "card", "Tarjeta de Crédito "+b.entity.DisplayName, -debt)
	acc.Available = MinorToDecimal(limit-debt, false)
	acc.AvailableMinor = limit - debt
	limitStr := MinorToDecimal(limit, false)
	acc.CreditLimit = &limitStr
	acc.CreditLimitMinor = &limit
	dueDays := []int{5, 10, 15, 20}
	due := dueDays[rng.Intn(len(dueDays))]
	if b.entity.ProviderID == ProviderBancoDemo {
		due = 5 // same as the demo user
	}
	acc.PaymentDueDate = &due
	return acc
}

func (b accountBuilder) cdt(rng *rand.Rand, refTime time.Time) Account {
	products := DefaultCdtProducts()
	p := products[rng.Intn(len(products))]
	amount := stepsBetween(rng, cdtAmountMin, cdtAmountMax, cdtAmountStepPesos)
	if amount < p.MinAmountMinor {
		amount = p.MinAmountMinor
	}
	// Opened between 15 days ago and 15 days before maturity.
	openedDaysAgo := 15 + rng.Intn(p.TermDays-30)
	opened := refTime.AddDate(0, 0, -openedDaysAgo)
	acc := b.newAccount(AccountTypeCDT, "cdt", fmt.Sprintf("CDT Digital %d Días", p.TermDays), amount)
	acc.CDT = &CdtDetails{
		RateEa:    p.RateEa,
		RateEaBps: p.RateEaBps,
		TermDays:  p.TermDays,
		Opened:    opened.Format("2006-01-02"),
		Maturity:  opened.AddDate(0, 0, p.TermDays).Format("2006-01-02"),
	}
	return acc
}

// entityAccounts builds the accounts of one entity. Its seed depends only on
// the customer id and the provider id.
func entityAccounts(customerID string, e Entity, refTime time.Time) []Account {
	h := hashOf(customerID, e.ProviderID)
	rng := rngFrom(h)
	b := accountBuilder{customerID, e, h}
	switch e.ProviderID {
	case ProviderBancoDemo:
		out := []Account{
			b.savings(pesosBetween(rng, bancoDemoSavingsMin, bancoDemoSavingsMax)),
			b.card(rng),
		}
		if rng.Intn(100) < PctBancoDemoCDT {
			out = append(out, b.cdt(rng, refTime))
		}
		return out
	case ProviderBilleteraDemo:
		return []Account{b.wallet(pesosBetween(rng, walletMin, walletMax))}
	case ProviderBancoDigitalDemo:
		out := []Account{b.savings(pesosBetween(rng, digitalSavingsMin, digitalSavingsMax))}
		if rng.Intn(100) < PctBancoDigitalCard {
			out = append(out, b.card(rng))
		}
		return out
	default:
		return []Account{b.savings(pesosBetween(rng, coopSavingsMin, coopSavingsMax))}
	}
}

// windowStart is the first instant of the 12-month window, as in the demo data.
func windowStart(refTime time.Time) time.Time {
	y, m, _ := refTime.AddDate(-1, 0, 0).Date()
	return time.Date(y, m, 1, 0, openingTimeOfDayMins, 0, 0, time.UTC)
}

func entityByID(id string) Entity {
	for _, e := range entities {
		if e.ProviderID == id {
			return e
		}
	}
	return Entity{}
}

func strPtr(s string) *string { return &s }

// generateRandomCustomer builds a non-demo customer.
func generateRandomCustomer(customerID string, refTime time.Time) *CustomerData {
	present := presentEntities(customerID)
	var accounts []Account
	for _, e := range entities {
		if present[e.ProviderID] {
			accounts = append(accounts, entityAccounts(customerID, e, refTime)...)
		}
	}
	txs, subs := buildHistory(customerID, accounts, refTime)
	return &CustomerData{
		CustomerID:    customerID,
		DisplayName:   "Cliente Demo",
		Accounts:      accounts,
		Transactions:  txs,
		Subscriptions: subs,
		CdtProducts:   DefaultCdtProducts(),
	}
}
