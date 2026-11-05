package reference

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestParseCSVFindsTheLatest360DayRate(t *testing.T) {
	csv := "\xef\xbb\xbfFecha;CDT 180 días;CDT 360 días\n" +
		"2026-10-12;9,40;9,90\n" +
		"2026-10-19;9,35;9,85\n" +
		"2026-10-05;9,50;10,00\n"
	r, err := ParseCSV([]byte(csv), 360)
	if err != nil {
		t.Fatal(err)
	}
	if r.RateEaBps != 985 || r.Week.Format("2006-01-02") != "2026-10-19" || r.TermDays != 360 {
		t.Fatalf("got %+v", r)
	}
}

func TestParseCSVCommaAndSlashDates(t *testing.T) {
	r, err := ParseCSV([]byte("semana,dtf,cdt_360\n19/10/2026,9.1,9.85 %\n"), 360)
	if err != nil || r.RateEaBps != 985 {
		t.Fatalf("got %+v %v", r, err)
	}
}

func TestParseCSVRejectsOtherFiles(t *testing.T) {
	for _, data := range []string{"", "a;b\n1;2\n", "<html>no</html>", "fecha;cdt 360\nayer;x\n"} {
		if _, err := ParseCSV([]byte(data), 360); !errors.Is(err, ErrFormat) {
			t.Errorf("%q: want ErrFormat, got %v", data, err)
		}
	}
}

func TestPercentToBpsHasNoFloatingPoint(t *testing.T) {
	for in, want := range map[string]int{"10,85": 1085, "10.5": 1050, "9": 900, " 9,85 % ": 985, "0,07": 7} {
		if got, err := PercentToBps(in); err != nil || got != want {
			t.Errorf("%q: got %d %v", in, got, err)
		}
	}
	if _, err := PercentToBps("abc"); err == nil {
		t.Error("abc must fail")
	}
}

type memStore struct{ rates []Rate }

func (m *memStore) Latest(_ context.Context, term int) (Rate, bool, error) {
	if len(m.rates) == 0 {
		return Rate{}, false, nil
	}
	return m.rates[len(m.rates)-1], true, nil
}

func (m *memStore) Save(_ context.Context, r Rate) error {
	m.rates = append(m.rates, r)
	return nil
}

type fetcher struct {
	rate  Rate
	err   error
	calls int
}

func (f *fetcher) Fetch(context.Context, int) (Rate, error) {
	f.calls++
	return f.rate, f.err
}

func TestServiceDownloadsOnceADayAndKeepsTheLastValue(t *testing.T) {
	at := time.Date(2026, 10, 28, 6, 0, 0, 0, time.UTC)
	now := func() time.Time { return at }
	week := time.Date(2026, 10, 19, 0, 0, 0, 0, time.UTC)
	store := &memStore{}
	f := &fetcher{rate: Rate{Week: week, TermDays: 360, RateEaBps: 985, SourceURL: "u"}}
	svc := NewService(store, f, now)

	res, err := svc.Get(context.Background())
	if err != nil || res.Rate.RateEaBps != 985 || res.Stale || f.calls != 1 {
		t.Fatalf("first: %+v %v calls=%d", res, err, f.calls)
	}
	at = at.Add(2 * time.Hour)
	if _, err := svc.Get(context.Background()); err != nil || f.calls != 1 {
		t.Fatalf("within a day there is no new download, calls=%d", f.calls)
	}
	// A day later the download fails: the last value stays.
	at = at.Add(24 * time.Hour)
	f.err = errors.New("banrep down")
	res, err = svc.Get(context.Background())
	if err != nil || res.Rate.RateEaBps != 985 || f.calls != 2 {
		t.Fatalf("keep last value: %+v %v", res, err)
	}
	// And a failing source is not hit again within the hour.
	if _, _ = svc.Get(context.Background()); f.calls != 2 {
		t.Fatalf("calls=%d", f.calls)
	}
	at = at.Add(20 * 24 * time.Hour)
	at = at.Add(time.Hour)
	if res, _ := svc.Get(context.Background()); !res.Stale {
		t.Fatal("a rate of more than 14 days ago is stale")
	}
}

func TestServiceUnavailableWhenNeverDownloaded(t *testing.T) {
	svc := NewService(&memStore{}, &fetcher{err: errors.New("down")}, time.Now)
	if _, err := svc.Get(context.Background()); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("got %v", err)
	}
}

func TestHTTPFetcher(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("Fecha;CDT 360 días\n2026-10-19;9,85\n"))
	}))
	defer ts.Close()
	r, err := HTTPFetcher{URL: ts.URL}.Fetch(context.Background(), 360)
	if err != nil || r.RateEaBps != 985 || r.SourceURL != ts.URL {
		t.Fatalf("got %+v %v", r, err)
	}
	if _, err := (HTTPFetcher{}).Fetch(context.Background(), 360); !errors.Is(err, ErrUnavailable) {
		t.Fatal("no URL configured: unavailable")
	}
}
