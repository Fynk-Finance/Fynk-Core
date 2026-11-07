package domain

import "time"

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

// DemoCustomerID is the seeded demo user. Its data never changes.
const DemoCustomerID = "cliente.demo@bancodemo.local"

// GenerateCustomerData creates the accounts and 12 months of movements of a customer.
// Every customer still gets the demo user's data; the next change gives the
// others random entities and balances.
func GenerateCustomerData(customerID string, refTime time.Time) *CustomerData {
	if refTime.IsZero() {
		refTime = time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC)
	}
	data := generateDemoCustomer(customerID, refTime)
	tagDemoProviders(data)
	return data
}

// tagDemoProviders sets the provider id on the demo data after it is built,
// so the demo generator itself stays untouched.
func tagDemoProviders(data *CustomerData) {
	provider := make(map[string]string, len(data.Accounts))
	for i := range data.Accounts {
		p := ProviderBancoDemo
		if data.Accounts[i].Type == AccountTypeWallet {
			p = ProviderBilleteraDemo
		}
		data.Accounts[i].ProviderID = p
		provider[data.Accounts[i].ID] = p
	}
	for i := range data.Transactions {
		data.Transactions[i].ProviderID = provider[data.Transactions[i].AccountID]
	}
}
