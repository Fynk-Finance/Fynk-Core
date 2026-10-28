package store

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/domain"
)

var (
	ErrConsentNotFound     = errors.New("consent not found")
	ErrConsentRevoked      = errors.New("consent_revoked")
	ErrAccountNotFound     = errors.New("account not found")
	ErrCustomerNotFound    = errors.New("customer not found")
	ErrSubscriptionNotFound = errors.New("subscription not found")
	ErrInsufficientFunds   = errors.New("insufficient funds")
)

type RateLimiter struct {
	mu      sync.Mutex
	history map[string][]time.Time
	limit   int
	window  time.Duration
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		history: make(map[string][]time.Time),
		limit:   limit,
		window:  window,
	}
}

func (rl *RateLimiter) Allow(key string, now time.Time) (bool, int) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	cutoff := now.Add(-rl.window)
	timestamps := rl.history[key]
	var valid []time.Time
	for _, t := range timestamps {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}

	if len(valid) >= rl.limit {
		oldest := valid[0]
		retryAfter := int(rl.window.Seconds() - now.Sub(oldest).Seconds())
		if retryAfter <= 0 {
			retryAfter = 1
		}
		rl.history[key] = valid
		return false, retryAfter
	}

	valid = append(valid, now)
	rl.history[key] = valid
	return true, 0
}

type BankStore struct {
	mu          sync.RWMutex
	customers   map[string]*domain.CustomerData
	consents    map[string]*domain.Consent
	rateLimiter *RateLimiter
	refTime     time.Time
	timeOffset  time.Duration
}

func NewBankStore(refTime time.Time) *BankStore {
	if refTime.IsZero() {
		refTime = time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC)
	}

	store := &BankStore{
		customers:   make(map[string]*domain.CustomerData),
		consents:    make(map[string]*domain.Consent),
		rateLimiter: NewRateLimiter(60, time.Minute), // 60 requests per minute
		refTime:     refTime,
	}

	// Seed standard demo user
	demoCustomerID := "cliente.demo@bancodemo.local"
	demoConsentID := "consent-demo-001"
	store.CreateConsent(demoConsentID, demoCustomerID, "fynk-client", []string{"accounts", "transactions"}, "Fynk demo sync", 365)

	return store
}

func (s *BankStore) nowLocked() time.Time {
	return time.Now().UTC().Add(s.timeOffset)
}

func (s *BankStore) Now() time.Time {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.nowLocked()
}

func (s *BankStore) CreateConsent(id, customerID, clientID string, scopes []string, purpose string, termDays int) *domain.Consent {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now().UTC()
	c := &domain.Consent{
		ID:         id,
		CustomerID: customerID,
		ClientID:   clientID,
		Scopes:     scopes,
		Purpose:    purpose,
		TermDays:   termDays,
		Status:     domain.ConsentStatusActive,
		CreatedAt:  now,
		GrantedAt:  now,
	}
	s.consents[id] = c

	if _, ok := s.customers[customerID]; !ok {
		s.customers[customerID] = domain.GenerateCustomerData(customerID, s.refTime)
	}

	return c
}

func (s *BankStore) RevokeConsent(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	c, ok := s.consents[id]
	if !ok {
		return ErrConsentNotFound
	}
	now := time.Now().UTC()
	c.Status = domain.ConsentStatusRevoked
	c.RevokedAt = &now
	return nil
}

func (s *BankStore) GetConsent(id string) (*domain.Consent, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	c, ok := s.consents[id]
	if !ok {
		return nil, ErrConsentNotFound
	}
	return c, nil
}

func (s *BankStore) GetCustomerConsents(customerID string) []*domain.Consent {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*domain.Consent
	for _, c := range s.consents {
		if c.CustomerID == customerID {
			result = append(result, c)
		}
	}
	return result
}

func (s *BankStore) GetCustomer(customerID string) *domain.CustomerData {
	s.mu.Lock()
	defer s.mu.Unlock()

	custData, exists := s.customers[customerID]
	if !exists {
		custData = domain.GenerateCustomerData(customerID, s.refTime)
		s.customers[customerID] = custData
	}
	return custData
}

func (s *BankStore) GetAccounts(consentID string) ([]domain.Account, error) {
	s.mu.RLock()
	c, ok := s.consents[consentID]
	if !ok {
		s.mu.RUnlock()
		return nil, ErrConsentNotFound
	}
	if c.Status == domain.ConsentStatusRevoked {
		s.mu.RUnlock()
		return nil, ErrConsentRevoked
	}
	custData, exists := s.customers[c.CustomerID]
	s.mu.RUnlock()

	if !exists {
		s.mu.Lock()
		custData = domain.GenerateCustomerData(c.CustomerID, s.refTime)
		s.customers[c.CustomerID] = custData
		s.mu.Unlock()
	}

	return custData.Accounts, nil
}

func (s *BankStore) GetTransactions(consentID, accountID string, fromDate time.Time, cursor string, pageSize int) ([]domain.Transaction, bool, string, error) {
	s.mu.RLock()
	c, ok := s.consents[consentID]
	if !ok {
		s.mu.RUnlock()
		return nil, false, "", ErrConsentNotFound
	}
	if c.Status == domain.ConsentStatusRevoked {
		s.mu.RUnlock()
		return nil, false, "", ErrConsentRevoked
	}
	custData, exists := s.customers[c.CustomerID]
	s.mu.RUnlock()

	if !exists {
		return nil, false, "", ErrAccountNotFound
	}

	// Verify account exists
	var accFound bool
	for _, a := range custData.Accounts {
		if a.ID == accountID {
			accFound = true
			break
		}
	}
	if !accFound {
		return nil, false, "", ErrAccountNotFound
	}

	// Filter transactions for this account
	var filtered []domain.Transaction
	for _, tx := range custData.Transactions {
		if tx.AccountID != accountID {
			continue
		}
		if !fromDate.IsZero() && tx.BookingDateTime.Before(fromDate) {
			continue
		}
		filtered = append(filtered, tx)
	}

	if pageSize <= 0 || pageSize > 200 {
		pageSize = 50
	}

	// Cursor is an index offset string
	startIndex := 0
	if cursor != "" {
		var offset int
		if _, err := fmt.Sscanf(cursor, "%d", &offset); err == nil && offset >= 0 && offset < len(filtered) {
			startIndex = offset
		}
	}

	endIndex := startIndex + pageSize
	hasMore := false
	nextCursor := ""

	if endIndex < len(filtered) {
		hasMore = true
		nextCursor = fmt.Sprintf("%d", endIndex)
	} else {
		endIndex = len(filtered)
	}

	page := filtered[startIndex:endIndex]
	return page, hasMore, nextCursor, nil
}

func (s *BankStore) CheckRateLimit(consentID string, now time.Time) (bool, int) {
	return s.rateLimiter.Allow(consentID, now)
}

func (s *BankStore) GetCdtProducts() []domain.CdtProduct {
	return domain.DefaultCdtProducts()
}

// ---------------- Portal Banking Operations ----------------

func (s *BankStore) RecordPayment(customerID, accountID, merchant, category string, amountMinor int64) (*domain.Transaction, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	custData, ok := s.customers[customerID]
	if !ok {
		return nil, ErrCustomerNotFound
	}

	var acc *domain.Account
	for i := range custData.Accounts {
		if custData.Accounts[i].ID == accountID {
			acc = &custData.Accounts[i]
			break
		}
	}
	if acc == nil {
		return nil, ErrAccountNotFound
	}

	if amountMinor <= 0 {
		return nil, errors.New("amount must be greater than zero")
	}

	// Apply debit to account
	acc.BalanceMinor -= amountMinor
	acc.Balance = domain.MinorToDecimal(acc.BalanceMinor, acc.Type == domain.AccountTypeCreditCard)
	acc.AvailableMinor -= amountMinor
	acc.Available = domain.MinorToDecimal(acc.AvailableMinor, false)

	tx := domain.Transaction{
		ID:              fmt.Sprintf("tx-user-%d", time.Now().UnixNano()),
		AccountID:       accountID,
		BookingDateTime: s.nowLocked(),
		Amount:          domain.MinorToDecimal(-amountMinor, true),
		AmountMinor:     -amountMinor,
		Status:          domain.TransactionStatusBooked,
		Description:     fmt.Sprintf("PAGO %s", merchant),
		MerchantName:    &merchant,
		Category:        &category,
		Simulated:       true,
	}

	// Prepend so newest is first
	custData.Transactions = append([]domain.Transaction{tx}, custData.Transactions...)
	return &tx, nil
}

func (s *BankStore) ReceiveMoney(customerID, accountID, description string, amountMinor int64) (*domain.Transaction, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	custData, ok := s.customers[customerID]
	if !ok {
		return nil, ErrCustomerNotFound
	}

	var acc *domain.Account
	for i := range custData.Accounts {
		if custData.Accounts[i].ID == accountID {
			acc = &custData.Accounts[i]
			break
		}
	}
	if acc == nil {
		return nil, ErrAccountNotFound
	}

	if amountMinor <= 0 {
		return nil, errors.New("amount must be greater than zero")
	}

	acc.BalanceMinor += amountMinor
	acc.Balance = domain.MinorToDecimal(acc.BalanceMinor, acc.Type == domain.AccountTypeCreditCard)
	acc.AvailableMinor += amountMinor
	acc.Available = domain.MinorToDecimal(acc.AvailableMinor, false)

	cat := "income_other"
	tx := domain.Transaction{
		ID:              fmt.Sprintf("tx-user-%d", time.Now().UnixNano()),
		AccountID:       accountID,
		BookingDateTime: s.nowLocked(),
		Amount:          domain.MinorToDecimal(amountMinor, true),
		AmountMinor:     amountMinor,
		Status:          domain.TransactionStatusBooked,
		Description:     description,
		Category:        &cat,
		Simulated:       true,
	}

	custData.Transactions = append([]domain.Transaction{tx}, custData.Transactions...)
	return &tx, nil
}

func (s *BankStore) TransferOwn(customerID, fromAccID, toAccID string, amountMinor int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	custData, ok := s.customers[customerID]
	if !ok {
		return ErrCustomerNotFound
	}

	var fromAcc, toAcc *domain.Account
	for i := range custData.Accounts {
		if custData.Accounts[i].ID == fromAccID {
			fromAcc = &custData.Accounts[i]
		}
		if custData.Accounts[i].ID == toAccID {
			toAcc = &custData.Accounts[i]
		}
	}

	if fromAcc == nil || toAcc == nil {
		return ErrAccountNotFound
	}
	if amountMinor <= 0 {
		return errors.New("amount must be positive")
	}

	fromAcc.BalanceMinor -= amountMinor
	fromAcc.Balance = domain.MinorToDecimal(fromAcc.BalanceMinor, fromAcc.Type == domain.AccountTypeCreditCard)
	fromAcc.AvailableMinor -= amountMinor
	fromAcc.Available = domain.MinorToDecimal(fromAcc.AvailableMinor, false)

	toAcc.BalanceMinor += amountMinor
	toAcc.Balance = domain.MinorToDecimal(toAcc.BalanceMinor, toAcc.Type == domain.AccountTypeCreditCard)
	toAcc.AvailableMinor += amountMinor
	toAcc.Available = domain.MinorToDecimal(toAcc.AvailableMinor, false)

	now := s.nowLocked()
	cat := "transfers"
	txOut := domain.Transaction{
		ID:              fmt.Sprintf("tx-trf-out-%d", now.UnixNano()),
		AccountID:       fromAccID,
		BookingDateTime: now,
		Amount:          domain.MinorToDecimal(-amountMinor, true),
		AmountMinor:     -amountMinor,
		Status:          domain.TransactionStatusBooked,
		Description:     fmt.Sprintf("TRANSFERENCIA A %s", toAcc.Name),
		Category:        &cat,
		Simulated:       true,
	}
	txIn := domain.Transaction{
		ID:              fmt.Sprintf("tx-trf-in-%d", now.UnixNano()+1),
		AccountID:       toAccID,
		BookingDateTime: now,
		Amount:          domain.MinorToDecimal(amountMinor, true),
		AmountMinor:     amountMinor,
		Status:          domain.TransactionStatusBooked,
		Description:     fmt.Sprintf("TRANSFERENCIA DESDE %s", fromAcc.Name),
		Category:        &cat,
		Simulated:       true,
	}

	custData.Transactions = append([]domain.Transaction{txOut, txIn}, custData.Transactions...)
	return nil
}

func (s *BankStore) PayCard(customerID, fromAccID, cardAccID string, amountMinor int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	custData, ok := s.customers[customerID]
	if !ok {
		return ErrCustomerNotFound
	}

	var fromAcc, cardAcc *domain.Account
	for i := range custData.Accounts {
		if custData.Accounts[i].ID == fromAccID {
			fromAcc = &custData.Accounts[i]
		}
		if custData.Accounts[i].ID == cardAccID {
			cardAcc = &custData.Accounts[i]
		}
	}

	if fromAcc == nil || cardAcc == nil {
		return ErrAccountNotFound
	}
	if amountMinor <= 0 {
		return errors.New("amount must be positive")
	}

	fromAcc.BalanceMinor -= amountMinor
	fromAcc.Balance = domain.MinorToDecimal(fromAcc.BalanceMinor, false)
	fromAcc.AvailableMinor -= amountMinor
	fromAcc.Available = domain.MinorToDecimal(fromAcc.AvailableMinor, false)

	cardAcc.BalanceMinor += amountMinor // Reducing debt
	cardAcc.Balance = domain.MinorToDecimal(cardAcc.BalanceMinor, true)
	cardAcc.AvailableMinor += amountMinor
	cardAcc.Available = domain.MinorToDecimal(cardAcc.AvailableMinor, false)

	now := s.nowLocked()
	cat := "card_payment"
	txDebit := domain.Transaction{
		ID:              fmt.Sprintf("tx-card-pay-deb-%d", now.UnixNano()),
		AccountID:       fromAccID,
		BookingDateTime: now,
		Amount:          domain.MinorToDecimal(-amountMinor, true),
		AmountMinor:     -amountMinor,
		Status:          domain.TransactionStatusBooked,
		Description:     fmt.Sprintf("PAGO TARJETA %s", cardAcc.MaskedNumber),
		Category:        &cat,
		Simulated:       true,
	}
	txCredit := domain.Transaction{
		ID:              fmt.Sprintf("tx-card-pay-cred-%d", now.UnixNano()+1),
		AccountID:       cardAccID,
		BookingDateTime: now,
		Amount:          domain.MinorToDecimal(amountMinor, true),
		AmountMinor:     amountMinor,
		Status:          domain.TransactionStatusBooked,
		Description:     "ABONO PAGO TARJETA DE CREDITO",
		Category:        &cat,
		Simulated:       true,
	}

	custData.Transactions = append([]domain.Transaction{txDebit, txCredit}, custData.Transactions...)
	return nil
}

func (s *BankStore) OpenCDT(customerID, fromAccID string, productID string, amountMinor int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	custData, ok := s.customers[customerID]
	if !ok {
		return ErrCustomerNotFound
	}

	var fromAcc *domain.Account
	for i := range custData.Accounts {
		if custData.Accounts[i].ID == fromAccID {
			fromAcc = &custData.Accounts[i]
			break
		}
	}
	if fromAcc == nil {
		return ErrAccountNotFound
	}

	var prod *domain.CdtProduct
	for _, p := range domain.DefaultCdtProducts() {
		if p.ID == productID {
			prod = &p
			break
		}
	}
	if prod == nil {
		return errors.New("CDT product not found")
	}

	if amountMinor < prod.MinAmountMinor {
		return fmt.Errorf("amount must be at least %s", prod.MinAmount)
	}

	fromAcc.BalanceMinor -= amountMinor
	fromAcc.Balance = domain.MinorToDecimal(fromAcc.BalanceMinor, false)
	fromAcc.AvailableMinor -= amountMinor
	fromAcc.Available = domain.MinorToDecimal(fromAcc.AvailableMinor, false)

	now := s.nowLocked()
	cdtAccID := fmt.Sprintf("acc-cdt-%d", now.UnixNano())
	newCDT := domain.Account{
		ID:             cdtAccID,
		CustomerID:     customerID,
		Type:           domain.AccountTypeCDT,
		Name:           prod.Name,
		MaskedNumber:   fmt.Sprintf("****%04d", now.Unix()%10000),
		Currency:       "COP",
		Balance:        domain.MinorToDecimal(amountMinor, false),
		BalanceMinor:   amountMinor,
		Available:      domain.MinorToDecimal(amountMinor, false),
		AvailableMinor: amountMinor,
		Status:         domain.AccountStatusActive,
		CDT: &domain.CdtDetails{
			RateEa:    prod.RateEa,
			RateEaBps: prod.RateEaBps,
			TermDays:  prod.TermDays,
			Opened:    now.Format("2006-01-02"),
			Maturity:  now.AddDate(0, 0, prod.TermDays).Format("2006-01-02"),
		},
		Simulated: true,
	}

	cat := "savings"
	tx := domain.Transaction{
		ID:              fmt.Sprintf("tx-cdt-open-%d", now.UnixNano()),
		AccountID:       fromAccID,
		BookingDateTime: now,
		Amount:          domain.MinorToDecimal(-amountMinor, true),
		AmountMinor:     -amountMinor,
		Status:          domain.TransactionStatusBooked,
		Description:     fmt.Sprintf("APERTURA %s", prod.Name),
		Category:        &cat,
		Simulated:       true,
	}

	custData.Accounts = append(custData.Accounts, newCDT)
	custData.Transactions = append([]domain.Transaction{tx}, custData.Transactions...)
	return nil
}

func (s *BankStore) CancelCDT(customerID, cdtAccID, toAccID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	custData, ok := s.customers[customerID]
	if !ok {
		return ErrCustomerNotFound
	}

	var cdtAcc, toAcc *domain.Account
	for i := range custData.Accounts {
		if custData.Accounts[i].ID == cdtAccID {
			cdtAcc = &custData.Accounts[i]
		}
		if custData.Accounts[i].ID == toAccID {
			toAcc = &custData.Accounts[i]
		}
	}

	if cdtAcc == nil || toAcc == nil {
		return ErrAccountNotFound
	}

	amount := cdtAcc.BalanceMinor
	cdtAcc.BalanceMinor = 0
	cdtAcc.Balance = "0.00"
	cdtAcc.AvailableMinor = 0
	cdtAcc.Available = "0.00"
	cdtAcc.Status = domain.AccountStatusClosed

	toAcc.BalanceMinor += amount
	toAcc.Balance = domain.MinorToDecimal(toAcc.BalanceMinor, false)
	toAcc.AvailableMinor += amount
	toAcc.Available = domain.MinorToDecimal(toAcc.AvailableMinor, false)

	now := s.nowLocked()
	cat := "savings"
	tx := domain.Transaction{
		ID:              fmt.Sprintf("tx-cdt-cancel-%d", now.UnixNano()),
		AccountID:       toAccID,
		BookingDateTime: now,
		Amount:          domain.MinorToDecimal(amount, true),
		AmountMinor:     amount,
		Status:          domain.TransactionStatusBooked,
		Description:     fmt.Sprintf("CANCELACION %s", cdtAcc.Name),
		Category:        &cat,
		Simulated:       true,
	}

	custData.Transactions = append([]domain.Transaction{tx}, custData.Transactions...)
	return nil
}

// ---------------- Subscription Actions ----------------

func (s *BankStore) AddSubscription(customerID, accID, merchant string, amountMinor int64, periodicity string, day int) (*domain.Subscription, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	custData, ok := s.customers[customerID]
	if !ok {
		return nil, ErrCustomerNotFound
	}

	sub := domain.Subscription{
		ID:          fmt.Sprintf("sub-custom-%d", time.Now().UnixNano()),
		CustomerID:  customerID,
		AccountID:   accID,
		Merchant:    merchant,
		AmountMinor: amountMinor,
		Periodicity: periodicity,
		AnchorDay:   day,
		Active:      true,
	}

	custData.Subscriptions = append(custData.Subscriptions, sub)
	return &sub, nil
}

func (s *BankStore) UpdateSubscriptionPrice(customerID, subID string, newPriceMinor int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	custData, ok := s.customers[customerID]
	if !ok {
		return ErrCustomerNotFound
	}

	for i := range custData.Subscriptions {
		if custData.Subscriptions[i].ID == subID {
			custData.Subscriptions[i].AmountMinor = newPriceMinor
			return nil
		}
	}
	return ErrSubscriptionNotFound
}

func (s *BankStore) ChargeSubscriptionNow(customerID, subID string) (*domain.Transaction, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	custData, ok := s.customers[customerID]
	if !ok {
		return nil, ErrCustomerNotFound
	}

	var sub *domain.Subscription
	for i := range custData.Subscriptions {
		if custData.Subscriptions[i].ID == subID {
			sub = &custData.Subscriptions[i]
			break
		}
	}
	if sub == nil {
		return nil, ErrSubscriptionNotFound
	}

	var acc *domain.Account
	for i := range custData.Accounts {
		if custData.Accounts[i].ID == sub.AccountID {
			acc = &custData.Accounts[i]
			break
		}
	}
	if acc == nil {
		return nil, ErrAccountNotFound
	}

	acc.BalanceMinor -= sub.AmountMinor
	acc.Balance = domain.MinorToDecimal(acc.BalanceMinor, acc.Type == domain.AccountTypeCreditCard)
	acc.AvailableMinor -= sub.AmountMinor
	acc.Available = domain.MinorToDecimal(acc.AvailableMinor, false)

	now := s.nowLocked()
	cat := "subscriptions"
	tx := domain.Transaction{
		ID:              fmt.Sprintf("tx-sub-charge-%d", now.UnixNano()),
		AccountID:       sub.AccountID,
		BookingDateTime: now,
		Amount:          domain.MinorToDecimal(-sub.AmountMinor, true),
		AmountMinor:     -sub.AmountMinor,
		Status:          domain.TransactionStatusBooked,
		Description:     sub.Merchant,
		MerchantName:    &sub.Merchant,
		Category:        &cat,
		Simulated:       true,
	}

	custData.Transactions = append([]domain.Transaction{tx}, custData.Transactions...)
	return &tx, nil
}

func (s *BankStore) CancelSubscription(customerID, subID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	custData, ok := s.customers[customerID]
	if !ok {
		return ErrCustomerNotFound
	}

	for i := range custData.Subscriptions {
		if custData.Subscriptions[i].ID == subID {
			custData.Subscriptions[i].Active = false
			return nil
		}
	}
	return ErrSubscriptionNotFound
}

// ---------------- Admin Demo Tools ----------------

func (s *BankStore) ResetCustomer(customerID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.customers[customerID] = domain.GenerateCustomerData(customerID, s.refTime)
	s.timeOffset = 0
}

func (s *BankStore) AdvanceTime(customerID string, days int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.timeOffset += time.Duration(days) * 24 * time.Hour
}
