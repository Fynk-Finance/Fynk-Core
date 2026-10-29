package catalog

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	bankports "github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
)

// ProductLister is the part of M5's bank provider port (bankports.Provider) that the catalog
// uses. Any M5 adapter satisfies it, so the module wires M5's provider once it exists.
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

// BankDemoProducts reads Banco Demo's public CDT catalog (GET /open-finance/v1/products/cdt, no
// user token) through the Caddy egress and answers with M5's bankports.Product. It is the
// Products() half of M5's Banco Demo adapter, which M5 has not built yet: when M5 adds it, the
// module wires M5's provider in FromProvider and this type goes away (CLAUDE.md, rule 7).
type BankDemoProducts struct {
	BaseURL string // <EgressURL>/banco-demo
	Client  *http.Client
}

type bankDemoProduct struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	TermDays       int    `json:"termDays"`
	RateEaBps      int    `json:"rateEaBps"`
	MinAmountMinor int64  `json:"minAmountMinor"`
	Risk           string `json:"risk"`
}

// Products implements ProductLister.
func (b BankDemoProducts) Products(ctx context.Context) ([]bankports.Product, error) {
	url := strings.TrimRight(b.BaseURL, "/") + "/open-finance/v1/products/cdt"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	client := b.Client
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("banco demo products: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("banco demo products: status %d", resp.StatusCode)
	}
	var body struct {
		Data []bankDemoProduct `json:"data"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&body); err != nil {
		return nil, fmt.Errorf("banco demo products: %w", err)
	}
	out := make([]bankports.Product, 0, len(body.Data))
	for _, p := range body.Data {
		out = append(out, bankports.Product{
			ID: p.ID, Name: p.Name, TermDays: p.TermDays, RateEaBps: p.RateEaBps,
			MinAmountMinor: p.MinAmountMinor, Risk: p.Risk,
		})
	}
	return out, nil
}
