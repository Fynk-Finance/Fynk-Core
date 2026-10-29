package bank

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"

	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/service"
	consentports "github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

// errNotYet marks the endpoints that M5 step 2 implements.
var errNotYet = errors.New("bank: endpoint not implemented yet")

// server implements the generated httpapi.StrictServerInterface.
type server struct {
	svc *service.Service
}

func userOf(ctx context.Context) service.User {
	u, _ := auth.UserFrom(ctx)
	return service.User{ID: u.ID, DeviceID: u.DeviceID}
}

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

func (s server) CreateBankAuthorization(ctx context.Context, req httpapi.CreateBankAuthorizationRequestObject) (httpapi.CreateBankAuthorizationResponseObject, error) {
	if s.svc == nil {
		return nil, errNotConfigured
	}
	b := req.Body
	started, err := s.svc.CreateAuthorization(ctx, userOf(ctx), service.StartRequest{
		Provider: b.Provider, ConsentID: b.ConsentId.String(), CodeChallenge: b.CodeChallenge, State: b.State,
	})
	if err != nil {
		return nil, err
	}
	id, err := uuid.Parse(started.AuthorizationID)
	if err != nil {
		return nil, err
	}
	return httpapi.CreateBankAuthorization201JSONResponse{
		AuthorizationId: id, AuthorizeUrl: started.AuthorizeURL, ExpiresAt: started.ExpiresAt.UTC(),
	}, nil
}

func (s server) ExchangeBankAuthorization(ctx context.Context, req httpapi.ExchangeBankAuthorizationRequestObject) (httpapi.ExchangeBankAuthorizationResponseObject, error) {
	if s.svc == nil {
		return nil, errNotConfigured
	}
	linked, err := s.svc.Exchange(ctx, userOf(ctx), req.Id.String(), req.Body.Code, req.Body.CodeVerifier)
	if err != nil {
		return nil, err
	}
	id, err := uuid.Parse(linked.LinkID)
	if err != nil {
		return nil, err
	}
	return httpapi.ExchangeBankAuthorization200JSONResponse{
		LinkId: id, Provider: linked.Provider, AccessToken: linked.AccessToken,
		RefreshToken: linked.RefreshToken, ExpiresIn: int32(linked.ExpiresIn / time.Second),
	}, nil
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

// errorHandler maps the link errors to problems with their stable codes, the endpoints still
// to come to 501, and anything else to fallback (500 without details).
func errorHandler(fallback func(http.ResponseWriter, *http.Request, error)) func(http.ResponseWriter, *http.Request, error) {
	return func(w http.ResponseWriter, r *http.Request, err error) {
		var rule *service.Error
		var bank *ports.Error
		switch {
		case errors.Is(err, errNotYet):
			problem.NotImplemented(w, r)
		case errors.As(err, &rule):
			problem.Write(w, problem.New(rule.Status, rule.Code, http.StatusText(rule.Status), rule.Detail))
		case errors.Is(err, consentports.ErrConsentNotFound):
			write(w, http.StatusNotFound, "consent_not_found", "The consent does not exist.")
		case errors.Is(err, consentports.ErrConsentNotPending):
			write(w, http.StatusConflict, "consent_not_pending", "Only a pending consent can start a link.")
		case errors.Is(err, errNotConfigured), errors.Is(err, ports.ErrProviderUnavailable):
			write(w, http.StatusServiceUnavailable, ports.ErrProviderUnavailable.Code, ports.ErrProviderUnavailable.Detail)
		case errors.As(err, &bank):
			// invalid_grant and consent_revoked: the bank refused, the user can start again.
			write(w, http.StatusConflict, bank.Code, bank.Detail)
		default:
			fallback(w, r, err)
		}
	}
}

func write(w http.ResponseWriter, status int, code, detail string) {
	problem.Write(w, problem.New(status, code, http.StatusText(status), detail))
}
