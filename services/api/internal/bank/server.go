package bank

import (
	"context"
	"errors"
	"net/http"

	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

// errNotYet marks the endpoints that M5 step 2 implements.
var errNotYet = errors.New("bank: endpoint not implemented yet")

// server implements the generated httpapi.StrictServerInterface.
type server struct{}

func (server) BankHealth(context.Context, httpapi.BankHealthRequestObject) (httpapi.BankHealthResponseObject, error) {
	return httpapi.BankHealth200JSONResponse{Module: "bank", Status: httpapi.Stub}, nil
}

func (server) ListProviders(context.Context, httpapi.ListProvidersRequestObject) (httpapi.ListProvidersResponseObject, error) {
	list := ports.Providers()
	items := make([]httpapi.BankProvider, 0, len(list))
	for _, p := range list {
		scopes := make([]httpapi.BankScope, len(p.Scopes))
		for i, s := range p.Scopes {
			scopes[i] = httpapi.BankScope(s)
		}
		items = append(items, httpapi.BankProvider{
			Id:              p.ID,
			DisplayName:     p.DisplayName,
			Kind:            httpapi.BankProviderKind(p.Kind),
			IsSimulated:     p.IsSimulated,
			SupportedScopes: scopes,
			LogoKey:         p.LogoKey,
		})
	}
	return httpapi.ListProviders200JSONResponse{Items: items}, nil
}

func (server) CreateBankAuthorization(context.Context, httpapi.CreateBankAuthorizationRequestObject) (httpapi.CreateBankAuthorizationResponseObject, error) {
	return nil, errNotYet
}

func (server) ExchangeBankAuthorization(context.Context, httpapi.ExchangeBankAuthorizationRequestObject) (httpapi.ExchangeBankAuthorizationResponseObject, error) {
	return nil, errNotYet
}

func (server) QueryBankAccounts(context.Context, httpapi.QueryBankAccountsRequestObject) (httpapi.QueryBankAccountsResponseObject, error) {
	return nil, errNotYet
}

func (server) QueryBankTransactions(context.Context, httpapi.QueryBankTransactionsRequestObject) (httpapi.QueryBankTransactionsResponseObject, error) {
	return nil, errNotYet
}

func (server) RefreshBankTokens(context.Context, httpapi.RefreshBankTokensRequestObject) (httpapi.RefreshBankTokensResponseObject, error) {
	return nil, errNotYet
}

// errorHandler answers the endpoints of step 2 with 501, and anything else through fallback
// (500 without details).
func errorHandler(fallback func(http.ResponseWriter, *http.Request, error)) func(http.ResponseWriter, *http.Request, error) {
	return func(w http.ResponseWriter, r *http.Request, err error) {
		if errors.Is(err, errNotYet) {
			problem.NotImplemented(w, r)
			return
		}
		fallback(w, r, err)
	}
}
