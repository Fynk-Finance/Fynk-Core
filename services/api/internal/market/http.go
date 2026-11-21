package market

import (
	"context"
	"errors"
	"net/http"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/market/catalog"
	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/market/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/market/quotes"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/market/reference"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

type catalogService interface {
	Get(ctx context.Context) (catalog.Catalog, error)
}

type referenceService interface {
	Get(ctx context.Context) (reference.Result, error)
}

type quotesService interface {
	Get(ctx context.Context) (quotes.Board, error)
}

// server implements httpapi.StrictServerInterface. No handler reads the user: every answer is
// the same for everyone.
type server struct {
	catalog   catalogService
	reference referenceService
	quotes    quotesService
}

func unavailable() httpapi.Problem {
	v := problem.New(http.StatusServiceUnavailable, "market_unavailable", "Market data unavailable", "")
	return httpapi.Problem{Type: v.Type, Title: v.Title, Status: int32(v.Status), Code: v.Code}
}

func (s server) GetCdtProducts(ctx context.Context, _ httpapi.GetCdtProductsRequestObject) (httpapi.GetCdtProductsResponseObject, error) {
	c, err := s.catalog.Get(ctx)
	if errors.Is(err, catalog.ErrUnavailable) {
		return httpapi.GetCdtProducts503ApplicationProblemPlusJSONResponse(unavailable()), nil
	}
	if err != nil {
		return nil, err
	}
	out := httpapi.GetCdtProducts200JSONResponse{FetchedAt: c.FetchedAt, Products: make([]httpapi.MarketCdtProduct, 0, len(c.Products))}
	for _, p := range c.Products {
		out.Products = append(out.Products, httpapi.MarketCdtProduct{
			Id: p.ID, Name: p.Name, Issuer: p.Issuer, TermDays: p.TermDays, RateEaBps: p.RateEaBps,
			MinAmountMinor: p.MinAmountMinor, Risk: httpapi.MarketCdtProductRisk(p.Risk), Simulated: p.Simulated,
		})
	}
	return out, nil
}

func (s server) GetCdtReference(ctx context.Context, _ httpapi.GetCdtReferenceRequestObject) (httpapi.GetCdtReferenceResponseObject, error) {
	res, err := s.reference.Get(ctx)
	if errors.Is(err, reference.ErrUnavailable) {
		return httpapi.GetCdtReference503ApplicationProblemPlusJSONResponse(unavailable()), nil
	}
	if err != nil {
		return nil, err
	}
	r := res.Rate
	return httpapi.GetCdtReference200JSONResponse{
		TermDays: r.TermDays, RateEaBps: r.RateEaBps, Week: openapi_types.Date{Time: r.Week},
		SourceUrl: r.SourceURL, FetchedAt: r.FetchedAt.UTC(), Stale: res.Stale,
	}, nil
}

func (s server) GetMarketQuotes(ctx context.Context, _ httpapi.GetMarketQuotesRequestObject) (httpapi.GetMarketQuotesResponseObject, error) {
	b, err := s.quotes.Get(ctx)
	if errors.Is(err, quotes.ErrUnavailable) {
		return httpapi.GetMarketQuotes503ApplicationProblemPlusJSONResponse(unavailable()), nil
	}
	if err != nil {
		return nil, err
	}
	out := httpapi.GetMarketQuotes200JSONResponse{FetchedAt: b.FetchedAt, Quotes: make([]httpapi.MarketQuote, 0, len(b.Quotes))}
	for _, q := range b.Quotes {
		out.Quotes = append(out.Quotes, httpapi.MarketQuote{
			Symbol: q.Symbol, Name: q.Name, LastPriceCents: q.LastPriceCents, DayChangeBps: q.DayChangeBps, At: q.At.UTC(),
		})
	}
	return out, nil
}
