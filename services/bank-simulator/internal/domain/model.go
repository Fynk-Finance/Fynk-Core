package domain

import (
	"fmt"
	"time"
)

type AccountType string

const (
	AccountTypeSavings    AccountType = "SAVINGS"
	AccountTypeWallet     AccountType = "WALLET"
	AccountTypeCreditCard AccountType = "CREDIT_CARD"
	AccountTypeCDT        AccountType = "CDT"
)

type AccountStatus string

const (
	AccountStatusActive   AccountStatus = "ACTIVE"
	AccountStatusInactive AccountStatus = "INACTIVE"
	AccountStatusClosed   AccountStatus = "CLOSED"
)

type TransactionStatus string

const (
	TransactionStatusBooked  TransactionStatus = "BOOKED"
	TransactionStatusPending TransactionStatus = "PENDING"
)

type ConsentStatus string

const (
	ConsentStatusActive  ConsentStatus = "active"
	ConsentStatusRevoked ConsentStatus = "revoked"
)

type CdtDetails struct {
	RateEa    float64 `json:"rateEa"`
	RateEaBps int     `json:"rateEaBps"`
	TermDays  int     `json:"termDays"`
	Opened    string  `json:"opened"`
	Maturity  string  `json:"maturity"`
}

type Account struct {
	ID               string        `json:"id"`
	CustomerID       string        `json:"customerId,omitempty"`
	Type             AccountType   `json:"type"`
	Name             string        `json:"name"`
	MaskedNumber     string        `json:"maskedNumber"`
	Currency         string        `json:"currency"`
	Balance          string        `json:"balance"`
	BalanceMinor     int64         `json:"balanceMinor"`
	Available        string        `json:"available"`
	AvailableMinor   int64         `json:"availableMinor"`
	CreditLimit      *string       `json:"creditLimit,omitempty"`
	CreditLimitMinor *int64        `json:"creditLimitMinor,omitempty"`
	PaymentDueDate   *int          `json:"paymentDueDate,omitempty"`
	Status           AccountStatus `json:"status"`
	CDT              *CdtDetails   `json:"cdt,omitempty"`
	Simulated        bool          `json:"simulated"`
}

type Transaction struct {
	ID              string            `json:"id"`
	AccountID       string            `json:"accountId"`
	BookingDateTime time.Time         `json:"bookingDateTime"`
	Amount          string            `json:"amount"`
	AmountMinor     int64             `json:"amountMinor"`
	Status          TransactionStatus `json:"status"`
	Description     string            `json:"description"`
	MerchantName    *string           `json:"merchantName,omitempty"`
	Category        *string           `json:"category,omitempty"`
	Simulated       bool              `json:"simulated"`
}

type Consent struct {
	ID         string        `json:"id"`
	CustomerID string        `json:"customerId"`
	ClientID   string        `json:"clientId"`
	Scopes     []string      `json:"scopes"`
	Purpose    string        `json:"purpose"`
	TermDays   int           `json:"termDays"`
	Status     ConsentStatus `json:"status"`
	CreatedAt  time.Time     `json:"createdAt"`
	GrantedAt  time.Time     `json:"grantedAt"`
	RevokedAt  *time.Time    `json:"revokedAt,omitempty"`
}

type CdtProduct struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	TermDays       int     `json:"termDays"`
	RateEa         float64 `json:"rateEa"`
	RateEaBps      int     `json:"rateEaBps"`
	MinAmount      string  `json:"minAmount"`
	MinAmountMinor int64   `json:"minAmountMinor"`
	Risk           string  `json:"risk"`
}

// MinorToDecimal formats minor units (centavos) to signed decimal COP string: e.g. 320000000 -> "3200000.00"
func MinorToDecimal(minor int64, signed bool) string {
	sign := ""
	val := minor
	if val < 0 {
		sign = "-"
		val = -val
	} else if signed && val > 0 {
		sign = "+"
	}
	intPart := val / 100
	decPart := val % 100
	return fmt.Sprintf("%s%d.%02d", sign, intPart, decPart)
}
