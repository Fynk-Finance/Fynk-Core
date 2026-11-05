// Package quotes gives reference prices of a fixed list of US stocks, the same for every user,
// from Alpaca market data (IEX feed, delayed). Non commercial reference data: see
// docs/adr/0006-market-data.md.
package quotes

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
	_ "time/tzdata" // America/New_York without the system zone database
)

// Quote is the last price of one symbol, in US cents, and the change against the previous close.
type Quote struct {
	Symbol         string    `json:"symbol"`
	Name           string    `json:"name"`
	LastPriceCents int64     `json:"lastPriceCents"`
	DayChangeBps   int       `json:"dayChangeBps"` // 125 = +1,25 %
	At             time.Time `json:"at"`           // UTC
}

// Board is the answer of POST /market/quotes.
type Board struct {
	Quotes    []Quote   `json:"quotes"`
	FetchedAt time.Time `json:"fetchedAt"`
}

// Symbol is one entry of the fixed list.
type Symbol struct {
	Ticker string
	Name   string
}

// DefaultSymbols is the fixed list of 10 symbols shown to every user.
var DefaultSymbols = []Symbol{
	{"AAPL", "Apple"}, {"MSFT", "Microsoft"}, {"AMZN", "Amazon"}, {"GOOGL", "Alphabet"},
	{"META", "Meta Platforms"}, {"NVDA", "NVIDIA"}, {"TSLA", "Tesla"}, {"KO", "Coca-Cola"},
	{"JPM", "JPMorgan Chase"}, {"V", "Visa"},
}

// ParseSymbols reads "AAPL:Apple,MSFT:Microsoft". An empty string gives DefaultSymbols.
func ParseSymbols(s string) []Symbol {
	if strings.TrimSpace(s) == "" {
		return DefaultSymbols
	}
	var out []Symbol
	for _, part := range strings.Split(s, ",") {
		ticker, name, _ := strings.Cut(strings.TrimSpace(part), ":")
		ticker = strings.ToUpper(strings.TrimSpace(ticker))
		if ticker == "" {
			continue
		}
		if name == "" {
			name = ticker
		}
		out = append(out, Symbol{Ticker: ticker, Name: strings.TrimSpace(name)})
	}
	return out
}

// Cache keeps the board for 15 minutes (Redis).
type Cache interface {
	Get(ctx context.Context, key string, v any) (bool, error)
	Set(ctx context.Context, key string, v any, ttl time.Duration) error
}

// TTL of the cached board.
const TTL = 15 * time.Minute

// ErrUnavailable means Alpaca did not answer and nothing is cached.
var ErrUnavailable = errors.New("quotes unavailable")

// Alpaca is the market data client. Requests go through the Caddy egress in AWS.
type Alpaca struct {
	BaseURL   string // <EgressURL>/alpaca; empty means no egress, so calls fail closed
	KeyID     string // secret, never logged
	SecretKey string // secret, never logged
	Client    *http.Client
}

var newYork = mustZone("America/New_York")

func mustZone(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		panic(err)
	}
	return loc
}

// ParseTime reads an Alpaca timestamp. With an offset it is exact; without one it is US
// Eastern time. The result is UTC.
func ParseTime(s string) (time.Time, error) {
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return t.UTC(), nil
	}
	for _, layout := range []string{"2006-01-02T15:04:05.999999999", "2006-01-02 15:04:05"} {
		if t, err := time.ParseInLocation(layout, s, newYork); err == nil {
			return t.UTC(), nil
		}
	}
	return time.Time{}, fmt.Errorf("alpaca time %q", s)
}

type snapshot struct {
	LatestTrade *struct {
		T string  `json:"t"`
		P float64 `json:"p"`
	} `json:"latestTrade"`
	PrevDailyBar *struct {
		C float64 `json:"c"`
	} `json:"prevDailyBar"`
}

// SnapshotsURL is the request URL. feed=iex is required: without it Alpaca answers 403 on the
// free plan.
func (a Alpaca) SnapshotsURL(symbols []Symbol) string {
	tickers := make([]string, len(symbols))
	for i, s := range symbols {
		tickers[i] = s.Ticker
	}
	q := url.Values{}
	q.Set("symbols", strings.Join(tickers, ","))
	q.Set("feed", "iex")
	return strings.TrimRight(a.BaseURL, "/") + "/v2/stocks/snapshots?" + q.Encode()
}

// Fetch gets the latest trade and previous close of every symbol.
func (a Alpaca) Fetch(ctx context.Context, symbols []Symbol) ([]Quote, error) {
	if a.BaseURL == "" || a.KeyID == "" || a.SecretKey == "" {
		return nil, ErrUnavailable
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, a.SnapshotsURL(symbols), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("APCA-API-KEY-ID", a.KeyID)
	req.Header.Set("APCA-API-SECRET-KEY", a.SecretKey)
	client := a.Client
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("alpaca: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("alpaca: status %d", resp.StatusCode)
	}
	var body map[string]snapshot
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&body); err != nil {
		return nil, fmt.Errorf("alpaca: %w", err)
	}
	out := make([]Quote, 0, len(symbols))
	for _, s := range symbols {
		snap, ok := body[s.Ticker]
		if !ok || snap.LatestTrade == nil {
			continue
		}
		at, err := ParseTime(snap.LatestTrade.T)
		if err != nil {
			continue
		}
		q := Quote{Symbol: s.Ticker, Name: s.Name, LastPriceCents: int64(math.Round(snap.LatestTrade.P * 100)), At: at}
		if snap.PrevDailyBar != nil && snap.PrevDailyBar.C > 0 {
			q.DayChangeBps = int(math.Round((snap.LatestTrade.P - snap.PrevDailyBar.C) / snap.PrevDailyBar.C * 10000))
		}
		out = append(out, q)
	}
	return out, nil
}

// Source fetches quotes (Alpaca, or a fake in tests).
type Source interface {
	Fetch(ctx context.Context, symbols []Symbol) ([]Quote, error)
}

// Service serves the fixed board, cached for 15 minutes.
type Service struct {
	source  Source
	symbols []Symbol
	cache   Cache
	now     func() time.Time
}

func NewService(source Source, symbols []Symbol, cache Cache, now func() time.Time) *Service {
	return &Service{source: source, symbols: symbols, cache: cache, now: now}
}

const cacheKey = "market:quotes:v1"

// Get returns the board, in the order of the configured list.
func (s *Service) Get(ctx context.Context) (Board, error) {
	if s.cache != nil {
		var b Board
		if ok, err := s.cache.Get(ctx, cacheKey, &b); err == nil && ok {
			return b, nil
		}
	}
	qs, err := s.source.Fetch(ctx, s.symbols)
	if err != nil || len(qs) == 0 {
		return Board{}, errors.Join(ErrUnavailable, err)
	}
	order := map[string]int{}
	for i, sym := range s.symbols {
		order[sym.Ticker] = i
	}
	sort.SliceStable(qs, func(i, j int) bool { return order[qs[i].Symbol] < order[qs[j].Symbol] })
	b := Board{Quotes: qs, FetchedAt: s.now().UTC()}
	if s.cache != nil {
		_ = s.cache.Set(ctx, cacheKey, b, TTL)
	}
	return b, nil
}
