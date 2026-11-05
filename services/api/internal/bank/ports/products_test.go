package ports

import (
	"context"
	"errors"
	"testing"
)

type fakeCatalog struct {
	asked []string
	err   error
}

func (f *fakeCatalog) Products(_ context.Context, provider string) ([]Product, error) {
	f.asked = append(f.asked, provider)
	return []Product{{ID: "cdt-90", Name: "CDT 90 días", TermDays: 90, RateEaBps: 1050}}, f.err
}

// M15 builds its lister at startup, before or after the bank module: it must find the catalog
// the bank module installs later, at call time.
func TestProductsOfFindsTheCatalogInstalledAfterIt(t *testing.T) {
	t.Cleanup(func() { InstallProductCatalog(nil) })
	InstallProductCatalog(nil)
	lister := ProductsOf("banco-demo")
	if _, err := lister.Products(context.Background()); !errors.Is(err, ErrProviderUnavailable) {
		t.Fatalf("before install: got %v, want provider_unavailable", err)
	}

	f := &fakeCatalog{}
	InstallProductCatalog(f)
	got, err := lister.Products(context.Background())
	if err != nil || len(got) != 1 || got[0].ID != "cdt-90" {
		t.Fatalf("Products = %+v, %v", got, err)
	}
	if len(f.asked) != 1 || f.asked[0] != "banco-demo" {
		t.Fatalf("asked %v", f.asked)
	}

	InstallProductCatalog(nil)
	if _, err := lister.Products(context.Background()); !errors.Is(err, ErrProviderUnavailable) {
		t.Fatalf("after nil: got %v, want provider_unavailable", err)
	}
}
