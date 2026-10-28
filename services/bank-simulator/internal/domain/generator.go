package domain

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"math/rand"
	"sort"
	"time"
)

type Subscription struct {
	ID          string `json:"id"`
	CustomerID  string `json:"customerId"`
	AccountID   string `json:"accountId"`
	Merchant    string `json:"merchantName"`
	AmountMinor int64  `json:"amountMinor"`
	Periodicity string `json:"periodicity"` // 'monthly', 'weekly'
	AnchorDay   int    `json:"anchorDay"`
	Active      bool   `json:"active"`
}

type CustomerData struct {
	CustomerID    string         `json:"customerId"`
	DisplayName   string         `json:"displayName"`
	Accounts      []Account      `json:"accounts"`
	Transactions  []Transaction  `json:"transactions"`
	Subscriptions []Subscription `json:"subscriptions"`
	CdtProducts   []CdtProduct   `json:"cdtProducts"`
}

// DefaultCdtProducts returns the standard CDT catalog of Banco Demo.
func DefaultCdtProducts() []CdtProduct {
	return []CdtProduct{
		{
			ID:             "cdt-demo-90",
			Name:           "CDT Digital Banco Demo 90 Días",
			TermDays:       90,
			RateEa:         10.15,
			RateEaBps:      1015,
			MinAmount:      "500000.00",
			MinAmountMinor: 50000000,
			Risk:           "BAJO",
		},
		{
			ID:             "cdt-demo-180",
			Name:           "CDT Digital Banco Demo 180 Días",
			TermDays:       180,
			RateEa:         10.50,
			RateEaBps:      1050,
			MinAmount:      "500000.00",
			MinAmountMinor: 50000000,
			Risk:           "BAJO",
		},
		{
			ID:             "cdt-demo-360",
			Name:           "CDT Digital Banco Demo 360 Días",
			TermDays:       360,
			RateEa:         10.85,
			RateEaBps:      1085,
			MinAmount:      "1000000.00",
			MinAmountMinor: 100000000,
			Risk:           "BAJO",
		},
	}
}

// GenerateCustomerData creates a deterministic 12-month financial history for a customer.
// For the main demo user, final balances match the design specification:
// Ahorros: $3.200.000, Billetera: $4.600.000, Tarjeta deuda: $500.000, CDT: $2.000.000.
func GenerateCustomerData(customerID string, refTime time.Time) *CustomerData {
	if refTime.IsZero() {
		refTime = time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC)
	}

	h := sha256.Sum256([]byte(customerID))
	seed := int64(binary.BigEndian.Uint64(h[:8]))
	rng := rand.New(rand.NewSource(seed))

	// Target balances in minor centavos (COP)
	targetAhorros := int64(320000000) // $3.200.000 COP
	targetWallet := int64(460000000)  // $4.600.000 COP
	targetCardDebt := int64(50000000) // $500.000 COP debt
	targetCdt := int64(200000000)     // $2.000.000 COP

	accAhorrosID := fmt.Sprintf("acc-ahorros-%x", h[:4])
	accWalletID := fmt.Sprintf("acc-wallet-%x", h[:4])
	accCardID := fmt.Sprintf("acc-card-%x", h[:4])
	accCdtID := fmt.Sprintf("acc-cdt-%x", h[:4])

	creditLimit := int64(500000000) // $5.000.000 limit
	creditLimitStr := MinorToDecimal(creditLimit, false)
	dueDay := 5

	// CDT dates
	openedDate := refTime.AddDate(0, -2, 0).Format("2006-01-02")
	maturityDate := refTime.AddDate(0, 4, 0).Format("2006-01-02")

	accounts := []Account{
		{
			ID:             accAhorrosID,
			CustomerID:     customerID,
			Type:           AccountTypeSavings,
			Name:           "Cuenta de Ahorros Demo",
			MaskedNumber:   "****4821",
			Currency:       "COP",
			Balance:        MinorToDecimal(targetAhorros, false),
			BalanceMinor:   targetAhorros,
			Available:      MinorToDecimal(targetAhorros, false),
			AvailableMinor: targetAhorros,
			Status:         AccountStatusActive,
			Simulated:      true,
		},
		{
			ID:             accWalletID,
			CustomerID:     customerID,
			Type:           AccountTypeWallet,
			Name:           "Billetera Demo",
			MaskedNumber:   "****9104",
			Currency:       "COP",
			Balance:        MinorToDecimal(targetWallet, false),
			BalanceMinor:   targetWallet,
			Available:      MinorToDecimal(targetWallet, false),
			AvailableMinor: targetWallet,
			Status:         AccountStatusActive,
			Simulated:      true,
		},
		{
			ID:               accCardID,
			CustomerID:       customerID,
			Type:             AccountTypeCreditCard,
			Name:             "Tarjeta de Crédito Demo",
			MaskedNumber:     "****3312",
			Currency:         "COP",
			Balance:          MinorToDecimal(-targetCardDebt, true),
			BalanceMinor:     -targetCardDebt,
			Available:        MinorToDecimal(creditLimit-targetCardDebt, false),
			AvailableMinor:   creditLimit - targetCardDebt,
			CreditLimit:      &creditLimitStr,
			CreditLimitMinor: &creditLimit,
			PaymentDueDate:   &dueDay,
			Status:           AccountStatusActive,
			Simulated:        true,
		},
		{
			ID:             accCdtID,
			CustomerID:     customerID,
			Type:           AccountTypeCDT,
			Name:           "CDT Digital 180 Días",
			MaskedNumber:   "****7701",
			Currency:       "COP",
			Balance:        MinorToDecimal(targetCdt, false),
			BalanceMinor:   targetCdt,
			Available:      MinorToDecimal(targetCdt, false),
			AvailableMinor: targetCdt,
			Status:         AccountStatusActive,
			CDT: &CdtDetails{
				RateEa:    10.50,
				RateEaBps: 1050,
				TermDays:  180,
				Opened:    openedDate,
				Maturity:  maturityDate,
			},
			Simulated: true,
		},
	}

	subscriptions := []Subscription{
		{
			ID:          "sub-01-video",
			CustomerID:  customerID,
			AccountID:   accCardID,
			Merchant:    "STREAMING VIDEO PLUS",
			AmountMinor: 3890000, // $38.900
			Periodicity: "monthly",
			AnchorDay:   28,
			Active:      true,
		},
		{
			ID:          "sub-02-series",
			CustomerID:  customerID,
			AccountID:   accCardID,
			Merchant:    "STREAMING SERIES DEMO",
			AmountMinor: 3290000, // $32.900
			Periodicity: "monthly",
			AnchorDay:   2,
			Active:      true,
		},
		{
			ID:          "sub-03-musica",
			CustomerID:  customerID,
			AccountID:   accWalletID,
			Merchant:    "STREAMING MUSICA DEMO",
			AmountMinor: 1690000, // $16.900
			Periodicity: "monthly",
			AnchorDay:   7,
			Active:      true,
		},
		{
			ID:          "sub-04-nube",
			CustomerID:  customerID,
			AccountID:   accWalletID,
			Merchant:    "NUBE STORAGE DEMO",
			AmountMinor: 2390000, // $23.900
			Periodicity: "monthly",
			AnchorDay:   15,
			Active:      true,
		},
	}

	var txs []Transaction
	txCounter := 1

	addTx := func(accID string, t time.Time, amountMinor int64, desc string, merchant *string, category *string, status TransactionStatus) {
		txs = append(txs, Transaction{
			ID:              fmt.Sprintf("tx-%05d", txCounter),
			AccountID:       accID,
			BookingDateTime: t,
			Amount:          MinorToDecimal(amountMinor, true),
			AmountMinor:     amountMinor,
			Status:          status,
			Description:     desc,
			MerchantName:    merchant,
			Category:        category,
			Simulated:       true,
		})
		txCounter++
	}

	// Helper string pointers
	strPtr := func(s string) *string { return &s }

	// Generate months from 12 months ago up to refTime's month
	// E.g. refTime = Oct 2026 -> from Oct 2025 to Oct 2026 (13 calendar months)
	startYear, startMonth, _ := refTime.AddDate(-1, 0, 0).Date()
	currYear, currMonth, currDay := refTime.Date()

	for d := time.Date(startYear, startMonth, 1, 0, 0, 0, 0, time.UTC); !d.After(refTime); d = d.AddDate(0, 1, 0) {
		y, m, _ := d.Date()
		isCurrentMonth := (y == currYear && m == currMonth)
		daysInMonth := time.Date(y, m+1, 0, 0, 0, 0, 0, time.UTC).Day()
		maxDay := daysInMonth
		if isCurrentMonth {
			maxDay = currDay
		}

		// 1. Arriendo: Day 1 (-1.400.000 on Ahorros)
		if maxDay >= 1 {
			addTx(accAhorrosID, time.Date(y, m, 1, 8, 30, 0, 0, time.UTC), -140000000,
				"ARRIENDO INMOBILIARIA DEMO", strPtr("INMOBILIARIA DEMO"), strPtr("rent"), TransactionStatusBooked)
		}

		// 2. Subscriptions
		// Streaming de series: Day 2 (-32.900 on Card)
		if maxDay >= 2 {
			addTx(accCardID, time.Date(y, m, 2, 9, 15, 0, 0, time.UTC), -3290000,
				"STREAMING SERIES DEMO", strPtr("STREAMING SERIES DEMO"), strPtr("subscriptions"), TransactionStatusBooked)
		}

		// 3. Pago de tarjeta: Day 5 (from Ahorros to Card)
		// Pays previous month's card balance
		if maxDay >= 5 {
			paymentAmount := int64(85000000 + (rng.Int63n(10)-5)*1000000) // ~800k - 900k
			if isCurrentMonth {
				// Pay whatever was accumulated previously so current remaining debt lands around 500k
				paymentAmount = 88000000
			}
			addTx(accAhorrosID, time.Date(y, m, 5, 10, 0, 0, 0, time.UTC), -paymentAmount,
				"PAGO TARJETA DE CREDITO BANCO DEMO", strPtr("BANCO DEMO"), strPtr("card_payment"), TransactionStatusBooked)
			addTx(accCardID, time.Date(y, m, 5, 10, 0, 0, 0, time.UTC), paymentAmount,
				"ABONO PAGO TARJETA BANCO DEMO", strPtr("BANCO DEMO"), strPtr("card_payment"), TransactionStatusBooked)
		}

		// Música: Day 7 (-16.900 on Wallet)
		if maxDay >= 7 {
			addTx(accWalletID, time.Date(y, m, 7, 7, 0, 0, 0, time.UTC), -1690000,
				"STREAMING MUSICA DEMO", strPtr("STREAMING MUSICA DEMO"), strPtr("subscriptions"), TransactionStatusBooked)
		}

		// Almacenamiento en la nube: Day 15 (-23.900 on Wallet)
		if maxDay >= 15 {
			addTx(accWalletID, time.Date(y, m, 15, 12, 0, 0, 0, time.UTC), -2390000,
				"NUBE STORAGE DEMO", strPtr("NUBE STORAGE DEMO"), strPtr("subscriptions"), TransactionStatusBooked)
		}

		// Transferencia periódica a billetera para cubrir gastos (Day 15)
		if maxDay >= 15 {
			addTx(accAhorrosID, time.Date(y, m, 15, 13, 0, 0, 0, time.UTC), -100000000,
				"TRANSFERENCIA A BILLETERA DEMO", strPtr("BILLETERA DEMO"), strPtr("transfers"), TransactionStatusBooked)
			addTx(accWalletID, time.Date(y, m, 15, 13, 0, 0, 0, time.UTC), 100000000,
				"TRANSFERENCIA DESDE AHORROS DEMO", strPtr("BANCO DEMO"), strPtr("transfers"), TransactionStatusBooked)
		}

		// Servicios públicos: Day 26 (-186.000 in latest month, earlier vary ± 20%)
		if maxDay >= 26 {
			utilAmount := int64(18600000)
			if !isCurrentMonth {
				variance := float64(rng.Intn(41)-20) / 100.0 // -0.20 to +0.20
				utilAmount = int64(float64(18600000) * (1.0 + variance))
			}
			addTx(accAhorrosID, time.Date(y, m, 26, 14, 30, 0, 0, time.UTC), -utilAmount,
				"EMPRESA DE SERVICIOS DEMO", strPtr("EMPRESA DE SERVICIOS DEMO"), strPtr("utilities"), TransactionStatusBooked)
		}

		// Streaming de video: Day 28 (-38.900 on Card)
		if maxDay >= 28 {
			addTx(accCardID, time.Date(y, m, 28, 16, 45, 0, 0, time.UTC), -3890000,
				"STREAMING VIDEO PLUS", strPtr("STREAMING VIDEO PLUS"), strPtr("subscriptions"), TransactionStatusBooked)
		}

		// Salario: Day 30 (or last day of month if Feb / 30-day month)
		payday := 30
		if payday > daysInMonth {
			payday = daysInMonth
		}
		if maxDay >= payday {
			addTx(accAhorrosID, time.Date(y, m, payday, 8, 0, 0, 0, time.UTC), 520000000,
				"NOMINA EMPRESA DEMO SAS", strPtr("EMPRESA DEMO SAS"), strPtr("salary"), TransactionStatusBooked)
			// Secondary transfer to Wallet on payday
			addTx(accAhorrosID, time.Date(y, m, payday, 11, 0, 0, 0, time.UTC), -120000000,
				"TRANSFERENCIA A BILLETERA DEMO", strPtr("BILLETERA DEMO"), strPtr("transfers"), TransactionStatusBooked)
			addTx(accWalletID, time.Date(y, m, payday, 11, 0, 0, 0, time.UTC), 120000000,
				"TRANSFERENCIA DESDE AHORROS DEMO", strPtr("BANCO DEMO"), strPtr("transfers"), TransactionStatusBooked)
		}

		// Daily/Weekly occurrences:
		for day := 1; day <= maxDay; day++ {
			dayDate := time.Date(y, m, day, 0, 0, 0, 0, time.UTC)
			weekday := dayDate.Weekday()

			// Gimnasio: every Monday (-22.250 on Wallet)
			if weekday == time.Monday {
				addTx(accWalletID, dayDate.Add(7*time.Hour), -2225000,
					"GIMNASIO DEMO", strPtr("GIMNASIO DEMO"), strPtr("gym"), TransactionStatusBooked)
			}

			// Transporte: every weekday Monday to Friday (-6.500 on Wallet)
			if weekday >= time.Monday && weekday <= time.Friday {
				addTx(accWalletID, dayDate.Add(8*time.Hour), -650000,
					"TRANSPORTE URBANO DEMO", strPtr("TRANSPORTE URBANO DEMO"), strPtr("transport"), TransactionStatusBooked)
			}
		}

		// Antojos: 10 to 20 a month under 20.000 (Wallet)
		numAntojos := 10 + rng.Intn(10)
		for i := 0; i < numAntojos; i++ {
			day := 1 + rng.Intn(maxDay)
			antojoAmount := int64(600000 + rng.Intn(13500)*100) // between 6.000 and 19.500
			t := time.Date(y, m, day, 15, 10+i, 0, 0, time.UTC)
			addTx(accWalletID, t, -antojoAmount,
				"CAFE Y ANTOJOS DEMO", strPtr("CAFE Y ANTOJOS DEMO"), strPtr("treats"), TransactionStatusBooked)
		}

		// Mercado: 4 to 6 purchases a month, 60.000 to 250.000 (Ahorros / Card)
		numMercados := 4 + rng.Intn(3)
		for i := 0; i < numMercados; i++ {
			day := 1 + rng.Intn(maxDay)
			mercadoAmount := int64(6000000 + rng.Intn(190000)*100)
			acc := accAhorrosID
			if i%2 == 0 {
				acc = accCardID
			}
			t := time.Date(y, m, day, 18, 20+i, 0, 0, time.UTC)
			addTx(acc, t, -mercadoAmount,
				"SUPERMERCADO DEMO", strPtr("SUPERMERCADO DEMO"), strPtr("groceries"), TransactionStatusBooked)
		}

		// Restaurantes: 6 to 10 a month, 25.000 to 90.000 (Card)
		// Current month is ~30% higher
		numRestaurantes := 6 + rng.Intn(5)
		if isCurrentMonth {
			numRestaurantes = int(float64(numRestaurantes) * 1.3)
		}
		for i := 0; i < numRestaurantes; i++ {
			day := 1 + rng.Intn(maxDay)
			restAmount := int64(2500000 + rng.Intn(65000)*100)
			if isCurrentMonth {
				restAmount = int64(float64(restAmount) * 1.3)
			}
			t := time.Date(y, m, day, 20, 15+i, 0, 0, time.UTC)
			addTx(accCardID, t, -restAmount,
				"RESTAURANTE DEMO", strPtr("RESTAURANTE DEMO"), strPtr("restaurants"), TransactionStatusBooked)
		}

		// One-off purchases: 3 to 5 a year (Card), 300.000 to 1.500.000
		if m == 12 || m == 4 || m == 7 {
			oneOffAmount := int64(45000000 + rng.Intn(600000)*100)
			t := time.Date(y, m, 18, 16, 0, 0, 0, time.UTC)
			addTx(accCardID, t, -oneOffAmount,
				"COMPRA COMERCIO DEMO", strPtr("TIENDA DEMO"), strPtr("shopping"), TransactionStatusBooked)
		}
	}

	// CDT funding: 60 days ago (-2.000.000 on Ahorros)
	cdtDate := refTime.AddDate(0, -2, 0)
	addTx(accAhorrosID, cdtDate, -targetCdt,
		"APERTURA CDT DIGITAL DEMO", strPtr("BANCO DEMO"), strPtr("savings"), TransactionStatusBooked)

	// Sort transactions chronologically
	sort.Slice(txs, func(i, j int) bool {
		return txs[i].BookingDateTime.Before(txs[j].BookingDateTime)
	})

	// Adjust opening balances at the very beginning of the 12-month period
	// so sum(txs) for each account equals the target balance exactly!
	sumByAcc := make(map[string]int64)
	for _, tx := range txs {
		sumByAcc[tx.AccountID] += tx.AmountMinor
	}

	genesisTime := time.Date(startYear, startMonth, 1, 0, 1, 0, 0, time.UTC)

	// Opening adjustments
	diffAhorros := targetAhorros - sumByAcc[accAhorrosID]
	diffWallet := targetWallet - sumByAcc[accWalletID]
	diffCard := (-targetCardDebt) - sumByAcc[accCardID]

	var adjustedTxs []Transaction
	adjustedTxs = append(adjustedTxs, Transaction{
		ID:              fmt.Sprintf("tx-%05d", txCounter),
		AccountID:       accAhorrosID,
		BookingDateTime: genesisTime,
		Amount:          MinorToDecimal(diffAhorros, true),
		AmountMinor:     diffAhorros,
		Status:          TransactionStatusBooked,
		Description:     "SALDO INICIAL CUENTA DE AHORROS",
		MerchantName:    strPtr("BANCO DEMO"),
		Category:        strPtr("income_other"),
		Simulated:       true,
	})
	txCounter++

	adjustedTxs = append(adjustedTxs, Transaction{
		ID:              fmt.Sprintf("tx-%05d", txCounter),
		AccountID:       accWalletID,
		BookingDateTime: genesisTime,
		Amount:          MinorToDecimal(diffWallet, true),
		AmountMinor:     diffWallet,
		Status:          TransactionStatusBooked,
		Description:     "SALDO INICIAL BILLETERA DIGITAL",
		MerchantName:    strPtr("BILLETERA DEMO"),
		Category:        strPtr("income_other"),
		Simulated:       true,
	})
	txCounter++

	if diffCard != 0 {
		adjustedTxs = append(adjustedTxs, Transaction{
			ID:              fmt.Sprintf("tx-%05d", txCounter),
			AccountID:       accCardID,
			BookingDateTime: genesisTime,
			Amount:          MinorToDecimal(diffCard, true),
			AmountMinor:     diffCard,
			Status:          TransactionStatusBooked,
			Description:     "AJUSTE INICIAL TARJETA DE CREDITO",
			MerchantName:    strPtr("BANCO DEMO"),
			Category:        strPtr("other"),
			Simulated:       true,
		})
		txCounter++
	}

	adjustedTxs = append(adjustedTxs, txs...)

	// Sort newest first as required by the API specification
	sort.Slice(adjustedTxs, func(i, j int) bool {
		return adjustedTxs[i].BookingDateTime.After(adjustedTxs[j].BookingDateTime)
	})

	return &CustomerData{
		CustomerID:    customerID,
		DisplayName:   "Cliente Demo",
		Accounts:      accounts,
		Transactions:  adjustedTxs,
		Subscriptions: subscriptions,
		CdtProducts:   DefaultCdtProducts(),
	}
}
