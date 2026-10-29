package catalog

import (
	"context"

	bankports "github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
)

// ProductLister is the part of M5's bank provider port (bankports.Provider) that the catalog
// uses. Any M5 adapter satisfies it; the module wires M5's Banco Demo adapter.
type ProductLister interface {
	Products(ctx context.Context) ([]bankports.Product, error)
}

// FromProvider turns the public catalog of one bank provider into catalog products.
type FromProvider struct {
	Lister    ProductLister
	Issuer    string // 'Banco Demo'
	Simulated bool   // true for Banco Demo: the app shows "Simulado"
}

// Products implements Source.
func (f FromProvider) Products(ctx context.Context) ([]Product, error) {
	ps, err := f.Lister.Products(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]Product, 0, len(ps))
	for _, p := range ps {
		if p.ID == "" || p.TermDays <= 0 || p.RateEaBps <= 0 {
			continue
		}
		out = append(out, Product{
			ID: p.ID, Name: p.Name, Issuer: f.Issuer, TermDays: p.TermDays, RateEaBps: p.RateEaBps,
			MinAmountMinor: p.MinAmountMinor, Risk: NormalizeRisk(p.Risk), Simulated: f.Simulated,
		})
	}
	return out, nil
}
