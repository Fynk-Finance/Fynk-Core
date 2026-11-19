package bank

import (
	"net/http"
	"net/http/httptest"
	"testing"

	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/service"
)

// The error handler answers these statuses. Each one must be declared for the operation in
// contracts/modules/bank.yaml: the generated server has a response type per declared status,
// so this file stops compiling when the contract loses one.
func TestTheContractDeclaresEveryStatusTheErrorHandlerAnswers(t *testing.T) {
	cases := []struct {
		name     string
		err      error
		want     int
		declared []any
	}{
		{"nonce_required", service.ErrNonceRequired, http.StatusBadRequest, []any{
			httpapi.CreateBankAuthorization400ApplicationProblemPlusJSONResponse{},
			httpapi.ExchangeBankAuthorization400ApplicationProblemPlusJSONResponse{},
			httpapi.QueryBankAccounts400ApplicationProblemPlusJSONResponse{},
			httpapi.QueryBankTransactions400ApplicationProblemPlusJSONResponse{},
			httpapi.RefreshBankTokens400ApplicationProblemPlusJSONResponse{},
		}},
		{"link_not_found", service.ErrLinkNotFound, http.StatusNotFound, []any{
			httpapi.QueryBankAccounts404ApplicationProblemPlusJSONResponse{},
			httpapi.QueryBankTransactions404ApplicationProblemPlusJSONResponse{},
			httpapi.RefreshBankTokens404ApplicationProblemPlusJSONResponse{},
		}},
		{"device_required", service.ErrDeviceRequired, http.StatusUnprocessableEntity, []any{
			httpapi.CreateBankAuthorization422ApplicationProblemPlusJSONResponse{},
			httpapi.ExchangeBankAuthorization422ApplicationProblemPlusJSONResponse{},
			httpapi.QueryBankAccounts422ApplicationProblemPlusJSONResponse{},
			httpapi.QueryBankTransactions422ApplicationProblemPlusJSONResponse{},
			httpapi.RefreshBankTokens422ApplicationProblemPlusJSONResponse{},
		}},
		{"rate_limited", &service.RateLimited{}, http.StatusTooManyRequests, []any{
			httpapi.QueryBankAccounts429ApplicationProblemPlusJSONResponse{},
			httpapi.QueryBankTransactions429ApplicationProblemPlusJSONResponse{},
			httpapi.RefreshBankTokens429ApplicationProblemPlusJSONResponse{},
		}},
		{"provider_unavailable", ports.ErrProviderUnavailable, http.StatusServiceUnavailable, []any{
			httpapi.CreateBankAuthorization503ApplicationProblemPlusJSONResponse{},
			httpapi.ExchangeBankAuthorization503ApplicationProblemPlusJSONResponse{},
			httpapi.QueryBankAccounts503ApplicationProblemPlusJSONResponse{},
			httpapi.QueryBankTransactions503ApplicationProblemPlusJSONResponse{},
			httpapi.RefreshBankTokens503ApplicationProblemPlusJSONResponse{},
		}},
	}
	handle := errorHandler(func(w http.ResponseWriter, _ *http.Request, _ error) {
		w.WriteHeader(http.StatusInternalServerError)
	})
	for _, c := range cases {
		rec := httptest.NewRecorder()
		handle(rec, httptest.NewRequest(http.MethodPost, "/v1/bank/accounts/query", nil), c.err)
		if rec.Code != c.want {
			t.Errorf("%s: status %d, want %d", c.name, rec.Code, c.want)
		}
		if got := code(t, rec.Body.Bytes()); got != c.name {
			t.Errorf("%s: code %q", c.name, got)
		}
		if len(c.declared) == 0 {
			t.Errorf("%s: no operation declares it", c.name)
		}
	}
}
