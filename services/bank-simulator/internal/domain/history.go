package domain

import (
	"math/rand"
	"sort"
	"time"
)

// Money helpers, all in centavos.
const (
	peso        = 100
	tenThousand = 10_000 * peso
	oneThousand = 1_000 * peso
	cardCapPct  = 35 // monthly card charges stay under this share of the limit
)

// event is one movement of one account before it becomes a Transaction.
type event struct {
	accID    string
	at       time.Time
	amount   int64
	desc     string
	merchant string
	category string
}

type historyBuilder struct {
	rng     *rand.Rand
	refTime time.Time
	events  []event
	spent   map[string]int64 // spending of the current month per account
}

// add records a movement. Movements after refTime are dropped.
func (h *historyBuilder) add(accID string, at time.Time, amount int64, desc, merchant, category string) bool {
	if at.After(h.refTime) {
		return false
	}
	h.events = append(h.events, event{accID, at, amount, desc, merchant, category})
	if amount < 0 {
		h.spent[accID] += -amount
	}
	return true
}

// transfer records both sides of a movement between two accounts of the user.
func (h *historyBuilder) transfer(from, to string, at time.Time, amount int64, fromDesc, toDesc, fromMerchant, toMerchant, category string) {
	if amount <= 0 || at.After(h.refTime) {
		return
	}
	h.add(from, at, -amount, fromDesc, fromMerchant, category)
	h.add(to, at, amount, toDesc, toMerchant, category)
}

// splitAmount splits total into n whole-peso parts that add up to total.
func splitAmount(rng *rand.Rand, total int64, n int) []int64 {
	if n <= 1 {
		return []int64{total}
	}
	weights := make([]int64, n)
	var sumW int64
	for i := range weights {
		weights[i] = 50 + rng.Int63n(101)
		sumW += weights[i]
	}
	parts := make([]int64, n)
	var used int64
	for i := 0; i < n-1; i++ {
		parts[i] = total * weights[i] / sumW / peso * peso
		used += parts[i]
	}
	parts[n-1] = total - used
	return parts
}

func ceilDiv(a, b int64) int64 { return (a + b - 1) / b }

// cardPlan tracks a credit card, the account that pays it and its monthly charges.
type cardPlan struct {
	card    Account
	payer   string
	dueDay  int
	charges []int64
}

func (c *cardPlan) cap() int64 { return *c.card.CreditLimitMinor * cardCapPct / 100 }

type accountSet struct {
	bdSavings, bdCard, bdCDT         *Account
	wallet                           *Account
	digSavings, digCard, coopSavings *Account
}

func findAccounts(accounts []Account) accountSet {
	var s accountSet
	for i := range accounts {
		a := &accounts[i]
		switch {
		case a.ProviderID == ProviderBancoDemo && a.Type == AccountTypeSavings:
			s.bdSavings = a
		case a.ProviderID == ProviderBancoDemo && a.Type == AccountTypeCreditCard:
			s.bdCard = a
		case a.ProviderID == ProviderBancoDemo && a.Type == AccountTypeCDT:
			s.bdCDT = a
		case a.Type == AccountTypeWallet:
			s.wallet = a
		case a.ProviderID == ProviderBancoDigitalDemo && a.Type == AccountTypeSavings:
			s.digSavings = a
		case a.ProviderID == ProviderBancoDigitalDemo && a.Type == AccountTypeCreditCard:
			s.digCard = a
		case a.ProviderID == ProviderCooperativaDemo:
			s.coopSavings = a
		}
	}
	return s
}

// buildHistory builds 12 months of movements for every account, backwards from
// the final balances, and the subscriptions that appear in them.
func buildHistory(customerID string, accounts []Account, refTime time.Time) ([]Transaction, []Subscription) {
	h := &historyBuilder{
		rng:     rngFrom(hashOf(customerID, "history")),
		refTime: refTime,
		spent:   map[string]int64{},
	}
	acc := findAccounts(accounts)
	rng := h.rng

	salary := pesosBetween(rng, 2_500_000, 7_000_000) / (50_000 * peso) * (50_000 * peso)
	rent := salary * int64(25+rng.Intn(16)) / 100 / tenThousand * tenThousand
	utilBase := pesosBetween(rng, 120_000, 280_000) / oneThousand * oneThousand

	// Wallet items go to the Banco Demo card when the user has no wallet.
	spender := acc.bdCard
	if acc.wallet != nil {
		spender = acc.wallet
	}
	bdPlan := &cardPlan{card: *acc.bdCard, payer: acc.bdSavings.ID, dueDay: *acc.bdCard.PaymentDueDate}
	var digPlan *cardPlan
	if acc.digCard != nil {
		digPlan = &cardPlan{card: *acc.digCard, payer: acc.digSavings.ID, dueDay: *acc.digCard.PaymentDueDate}
	}
	var aporte int64
	if acc.coopSavings != nil {
		aporte = max(5_000*peso, acc.coopSavings.BalanceMinor*3/100/oneThousand*oneThousand)
	}

	subs := []Subscription{
		{"sub-01-video", customerID, acc.bdCard.ID, "STREAMING VIDEO PLUS", 3890000, "monthly", 28, true},
		{"sub-02-series", customerID, acc.bdCard.ID, "STREAMING SERIES DEMO", 3290000, "monthly", 2, true},
		{"sub-03-musica", customerID, spender.ID, "STREAMING MUSICA DEMO", 1690000, "monthly", 7, true},
		{"sub-04-nube", customerID, spender.ID, "NUBE STORAGE DEMO", 2390000, "monthly", 15, true},
	}

	sv := acc.bdSavings.ID
	startYear, startMonth, _ := refTime.AddDate(-1, 0, 0).Date()
	currYear, currMonth, currDay := refTime.Date()
	month := 0
	for d := time.Date(startYear, startMonth, 1, 0, 0, 0, 0, time.UTC); !d.After(refTime); d = d.AddDate(0, 1, 0) {
		y, m, _ := d.Date()
		dim := time.Date(y, m+1, 0, 0, 0, 0, 0, time.UTC).Day()
		maxDay := dim
		if y == currYear && m == currMonth {
			maxDay = currDay
		}
		at := func(day, hour, min int) time.Time { return time.Date(y, m, day, hour, min, 0, 0, time.UTC) }
		clear(h.spent)

		// Fixed items on Banco Demo Ahorros.
		if maxDay >= 1 {
			h.add(sv, at(1, 8, 30), -rent, "ARRIENDO INMOBILIARIA DEMO", "INMOBILIARIA DEMO", "rent")
		}
		if maxDay >= 26 {
			util := utilBase / peso * int64(80+rng.Intn(41)) / 100 * peso
			h.add(sv, at(26, 14, 30), -util, "EMPRESA DE SERVICIOS DEMO", "EMPRESA DE SERVICIOS DEMO", "utilities")
		} else {
			rng.Intn(41) // keep the draws the same whatever the day
		}
		payday := min(30, dim)
		if maxDay >= payday {
			h.add(sv, at(payday, 8, 0), salary, "NOMINA EMPRESA DEMO SAS", "EMPRESA DEMO SAS", "salary")
		}

		// Subscriptions, transport and gym.
		sub := func(i, day, hour, min int, a *Account) {
			if maxDay >= day {
				h.add(a.ID, at(day, hour, min), -subs[i].AmountMinor, subs[i].Merchant, subs[i].Merchant, "subscriptions")
			}
		}
		sub(0, 28, 16, 45, acc.bdCard)
		sub(1, 2, 9, 15, acc.bdCard)
		sub(2, 7, 7, 0, spender)
		sub(3, 15, 12, 0, spender)
		for day := 1; day <= maxDay; day++ {
			wd := at(day, 0, 0).Weekday()
			if wd == time.Monday {
				h.add(spender.ID, at(day, 7, 0), -2225000, "GIMNASIO DEMO", "GIMNASIO DEMO", "gym")
			}
			if wd >= time.Monday && wd <= time.Friday {
				h.add(spender.ID, at(day, 8, 0), -650000, "TRANSPORTE URBANO DEMO", "TRANSPORTE URBANO DEMO", "transport")
			}
		}
		treats := 10 + rng.Intn(10)
		if acc.wallet == nil {
			treats = 5 + rng.Intn(5)
		}
		for i := 0; i < treats; i++ {
			day := 1 + rng.Intn(maxDay)
			amt := int64(600000 + rng.Intn(13500)*100) // under $20.000
			h.add(spender.ID, at(day, 15, 10+i), -amt, "CAFE Y ANTOJOS DEMO", "CAFE Y ANTOJOS DEMO", "treats")
		}

		// Variable spending on the Banco Demo card, under its cap.
		budget := bdPlan.cap() - h.spent[bdPlan.card.ID]
		for i, n := 0, 4+rng.Intn(5); i < n; i++ {
			amt := int64(2500000 + rng.Intn(65000)*100)
			day := 1 + rng.Intn(maxDay)
			if amt <= budget && h.add(bdPlan.card.ID, at(day, 20, 15+i), -amt, "RESTAURANTE DEMO", "RESTAURANTE DEMO", "restaurants") {
				budget -= amt
			}
		}
		if (m == 12 || m == 4 || m == 7) && budget >= 25_000_000 {
			amt := 25_000_000 + int64(rng.Intn(int((min(budget, 80_000_000)-25_000_000)/peso+1)))*peso
			h.add(bdPlan.card.ID, at(18, 11, 0), -amt, "COMPRA COMERCIO DEMO", "TIENDA DEMO", "shopping")
		}

		// Banco Demo card payment: pays last month's charges.
		var cardPay int64
		if month >= 1 && maxDay >= 5 {
			cardPay = bdPlan.charges[month-1]
			h.transfer(sv, bdPlan.card.ID, at(5, 10, 0), cardPay,
				"PAGO TARJETA DE CREDITO BANCO DEMO", "ABONO PAGO TARJETA BANCO DEMO", "BANCO DEMO", "BANCO DEMO", "card_payment")
		}

		var transfersOut int64
		out := func(amount int64, day, hour int, to *Account, fromDesc, toDesc, fromM, toM, cat string) {
			if amount > 0 && maxDay >= day {
				h.transfer(sv, to.ID, at(day, hour, 0), amount, fromDesc, toDesc, fromM, toM, cat)
				transfersOut += amount
			}
		}

		if acc.wallet != nil {
			out(ceilDiv(h.spent[acc.wallet.ID], tenThousand)*tenThousand, 2, 11, acc.wallet,
				"TRANSFERENCIA A BILLETERA DEMO", "TRANSFERENCIA DESDE AHORROS DEMO", "BILLETERA DEMO", "BANCO DEMO", "transfers")
		}

		if acc.digSavings != nil {
			ds := acc.digSavings.ID
			for i, n := 0, 2+rng.Intn(3); i < n; i++ {
				amt := pesosBetween(rng, 20_000, 120_000)
				day := 1 + rng.Intn(maxDay)
				h.add(ds, at(day, 19, 5+i), -amt, "COMPRA ONLINE DEMO", "TIENDA ONLINE DEMO", "shopping")
			}
			if digPlan != nil {
				b := digPlan.cap()
				for i, n := 0, 3+rng.Intn(4); i < n; i++ {
					amt := pesosBetween(rng, 25_000, 90_000)
					day := 1 + rng.Intn(maxDay)
					if amt <= b && h.add(digPlan.card.ID, at(day, 21, 5+i), -amt, "RESTAURANTE DEMO", "RESTAURANTE DEMO", "restaurants") {
						b -= amt
					}
				}
				for i, n := 0, 2+rng.Intn(3); i < n; i++ {
					amt := pesosBetween(rng, 20_000, 150_000)
					day := 1 + rng.Intn(maxDay)
					if amt <= b && h.add(digPlan.card.ID, at(day, 13, 5+i), -amt, "COMPRA ONLINE DEMO", "TIENDA ONLINE DEMO", "shopping") {
						b -= amt
					}
				}
				if month >= 1 && maxDay >= digPlan.dueDay {
					h.transfer(ds, digPlan.card.ID, at(digPlan.dueDay, 10, 30), digPlan.charges[month-1],
						"PAGO TARJETA DE CREDITO BANCO DIGITAL DEMO", "ABONO PAGO TARJETA BANCO DIGITAL DEMO", "BANCO DIGITAL DEMO", "BANCO DIGITAL DEMO", "card_payment")
				}
			}
			out(ceilDiv(h.spent[ds], tenThousand)*tenThousand, 3, 12, acc.digSavings,
				"TRANSFERENCIA A BANCO DIGITAL DEMO", "TRANSFERENCIA DESDE BANCO DEMO", "BANCO DIGITAL DEMO", "BANCO DEMO", "transfers")
		}

		if acc.coopSavings != nil {
			out(aporte, 10, 11, acc.coopSavings,
				"APORTE A COOPERATIVA DEMO", "APORTE DESDE BANCO DEMO", "COOPERATIVA DEMO", "BANCO DEMO", "savings")
			interest := pesosBetween(rng, 1_000, 4_000)
			if maxDay >= 28 {
				h.add(acc.coopSavings.ID, at(28, 10, 0), interest, "INTERESES COOPERATIVA DEMO", "COOPERATIVA DEMO", "income_other")
			}
		}

		// Variable spending on Banco Demo Ahorros: what is left of the salary,
		// plus or minus a small saving, so the month nets close to zero.
		saving := (rng.Int63n(101) - 50) * salary / 10000 / (1000 * peso) * (1000 * peso)
		left := (salary-rent-utilBase-saving)*int64(maxDay)/int64(dim) - cardPay - transfersOut
		h.variableSpending(sv, left, maxDay, at)

		bdPlan.charges = append(bdPlan.charges, h.spent[bdPlan.card.ID])
		if digPlan != nil {
			digPlan.charges = append(digPlan.charges, h.spent[digPlan.card.ID])
		}
		month++
	}

	// The last payment brings each card down to its final debt.
	finalPayment := func(p *cardPlan, desc, abono, name string) {
		var sum int64
		for _, e := range h.events {
			if e.accID == p.card.ID {
				sum += e.amount
			}
		}
		if pay := p.card.BalanceMinor - sum; pay > 0 {
			at := refTime.Add(-time.Hour)
			h.transfer(p.payer, p.card.ID, at, pay, desc, abono, name, name, "card_payment")
		}
	}
	finalPayment(bdPlan, "PAGO TARJETA DE CREDITO BANCO DEMO", "ABONO PAGO TARJETA BANCO DEMO", "BANCO DEMO")
	if digPlan != nil {
		finalPayment(digPlan, "PAGO TARJETA DE CREDITO BANCO DIGITAL DEMO", "ABONO PAGO TARJETA BANCO DIGITAL DEMO", "BANCO DIGITAL DEMO")
	}

	// The CDT is funded from Banco Demo Ahorros on its opening date.
	if acc.bdCDT != nil {
		opened, err := time.Parse("2006-01-02", acc.bdCDT.CDT.Opened)
		if err == nil {
			when := opened.Add(12 * time.Hour)
			h.transfer(sv, acc.bdCDT.ID, when, acc.bdCDT.BalanceMinor,
				"APERTURA CDT DIGITAL DEMO", "APERTURA CDT DIGITAL DEMO", "BANCO DEMO", "BANCO DEMO", "savings")
		}
	}

	return h.assemble(accounts), subs
}

// variableSpending adds groceries, restaurants and shopping that add up to total.
func (h *historyBuilder) variableSpending(accID string, total int64, maxDay int, at func(day, hour, min int) time.Time) {
	if total < 100_000*peso {
		return
	}
	kinds := []struct {
		pct, size           int64
		desc, merchant, cat string
		hour, minute        int
	}{
		{40, 180_000 * peso, "SUPERMERCADO DEMO", "SUPERMERCADO DEMO", "groceries", 18, 20},
		{25, 70_000 * peso, "RESTAURANTE DEMO", "RESTAURANTE DEMO", "restaurants", 20, 30},
		{35, 350_000 * peso, "COMPRA COMERCIO DEMO", "TIENDA DEMO", "shopping", 16, 5},
	}
	for _, k := range kinds {
		amount := total * k.pct / 100 / peso * peso
		n := int(ceilDiv(amount, k.size))
		for i, part := range splitAmount(h.rng, amount, n) {
			day := 1 + h.rng.Intn(maxDay)
			h.add(accID, at(day, k.hour, (k.minute+i*3)%60), -part, k.desc, k.merchant, k.cat)
		}
	}
}

// assemble groups the events by account, fixes deposit accounts that would go
// below zero, adds the opening balance and returns the transactions.
func (h *historyBuilder) assemble(accounts []Account) []Transaction {
	start := windowStart(h.refTime)
	var txs []Transaction
	for _, a := range accounts {
		var evs []event
		for _, e := range h.events {
			if e.accID == a.ID {
				evs = append(evs, e)
			}
		}
		if a.Type == AccountTypeSavings || a.Type == AccountTypeWallet {
			evs = h.keepAboveZero(a.ID, a.BalanceMinor, evs, start)
		}
		var sum int64
		for _, e := range evs {
			sum += e.amount
		}
		if opening := a.BalanceMinor - sum; opening != 0 {
			txs = append(txs, openingTx(a, opening, start))
		}
		for _, e := range evs {
			txs = append(txs, Transaction{
				AccountID:       a.ID,
				BookingDateTime: e.at,
				Amount:          MinorToDecimal(e.amount, true),
				AmountMinor:     e.amount,
				Status:          TransactionStatusBooked,
				Description:     e.desc,
				MerchantName:    strPtr(e.merchant),
				Category:        strPtr(e.category),
				Simulated:       true,
				ProviderID:      a.ProviderID,
			})
		}
	}
	return finishTransactions(txs)
}

// keepAboveZero makes sure the running balance of a deposit account never goes
// below zero. Where it would, it adds extra purchases after the movement that
// brings the balance back to zero or more for the last time, spread up to refTime.
// A purchase raises every earlier balance by its amount and leaves the later ones
// alone, so one pass is enough.
// The final balance and the fixed items never change.
func (h *historyBuilder) keepAboveZero(accID string, final int64, evs []event, start time.Time) []event {
	sorted := append([]event(nil), evs...)
	sort.SliceStable(sorted, func(a, b int) bool { return sorted[a].at.Before(sorted[b].at) })
	var sum int64
	for _, e := range sorted {
		sum += e.amount
	}
	running := final - sum // opening balance
	lowest := running
	recovered := start // time of the last movement that ends a negative stretch
	negative := running < 0
	for _, e := range sorted {
		running += e.amount
		if running < lowest {
			lowest = running
		}
		if running < 0 {
			negative = true
		} else if negative {
			negative, recovered = false, e.at
		}
	}
	if lowest >= 0 {
		return evs
	}
	var chunks []int64
	for deficit := -lowest; deficit > 0; {
		chunk := min(deficit, (80_000+h.rng.Int63n(220_001))*peso)
		if deficit-chunk < 20_000*peso {
			chunk = deficit
		}
		chunks = append(chunks, chunk)
		deficit -= chunk
	}
	step := h.refTime.Sub(recovered) / time.Duration(len(chunks)+1)
	for k, chunk := range chunks {
		desc, merchant, cat := "SUPERMERCADO DEMO", "SUPERMERCADO DEMO", "groceries"
		if k%2 == 1 {
			desc, merchant, cat = "COMPRA COMERCIO DEMO", "TIENDA DEMO", "shopping"
		}
		at := recovered.Add(step * time.Duration(k+1)).Truncate(time.Minute)
		if !at.After(recovered) {
			at = recovered.Add(time.Minute)
		}
		if at.After(h.refTime) {
			at = h.refTime
		}
		evs = append(evs, event{accID, at, -chunk, desc, merchant, cat})
	}
	return evs
}
