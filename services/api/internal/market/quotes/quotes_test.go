package quotes

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestSnapshotsURLAlwaysAsksForTheIEXFeed(t *testing.T) {
	u := Alpaca{BaseURL: "https://data.alpaca.markets/"}.SnapshotsURL(DefaultSymbols)
	if !strings.Contains(u, "feed=iex") || !strings.HasPrefix(u, "https://data.alpaca.markets/v2/stocks/snapshots?") {
		t.Fatalf("url %s", u)
	}
	if !strings.Contains(u, "symbols=AAPL%2CMSFT") {
		t.Fatalf("symbols in the configured order: %s", u)
	}
}

func TestParseTimeConvertsEasternToUTC(t *testing.T) {
	got, err := ParseTime("2026-10-28T15:59:00")
	if err != nil || !got.Equal(time.Date(2026, 10, 28, 19, 59, 0, 0, time.UTC)) {
		t.Fatalf("EDT 15:59 is 19:59 UTC, got %v %v", got, err)
	}
	got, _ = ParseTime("2026-12-01T15:59:00")
	if !got.Equal(time.Date(2026, 12, 1, 20, 59, 0, 0, time.UTC)) {
		t.Fatalf("EST 15:59 is 20:59 UTC, got %v", got)
	}
	got, _ = ParseTime("2026-10-28T19:59:00.123Z")
	if got.Location() != time.UTC || got.Hour() != 19 {
		t.Fatalf("an explicit offset is kept, got %v", got)
	}
}

func TestFetchSendsTheKeysAndComputesTheChange(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("feed") != "iex" {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		if r.Header.Get("APCA-API-KEY-ID") != "id" || r.Header.Get("APCA-API-SECRET-KEY") != "secret" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_, _ = w.Write([]byte(`{"AAPL":{"latestTrade":{"t":"2026-10-28T19:59:00Z","p":227.5},"prevDailyBar":{"c":224.69}},
			"MSFT":{"latestTrade":{"t":"2026-10-28T15:59:00","p":400},"prevDailyBar":{"c":410}}}`))
	}))
	defer ts.Close()
	qs, err := Alpaca{BaseURL: ts.URL, KeyID: "id", SecretKey: "secret"}.Fetch(context.Background(),
		[]Symbol{{"AAPL", "Apple"}, {"MSFT", "Microsoft"}, {"KO", "Coca-Cola"}})
	if err != nil {
		t.Fatal(err)
	}
	if len(qs) != 2 || qs[0].LastPriceCents != 22750 || qs[0].DayChangeBps != 125 || qs[1].DayChangeBps != -244 {
		t.Fatalf("got %+v", qs)
	}
	if qs[1].At.Hour() != 19 {
		t.Fatalf("MSFT time in UTC, got %v", qs[1].At)
	}
}

func TestFetchWithoutKeysOrEgressIsUnavailable(t *testing.T) {
	if _, err := (Alpaca{BaseURL: "http://x"}).Fetch(context.Background(), DefaultSymbols); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("no keys: got %v", err)
	}
	if _, err := (Alpaca{KeyID: "id", SecretKey: "s"}).Fetch(context.Background(), DefaultSymbols); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("no egress: got %v", err)
	}
}

type fakeSource struct {
	qs    []Quote
	calls int
}

func (f *fakeSource) Fetch(context.Context, []Symbol) ([]Quote, error) {
	f.calls++
	return f.qs, nil
}

type memCache struct{ m map[string]Board }

func (c *memCache) Get(_ context.Context, k string, v any) (bool, error) {
	b, ok := c.m[k]
	if ok {
		*(v.(*Board)) = b
	}
	return ok, nil
}

func (c *memCache) Set(_ context.Context, k string, v any, _ time.Duration) error {
	c.m[k] = v.(Board)
	return nil
}

func TestServiceKeepsTheConfiguredOrderAndCaches(t *testing.T) {
	src := &fakeSource{qs: []Quote{{Symbol: "MSFT"}, {Symbol: "AAPL"}}}
	svc := NewService(src, DefaultSymbols, &memCache{m: map[string]Board{}}, time.Now)
	b, err := svc.Get(context.Background())
	if err != nil || b.Quotes[0].Symbol != "AAPL" {
		t.Fatalf("got %+v %v", b, err)
	}
	_, _ = svc.Get(context.Background())
	if src.calls != 1 {
		t.Fatalf("cached for 15 minutes, calls=%d", src.calls)
	}
}

func TestParseSymbols(t *testing.T) {
	if got := ParseSymbols(""); len(got) != 10 {
		t.Fatalf("default list has 10 symbols, got %d", len(got))
	}
	got := ParseSymbols("aapl:Apple, ko")
	if len(got) != 2 || got[0] != (Symbol{"AAPL", "Apple"}) || got[1] != (Symbol{"KO", "KO"}) {
		t.Fatalf("got %+v", got)
	}
}
