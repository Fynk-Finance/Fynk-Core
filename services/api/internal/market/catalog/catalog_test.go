package catalog

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

type memCache struct{ m map[string]any }

func (c *memCache) Get(_ context.Context, key string, v any) (bool, error) {
	got, ok := c.m[key]
	if !ok {
		return false, nil
	}
	*(v.(*Catalog)) = got.(Catalog)
	return true, nil
}

func (c *memCache) Set(_ context.Context, key string, v any, _ time.Duration) error {
	c.m[key] = v
	return nil
}

type staticSource struct {
	products []Product
	err      error
	calls    int
}

func (s *staticSource) Products(context.Context) ([]Product, error) {
	s.calls++
	return s.products, s.err
}

var now = func() time.Time { return time.Date(2026, 10, 28, 17, 0, 0, 0, time.UTC) }

func TestCatalogIsSortedByNameAndCachedForAnHour(t *testing.T) {
	src := &staticSource{products: []Product{{ID: "b", Name: "CDT 360"}, {ID: "a", Name: "CDT 180"}}}
	cache := &memCache{m: map[string]any{}}
	svc := NewService(cache, now, src)
	c, err := svc.Get(context.Background())
	if err != nil || c.Products[0].ID != "a" {
		t.Fatalf("want name order, got %+v %v", c, err)
	}
	if _, err := svc.Get(context.Background()); err != nil || src.calls != 1 {
		t.Fatalf("second call must come from the cache, calls=%d", src.calls)
	}
}

func TestUnavailableWithoutSources(t *testing.T) {
	_, err := NewService(nil, now, &staticSource{err: errors.New("down")}).Get(context.Background())
	if !errors.Is(err, ErrUnavailable) {
		t.Fatalf("want ErrUnavailable, got %v", err)
	}
}

func TestBankDemoAdapterMapsTheSimulatorCatalog(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/open-finance/v1/products/cdt" || r.Header.Get("Authorization") != "" {
			t.Errorf("public catalog without a user token, got %s %q", r.URL.Path, r.Header.Get("Authorization"))
		}
		_, _ = w.Write([]byte(`{"data":[{"id":"cdt-demo-180","name":"CDT Digital Banco Demo 180 Días","termDays":180,"rateEa":10.5,"rateEaBps":1050,"minAmount":"500000.00","minAmountMinor":50000000,"risk":"BAJO"}]}`))
	}))
	defer ts.Close()
	ps, err := BankDemo{BaseURL: ts.URL + "/"}.Products(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	want := Product{ID: "cdt-demo-180", Name: "CDT Digital Banco Demo 180 Días", Issuer: "Banco Demo", TermDays: 180,
		RateEaBps: 1050, MinAmountMinor: 50000000, Risk: RiskLow, Simulated: true}
	if len(ps) != 1 || ps[0] != want {
		t.Fatalf("got %+v", ps)
	}
}

func TestNormalizeRisk(t *testing.T) {
	for in, want := range map[string]string{"BAJO": RiskLow, "Moderado": RiskModerate, "MEDIO": RiskModerate, "alto": RiskHigh, "": RiskLow} {
		if got := NormalizeRisk(in); got != want {
			t.Errorf("%q: got %s want %s", in, got, want)
		}
	}
}
