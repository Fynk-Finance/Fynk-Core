package market

import (
	"io/fs"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/market/catalog"
	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/market/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/market/migrations"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/market/quotes"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/market/reference"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

// settings of the module, from the environment. The Alpaca keys are secrets (Secrets Manager in
// AWS, .env locally) and are never logged.
type settings struct {
	BankDemoURL  string // MARKET_BANCO_DEMO_URL, Banco Demo through the egress
	BanrepCSVURL string // MARKET_BANREP_CDT_CSV_URL, the published weekly rates file
	AlpacaURL    string // MARKET_ALPACA_DATA_URL, default https://data.alpaca.markets
	AlpacaKeyID  string // ALPACA_API_KEY_ID
	AlpacaSecret string // ALPACA_API_SECRET_KEY
	Symbols      []quotes.Symbol
}

func loadSettings(getenv func(string) string) settings {
	s := settings{
		BankDemoURL:  getenv("MARKET_BANCO_DEMO_URL"),
		BanrepCSVURL: getenv("MARKET_BANREP_CDT_CSV_URL"),
		AlpacaURL:    getenv("MARKET_ALPACA_DATA_URL"),
		AlpacaKeyID:  getenv("ALPACA_API_KEY_ID"),
		AlpacaSecret: getenv("ALPACA_API_SECRET_KEY"),
		Symbols:      quotes.ParseSymbols(getenv("MARKET_SYMBOLS")),
	}
	if s.AlpacaURL == "" {
		s.AlpacaURL = "https://data.alpaca.markets"
	}
	return s
}

// New returns the market module (M15).
func New(d module.Deps) module.Module {
	cfg := loadSettings(os.Getenv)
	now := time.Now
	if d.Clock != nil {
		now = d.Clock.Now
	}
	client := &http.Client{Timeout: 10 * time.Second}

	var cache interface {
		catalog.Cache
		quotes.Cache
	}
	if d.Redis != nil {
		cache = redisCache{rdb: d.Redis}
	}

	var sources []catalog.Source
	if cfg.BankDemoURL != "" {
		sources = append(sources, catalog.BankDemo{BaseURL: cfg.BankDemoURL, Client: client})
	}
	srv := server{
		catalog:   catalog.NewService(cache, now, sources...),
		reference: reference.NewService(pgReferenceStore{db: d.DB}, reference.HTTPFetcher{URL: cfg.BanrepCSVURL, Client: client}, now),
		quotes: quotes.NewService(quotes.Alpaca{
			BaseURL: cfg.AlpacaURL, KeyID: cfg.AlpacaKeyID, SecretKey: cfg.AlpacaSecret, Client: client,
		}, cfg.Symbols, cache, now),
	}
	return mod{Stub: module.Stub{ModuleName: "market"}, deps: d, srv: srv}
}

type mod struct {
	module.Stub
	deps module.Deps
	srv  server
}

// Routes mounts the server generated from the contract behind auth.Require.
func (m mod) Routes(r chi.Router) {
	strict := httpapi.NewStrictHandlerWithOptions(m.srv, nil, httpapi.StrictHTTPServerOptions{
		RequestErrorHandlerFunc:  problem.RequestError,
		ResponseErrorHandlerFunc: problem.ResponseErrorHandler(m.deps.Log),
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		httpapi.HandlerWithOptions(strict, httpapi.ChiServerOptions{
			BaseRouter:       g,
			ErrorHandlerFunc: problem.RequestError,
		})
	})
}

// Migrations implements module.Module: the market schema.
func (mod) Migrations() fs.FS { return migrations.FS }
