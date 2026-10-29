package ports

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

// catalog lists the providers whose adapter works, in display order. Bancolombia joins it only
// if the sandbox spike allows delegated access (M5 work plan step 5).
var catalog = []Info{
	{ID: "banco-demo", DisplayName: "Banco Demo", Kind: KindBank, IsSimulated: true, LogoKey: "banco-demo",
		Scopes: []Scope{ScopeBalances, ScopeTransactions, ScopeAccountDetails}},
	{ID: "billetera-demo", DisplayName: "Billetera Demo", Kind: KindWallet, IsSimulated: true, LogoKey: "billetera-demo",
		Scopes: []Scope{ScopeBalances, ScopeTransactions, ScopeAccountDetails}},
}

// Providers returns a copy of the providers the user can connect, the same for every user.
func Providers() []Info {
	out := make([]Info, len(catalog))
	for i, p := range catalog {
		out[i] = p.clone()
	}
	return out
}

// Lookup returns one provider, or false when it is unknown or not offered.
func Lookup(id string) (Info, bool) {
	for _, p := range catalog {
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
