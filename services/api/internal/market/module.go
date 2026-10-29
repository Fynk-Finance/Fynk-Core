package market

import (
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/adapters/bankdemo"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/egress"
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
// AWS, .env locally) and are never logged. Banco Demo and Alpaca are reached through the egress of
// the shared config (EGRESS_URL, EGRESS_CA_FILE), at /banco-demo and /alpaca.
type settings struct {
	BanrepCSVURL string // MARKET_BANREP_CDT_CSV_URL, the published weekly rates file
	AlpacaKeyID  string // ALPACA_API_KEY_ID
	AlpacaSecret string // ALPACA_API_SECRET_KEY
	Symbols      []quotes.Symbol
}

func loadSettings(getenv func(string) string) settings {
	return settings{
		BanrepCSVURL: getenv("MARKET_BANREP_CDT_CSV_URL"),
		AlpacaKeyID:  getenv("ALPACA_API_KEY_ID"),
		AlpacaSecret: getenv("ALPACA_API_SECRET_KEY"),
		Symbols:      quotes.ParseSymbols(getenv("MARKET_SYMBOLS")),
	}
}

// New returns the market module (M15).
func New(d module.Deps) module.Module {
	cfg := loadSettings(os.Getenv)
	now := time.Now
	if d.Clock != nil {
		now = d.Clock.Now
	}
	log := d.Log
	if log == nil {
		log = slog.Default()
	}
	// M5's egress client: TLS to the Caddy egress (M14), which adds Fynk's mTLS certificate.
	client, err := egress.NewClient(d.Config.EgressCAFile)
	if err != nil {
		log.Warn("market: the egress CA could not be read, calls to Banco Demo and Alpaca will fail", "error", err)
		client = &http.Client{Timeout: egress.Timeout}
	}
	// Without EGRESS_URL both base URLs stay empty and the endpoints answer 503 (fail closed).
	bankDemoURL, _ := egress.BaseURL(d.Config.EgressURL, "banco-demo")
	alpacaURL, _ := egress.BaseURL(d.Config.EgressURL, "alpaca")

	var cache interface {
		catalog.Cache
		quotes.Cache
	}
	if d.Redis != nil {
		cache = redisCache{rdb: d.Redis}
	}

	// The catalog comes from M5's provider port (rule 7): the Banco Demo adapter's Products(),
	// the public CDT catalog read without a user token.
	var sources []catalog.Source
	if bankDemoURL != "" {
		adapter, err := bankdemo.New(bankdemo.Config{
			Provider: "banco-demo", BaseURL: bankDemoURL, HTTP: client, Clock: d.Clock,
		})
		if err != nil {
			log.Warn("market: the Banco Demo adapter could not be built, the CDT catalog is unavailable", "error", err)
		} else {
			sources = append(sources, catalog.FromProvider{Lister: adapter, Issuer: "Banco Demo", Simulated: true})
		}
	}
	srv := server{
		catalog:   catalog.NewService(cache, now, sources...),
		reference: reference.NewService(pgReferenceStore{db: d.DB}, reference.HTTPFetcher{URL: cfg.BanrepCSVURL, Client: client}, now),
		quotes: quotes.NewService(quotes.Alpaca{
			BaseURL: alpacaURL, KeyID: cfg.AlpacaKeyID, SecretKey: cfg.AlpacaSecret, Client: client,
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
