package bank

import (
	"context"
	"errors"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/service"
	consentports "github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

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

func (s server) QueryBankAccounts(ctx context.Context, req httpapi.QueryBankAccountsRequestObject) (httpapi.QueryBankAccountsResponseObject, error) {
	if s.svc == nil {
		return nil, errNotConfigured
	}
	accounts, err := s.svc.Accounts(ctx, userOf(ctx), req.Body.LinkId.String(), req.Body.AccessToken)
	if err != nil {
		return nil, err
	}
	items := make([]httpapi.BankAccount, len(accounts))
	for i, a := range accounts {
		items[i] = toAccount(a)
	}
	return httpapi.QueryBankAccounts200JSONResponse{Items: items}, nil
}

func (s server) QueryBankTransactions(ctx context.Context, req httpapi.QueryBankTransactionsRequestObject) (httpapi.QueryBankTransactionsResponseObject, error) {
	if s.svc == nil {
		return nil, errNotConfigured
	}
	b := req.Body
	cursor := ""
	if b.Cursor != nil {
		cursor = *b.Cursor
	}
	page, err := s.svc.Transactions(ctx, userOf(ctx), b.LinkId.String(), b.AccessToken, b.ProviderAccountId, b.Since, cursor)
	if err != nil {
		return nil, err
	}
	items := make([]httpapi.BankTransaction, len(page.Items))
	for i, t := range page.Items {
		items[i] = httpapi.BankTransaction{
			ProviderTxId: t.ProviderTxID, BookedAt: t.BookedAt.UTC(), AmountMinor: t.AmountMinor,
			Description: t.Description, MerchantRaw: optional(t.MerchantRaw),
			BankCategory: optional(t.BankCategory), Status: httpapi.BankTransactionStatus(t.Status),
		}
	}
	return httpapi.QueryBankTransactions200JSONResponse{Items: items, NextCursor: optional(page.NextCursor)}, nil
}

func (s server) RefreshBankTokens(ctx context.Context, req httpapi.RefreshBankTokensRequestObject) (httpapi.RefreshBankTokensResponseObject, error) {
	if s.svc == nil {
		return nil, errNotConfigured
	}
	linked, err := s.svc.Refresh(ctx, userOf(ctx), req.Body.LinkId.String(), req.Body.RefreshToken)
	if err != nil {
		return nil, err
	}
	return httpapi.RefreshBankTokens200JSONResponse{
		LinkId: req.Body.LinkId, Provider: linked.Provider, AccessToken: linked.AccessToken,
		RefreshToken: linked.RefreshToken, ExpiresIn: int32(linked.ExpiresIn / time.Second),
	}, nil
}

// toAccount maps the shared Account shape. Only the last 4 digits ever leave an adapter.
func toAccount(a ports.Account) httpapi.BankAccount {
	out := httpapi.BankAccount{
		ProviderAccountId: a.ProviderAccountID, Kind: httpapi.BankAccountKind(a.Kind),
		DisplayName: a.DisplayName, Last4: optional(a.Last4), Currency: httpapi.COP,
		BalanceMinor: a.BalanceMinor, AvailableMinor: a.AvailableMinor, CreditLimitMinor: a.CreditLimitMinor,
		Status: httpapi.Active, IsSimulated: a.IsSimulated,
	}
	if a.Closed {
		out.Status = httpapi.Closed
	}
	if a.PaymentDueOn != nil {
		out.PaymentDueOn = &openapi_types.Date{Time: *a.PaymentDueOn}
	}
	if a.CDT != nil {
		out.Cdt = &httpapi.BankCdt{
			RateEaBps: int32(a.CDT.RateEaBps), TermDays: int32(a.CDT.TermDays),
			OpenedOn: openapi_types.Date{Time: a.CDT.OpenedOn}, MaturesOn: openapi_types.Date{Time: a.CDT.MaturesOn},
		}
	}
	return out
}

func optional(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// errorHandler maps the bank errors to problems with their stable codes, a rate limit to 429
// with Retry-After, and anything else to fallback (500 without details).
func errorHandler(fallback func(http.ResponseWriter, *http.Request, error)) func(http.ResponseWriter, *http.Request, error) {
	return func(w http.ResponseWriter, r *http.Request, err error) {
		var rule *service.Error
		var bank *ports.Error
		var limited *service.RateLimited
		switch {
		case errors.As(err, &limited):
			w.Header().Set("Retry-After", strconv.Itoa(max(1, int(math.Ceil(limited.RetryAfter.Seconds())))))
			write(w, http.StatusTooManyRequests, "rate_limited", "Too many bank queries. Try again later.")
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
