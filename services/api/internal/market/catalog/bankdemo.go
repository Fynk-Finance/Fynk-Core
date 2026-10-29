package catalog

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// BankDemo reads the public CDT catalog of Banco Demo (GET /open-finance/v1/products/cdt, no
// user token). Interim adapter: once M5 exports its Provider.Products(), the module wires that
// port instead and this file goes away (CLAUDE.md, rule 7).
type BankDemo struct {
	BaseURL string // through the Caddy egress in AWS
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

// Products implements Source.
func (b BankDemo) Products(ctx context.Context) ([]Product, error) {
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
	out := make([]Product, 0, len(body.Data))
	for _, p := range body.Data {
		if p.ID == "" || p.TermDays <= 0 || p.RateEaBps <= 0 {
			continue
		}
		out = append(out, Product{
			ID: p.ID, Name: p.Name, Issuer: "Banco Demo", TermDays: p.TermDays, RateEaBps: p.RateEaBps,
			MinAmountMinor: p.MinAmountMinor, Risk: NormalizeRisk(p.Risk), Simulated: true,
		})
	}
	return out, nil
}
