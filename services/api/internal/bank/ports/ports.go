// Package ports is the public face of the bank module (shared contracts, section 4.4).
// Every bank is reached through Provider, so a new bank or an aggregator is a new adapter and
// never a change in another module (CLAUDE.md, architecture rule 7). M4 revokes consents at the
// bank through Revoker, and M15 reads the public CDT catalog through Provider.Products.
package ports

import (
	"context"
	"time"
)

// Provider is one bank or wallet. Adapters call it through the Caddy egress, which adds Fynk's
// mTLS client certificate. Tokens are passed through and never stored by the API.
type Provider interface {
	ID() string // 'banco-demo', 'billetera-demo', 'bancolombia'
	PushAuthorization(ctx context.Context, r PARRequest) (PARResult, error)
	ExchangeCode(ctx context.Context, r CodeExchange) (TokenSet, error)
	Refresh(ctx context.Context, refreshToken string) (TokenSet, error)
	Accounts(ctx context.Context, accessToken string) ([]Account, error)
	Transactions(ctx context.Context, accessToken, accountID string, since time.Time, cursor string) (TxPage, error)
	RevokeConsent(ctx context.Context, providerConsentID string) error // client credentials, no user token
	Products(ctx context.Context) ([]Product, error)                   // public catalog, used by M15
}

// Revoker is what M4 calls after it marks a consent revoked in Fynk.
type Revoker interface {
	RevokeConsent(ctx context.Context, provider, providerConsentID string) error
}

// AssertionSigner signs the private_key_jwt client assertion for one bank endpoint: PS256,
// random jti, exp in 60 s. In AWS the key is an asymmetric KMS key that never leaves KMS;
// locally it is a file key behind the same interface (M5 step 2).
type AssertionSigner interface {
	ClientAssertion(ctx context.Context, audience string) (string, error)
}

// PARRequest is the pushed authorization request for one consent.
type PARRequest struct {
	RedirectURI   string // fynk://bank/callback
	Scopes        []Scope
	CodeChallenge string // S256
	State         string
	Nonce         string
	ConsentID     string // Fynk's consent id (M4)
	Purpose       string
	TermDays      int
}

// PARResult is what the app opens in the system browser.
type PARResult struct {
	AuthorizeURL string
	ExpiresIn    time.Duration
}

// CodeExchange trades the authorization code for tokens with PKCE.
type CodeExchange struct {
	Code         string
	CodeVerifier string
	RedirectURI  string
}

// TokenSet is the bank's answer to a code exchange or a refresh.
type TokenSet struct {
	AccessToken       string
	RefreshToken      string
	ExpiresIn         time.Duration
	ProviderConsentID string // the bank's consent id, kept by M4 to revoke it later
}

// AccountKind of the shared Account type, without 'cash', which only exists in the app.
type AccountKind string

// Account kinds a provider reports.
const (
	AccountSavings    AccountKind = "savings"
	AccountChecking   AccountKind = "checking"
	AccountWallet     AccountKind = "wallet"
	AccountCreditCard AccountKind = "credit_card"
	AccountCDT        AccountKind = "cdt"
)

// Account is the shared Account shape as a provider reports it. Amounts are COP centavos and
// only the last 4 digits of the number ever leave an adapter.
type Account struct {
	ProviderAccountID string
	Kind              AccountKind
	DisplayName       string // 'Banco Demo · Ahorros'
	Last4             string // empty when the bank gives no number
	Currency          string // 'COP'
	BalanceMinor      int64  // credit card: amount owed (positive)
	AvailableMinor    *int64 // credit card: available credit
	CreditLimitMinor  *int64
	PaymentDueOn      *time.Time // date only, credit cards
	Closed            bool
	IsSimulated       bool
	CDT               *CDT
}

// CDT details of a cdt account.
type CDT struct {
	RateEaBps int // 1050 = 10,50 % E.A.
	TermDays  int
	OpenedOn  time.Time // date only
	MaturesOn time.Time // date only
}

// TxStatus of a movement.
type TxStatus string

// Movement statuses.
const (
	TxBooked  TxStatus = "booked"
	TxPending TxStatus = "pending"
)

// Transaction is the shared Transaction shape as a provider reports it.
type Transaction struct {
	ProviderTxID string
	BookedAt     time.Time
	AmountMinor  int64 // negative = money out
	Description  string
	MerchantRaw  string // empty when the bank gives none
	BankCategory string // the bank's own category, if any; M7 decides Fynk's
	Status       TxStatus
}

// TxPage is one page of movements, newest first. NextCursor is empty on the last page.
type TxPage struct {
	Items      []Transaction
	NextCursor string
}

// Product is one public CDT product, the same for every user.
type Product struct {
	ID             string
	Name           string
	TermDays       int
	RateEaBps      int
	MinAmountMinor int64
	Risk           string
}
