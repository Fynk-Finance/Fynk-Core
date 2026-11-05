package catalog

import (
	"context"

	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/catalog/http"
)

// server implements httpapi.StrictServerInterface. The answer is the same for every user.
type server struct{ store Store }

func (s server) GetCatalogMerchants(ctx context.Context, req httpapi.GetCatalogMerchantsRequestObject) (httpapi.GetCatalogMerchantsResponseObject, error) {
	c, err := Load(ctx, s.store)
	if err != nil {
		return nil, err
	}
	if req.Params.IfNoneMatch != nil && Matches(*req.Params.IfNoneMatch, c.ETag) {
		return httpapi.GetCatalogMerchants304Response{
			Headers: httpapi.GetCatalogMerchants304ResponseHeaders{ETag: c.ETag},
		}, nil
	}
	body := httpapi.CatalogMerchantList{
		UpdatedAt: c.UpdatedAt,
		Merchants: make([]httpapi.CatalogMerchant, 0, len(c.Merchants)),
	}
	for _, m := range c.Merchants {
		body.Merchants = append(body.Merchants, httpapi.CatalogMerchant{
			Key:            m.Key,
			DisplayName:    m.DisplayName,
			Category:       m.Category,
			IsSubscription: m.IsSubscription,
			MatchPatterns:  nonNil(m.MatchPatterns),
			CancelUrl:      m.CancelURL,
			CancelSteps:    nonNil(m.CancelSteps),
		})
	}
	return httpapi.GetCatalogMerchants200JSONResponse{
		Body:    body,
		Headers: httpapi.GetCatalogMerchants200ResponseHeaders{ETag: c.ETag},
	}, nil
}

// nonNil keeps an empty list as [] in JSON, never null.
func nonNil(xs []string) []string {
	if xs == nil {
		return []string{}
	}
	return xs
}
