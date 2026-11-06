package ports

import "sync"

// Scope is one kind of data a provider can share. The values are the same as M4's consent scopes.
type Scope string

// Scopes, as shown on Conectar banco.
const (
	ScopeBalances       Scope = "balances"        // Saldos
	ScopeTransactions   Scope = "transactions"    // Movimientos
	ScopeAccountDetails Scope = "account_details" // Datos de la cuenta
)

// Kind is how the app groups a provider.
type Kind string

// Provider kinds.
const (
	KindBank   Kind = "bank"
	KindWallet Kind = "wallet"
)

// Info describes a provider for GET /providers and for M4's scope check.
type Info struct {
	ID          string
	DisplayName string
	Kind        Kind
	IsSimulated bool // Banco Demo and Billetera Demo: the app shows "Simulado"
	Scopes      []Scope
	LogoKey     string
}

// catalog lists the simulated providers, always offered, in display order. A real bank joins
// at startup through Offer, only when its adapter is configured (Bancolombia, ADR 0003).
var catalog = []Info{
	{ID: "banco-demo", DisplayName: "Banco Demo", Kind: KindBank, IsSimulated: true, LogoKey: "banco-demo",
		Scopes: []Scope{ScopeBalances, ScopeTransactions, ScopeAccountDetails}},
	{ID: "billetera-demo", DisplayName: "Billetera Demo", Kind: KindWallet, IsSimulated: true, LogoKey: "billetera-demo",
		Scopes: []Scope{ScopeBalances, ScopeTransactions, ScopeAccountDetails}},
}

var (
	offeredMu sync.RWMutex
	offered   []Info
)

// Offer sets the real providers whose adapter the bank module built at startup, listed after
// the simulated ones. Offer() with nothing takes them out again.
func Offer(infos ...Info) {
	list := make([]Info, len(infos))
	for i, p := range infos {
		list[i] = p.clone()
	}
	offeredMu.Lock()
	offered = list
	offeredMu.Unlock()
}

func all() []Info {
	offeredMu.RLock()
	defer offeredMu.RUnlock()
	return append(append([]Info(nil), catalog...), offered...)
}

// Providers returns a copy of the providers the user can connect, the same for every user.
func Providers() []Info {
	list := all()
	out := make([]Info, len(list))
	for i, p := range list {
		out[i] = p.clone()
	}
	return out
}

// Lookup returns one provider, or false when it is unknown or not offered.
func Lookup(id string) (Info, bool) {
	for _, p := range all() {
		if p.ID == id {
			return p.clone(), true
		}
	}
	return Info{}, false
}

func (p Info) clone() Info {
	p.Scopes = append([]Scope(nil), p.Scopes...)
	return p
}
