package store

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/domain"
)

var (
	ErrConsentNotFound = errors.New("consent not found")
	ErrConsentRevoked  = errors.New("consent_revoked")
	ErrAccountNotFound = errors.New("account not found")
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
