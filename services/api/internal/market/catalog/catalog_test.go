package catalog

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	bankports "github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
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

func TestBankDemoProductsThroughM5sProductType(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/banco-demo/open-finance/v1/products/cdt" || r.Header.Get("Authorization") != "" {
			t.Errorf("public catalog through the egress without a user token, got %s %q", r.URL.Path, r.Header.Get("Authorization"))
		}
		_, _ = w.Write([]byte(`{"data":[{"id":"cdt-demo-180","name":"CDT Digital Banco Demo 180 Días","termDays":180,"rateEa":10.5,"rateEaBps":1050,"minAmount":"500000.00","minAmountMinor":50000000,"risk":"BAJO"},{"id":"","name":"sin id","termDays":0}]}`))
	}))
	defer ts.Close()
	src := FromProvider{Lister: BankDemoProducts{BaseURL: ts.URL + "/banco-demo/"}, Issuer: "Banco Demo", Simulated: true}
	ps, err := src.Products(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	want := Product{ID: "cdt-demo-180", Name: "CDT Digital Banco Demo 180 Días", Issuer: "Banco Demo", TermDays: 180,
		RateEaBps: 1050, MinAmountMinor: 50000000, Risk: RiskLow, Simulated: true}
	if len(ps) != 1 || ps[0] != want {
		t.Fatalf("got %+v", ps)
	}
}

// fakeProvider stands for any M5 adapter: only Products() of bankports.Provider is used.
type fakeProvider struct{}

func (fakeProvider) Products(context.Context) ([]bankports.Product, error) {
	return []bankports.Product{{ID: "p1", Name: "CDT 90", TermDays: 90, RateEaBps: 1015, Risk: "MODERADO"}}, nil
}

func TestFromProviderAcceptsAnyM5Provider(t *testing.T) {
	ps, err := FromProvider{Lister: fakeProvider{}, Issuer: "Banco X"}.Products(context.Background())
	if err != nil || len(ps) != 1 || ps[0].Risk != RiskModerate || ps[0].Issuer != "Banco X" || ps[0].Simulated {
		t.Fatalf("got %+v %v", ps, err)
	}
}

func TestNormalizeRisk(t *testing.T) {
	for in, want := range map[string]string{"BAJO": RiskLow, "Moderado": RiskModerate, "MEDIO": RiskModerate, "alto": RiskHigh, "": RiskLow} {
		if got := NormalizeRisk(in); got != want {
			t.Errorf("%q: got %s want %s", in, got, want)
		}
	}
}
