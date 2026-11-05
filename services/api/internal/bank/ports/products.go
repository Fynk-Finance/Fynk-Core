package ports

import (
	"context"
	"sync/atomic"
)

// The public CDT catalog M15 shows in the Inversión tab (Provider.Products, shared contracts
// 4.4). Like the revoker, the bank module installs it once at startup: M15 may import only this
// package (depguard), never the adapters. The catalog needs no user and no token, and it is the
// same for everyone. Until it is installed (no egress configured), every call fails with
// ErrProviderUnavailable.

// ProductCatalog gives the public CDT products of one provider.
type ProductCatalog interface {
	Products(ctx context.Context, provider string) ([]Product, error)
}

// ProductLister is the catalog of one provider. It has the same method as Provider.Products, so
// M15's catalog.FromProvider takes it as is.
type ProductLister interface {
	Products(ctx context.Context) ([]Product, error)
}

type catalogBox struct{ c ProductCatalog }

var installedCatalog atomic.Pointer[catalogBox]

func init() { installedCatalog.Store(&catalogBox{c: noCatalog{}}) }

// InstallProductCatalog sets the catalog ProductsOf reads. nil puts the unavailable one back.
func InstallProductCatalog(c ProductCatalog) {
	if c == nil {
		c = noCatalog{}
	}
	installedCatalog.Store(&catalogBox{c: c})
}

// ProductsOf returns the CDT catalog of provider, for example "banco-demo". It reads the
// installed catalog at every call, so M15 can build it at startup whatever the module order.
func ProductsOf(provider string) ProductLister { return productsOf(provider) }

type productsOf string

func (p productsOf) Products(ctx context.Context) ([]Product, error) {
	return installedCatalog.Load().c.Products(ctx, string(p))
}

type noCatalog struct{}

func (noCatalog) Products(context.Context, string) ([]Product, error) {
	return nil, ErrProviderUnavailable
}
