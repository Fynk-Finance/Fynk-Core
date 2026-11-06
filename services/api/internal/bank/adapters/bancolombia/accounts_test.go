package bancolombia

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
)

const balancesPath = "/api/open-banking/v1/deposits/accounts/balances"

// The documented example: a savings and a checking account, plus a loan (LAAC) Fynk does not show.
const balancesOK = `{"Data":{"AccountReport":[
 {"AccountIdentification":"afebcd15690aefd4","AccountName":"Pepito Perez","AccountType":"SVGS","AccountReference":"5089012345678900","AccountStatus":"Enabled",
  "MultilateralBalance":[{"Amount":"950000.00","Currency":"COP","Type":"AVLB"},{"Amount":"3585000.00","Currency":"COP","Type":"TPBL"}]},
 {"AccountIdentification":"1dn1d6310nns61178","AccountName":"Pepito Perez","AccountType":"CACC","AccountReference":"2020012345678900","AccountStatus":"Enabled",
  "MultilateralBalance":[{"Amount":2150000.5,"Currency":"COP","Type":"AVLB"}]},
 {"AccountIdentification":"2g6f2bfb6bnsfnbz","AccountType":"LAAC","AccountReference":"7958012345678900","AccountStatus":"Enabled",
  "MultilateralBalance":[{"Amount":"45700.00","Currency":"COP","Type":"AVLB"}]}]},
 "Links":{"Self":"https://apis.com/open-banking/v1/accounts?pageNumber=1"}}`

// HU-009 and HU-010: the accounts the bank returned, with their balance in centavos and only
// the last 4 digits of the number.
func TestAccountsMapsSavingsAndCheckingWithTheAvailableBalance(t *testing.T) {
	a, bank, _ := setup(t)
	bank.answers["GET "+balancesPath] = jsonAnswer(200, balancesOK)
	got, err := a.Accounts(context.Background(), "access-1")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("accounts %+v", got)
	}
	s, c := got[0], got[1]
	if s.ProviderAccountID != "afebcd15690aefd4" || s.Kind != ports.AccountSavings || s.DisplayName != "Bancolombia · Ahorros" ||
		s.Last4 != "8900" || s.BalanceMinor != 95_000_000 || s.Currency != "COP" || s.Closed || !s.IsSimulated {
		t.Fatalf("savings %+v", s)
	}
	if c.Kind != ports.AccountChecking || c.DisplayName != "Bancolombia · Corriente" || c.BalanceMinor != 215_000_050 {
		t.Fatalf("checking %+v", c)
	}
	call := bank.calls[0]
	if call.header.Get("Authorization") != "Bearer access-1" || call.header.Get("x-fapi-interaction-id") == "" {
		t.Fatalf("headers %v", call.header)
	}
}

func TestAccountsFollowsTheNextPage(t *testing.T) {
	a, bank, _ := setup(t)
	pages := 0
	bank.answers["GET "+balancesPath] = func(w http.ResponseWriter) {
		pages++
		if pages == 1 {
			jsonAnswer(200, `{"Data":{"AccountReport":[{"AccountIdentification":"first-account-0001","AccountType":"SVGS","AccountReference":"1111","AccountStatus":"Enabled","MultilateralBalance":[]}]},
			 "Links":{"Next":"https://apis.com/open-banking/v1/accounts?pageNumber=2"}}`)(w)
			return
		}
		jsonAnswer(200, `{"Data":{"AccountReport":[{"AccountIdentification":"second-account-002","AccountType":"CACC","AccountReference":"2222","AccountStatus":"Disabled","MultilateralBalance":[]}]}}`)(w)
	}
	got, err := a.Accounts(context.Background(), "access-1")
	if err != nil || len(got) != 2 || !got[1].Closed {
		t.Fatalf("accounts %+v, %v", got, err)
	}
	if len(bank.calls) != 2 || bank.calls[1].query.Get("pageNumber") != "2" {
		t.Fatalf("calls %+v", bank.calls)
	}
}

// HU-008 and the sync engine: an expired or revoked consent at the bank revokes the link.
func TestAConsentEndedAtTheBankIsConsentRevoked(t *testing.T) {
	for _, body := range []struct {
		status int
		json   string
	}{
		{403, `{"Code":"NAUT","Message":"Unauthorized consent","Errors":[{"ErrorCode":"BP40353006","Detail":"Unauthorized consent."}]}`},
		{403, `{"Code":"NAUT","Message":"Unauthorized consent","Errors":[{"ErrorCode":"BP40353007","Detail":"Unauthorized consent."}]}`},
		{404, `{"Code":"NAUT","Message":"Unauthorized consent","Errors":[{"ErrorCode":"BP40453008","Detail":"Unauthorized consent."}]}`},
	} {
		a, bank, _ := setup(t)
		bank.answers["GET "+balancesPath] = jsonAnswer(body.status, body.json)
		if _, err := a.Accounts(context.Background(), "access-1"); !errors.Is(err, ports.ErrConsentRevoked) {
			t.Fatalf("%d: got %v", body.status, err)
		}
	}
}

// The sandbox's gateway answers 401 invalid_client when Fynk's mTLS certificate or API Market
// credentials are missing or not trusted. That is Fynk's setup, not the person's consent: it
// must not ask anyone to reconnect. A 401 about the token still does.
func TestA401AboutFynksClientIsUnavailableNotInvalidGrant(t *testing.T) {
	for _, body := range []string{
		`{"error":"invalid_client","error_description":"Client certificate not recieved. MTLS connection not established"}`,
		`{"error":"invalid_client","error_description":"Client certificate is not valid or is not issued by a trusted CA."}`,
	} {
		a, bank, _ := setup(t)
		bank.answers["GET "+balancesPath] = jsonAnswer(401, body)
		_, err := a.Accounts(context.Background(), "access-1")
		if !errors.Is(err, ports.ErrProviderUnavailable) || errors.Is(err, ports.ErrInvalidGrant) {
			t.Fatalf("got %v", err)
		}
	}
	a, bank, _ := setup(t)
	bank.answers["GET "+balancesPath] = jsonAnswer(401,
		`{"Code":"NAUT","Message":"Unauthorized","Errors":[{"ErrorCode":"BP40153001","Detail":"Invalid token."}]}`)
	if _, err := a.Accounts(context.Background(), "access-1"); !errors.Is(err, ports.ErrInvalidGrant) {
		t.Fatalf("an invalid token: got %v", err)
	}
}

const txPath = "/api/open-banking/v1/deposits/accounts/afebcd15690aefd4/transactions"

// From the documented examples, with a rejected and a pending one added.
const transactionsOK = `{"Data":{"TransactionReport":[
 {"TransactionIdentification":"trx0001","TransactionInformation":"PAGO A PROVEEDOR DE INSUMOS INDUSTRIALES","TransactionReference":"EMP-PG-9876","CreditDebitIndicator":"DBIT",
  "BookingDateTime":"2025-01-31T00:00:00.000Z","Status":"STLD","InstructedAmount":{"Amount":"1000000.00","Currency":"COP"},"Creditor":{"Name":"Soluciones Industriales S.A.S."}},
 {"TransactionIdentification":"trx0002","TransactionInformation":"TRANSF. RECIBIDA","CreditDebitIndicator":"CRDT",
  "BookingDateTime":"2025-01-31T00:10:00.000Z","Status":"STLD","InstructedAmount":{"Amount":"1000000.00","Currency":"COP"}},
 {"TransactionIdentification":"trx0003","TransactionInformation":"COMPRA RECHAZADA","CreditDebitIndicator":"DBIT",
  "BookingDateTime":"2025-01-31T00:20:00.000Z","Status":"RJTD","InstructedAmount":{"Amount":"5000.00","Currency":"COP"}},
 {"TransactionIdentification":"trx0004","TransactionInformation":"COMPRA EN PROCESO","CreditDebitIndicator":"DBIT",
  "BookingDateTime":"2025-01-31T00:30:00.000Z","Status":"FNLD","InstructedAmount":{"Amount":"12480.35","Currency":"COP"}}]},
 "Links":{"Self":"https://apis.com/open-banking/v1/accounts?pageNumber=1","Next":"https://apis.com/open-banking/v1/accounts?pageNumber=2","Last":"https://apis.com/open-banking/v1/accounts?pageNumber=3"}}`

// HU-010 and HU-011: movements in centavos, debits negative, rejected ones left out, paging by
// the bank's page number, and at most the 90 days Bancolombia keeps.
func TestTransactionsMapsAPageAndKeepsTheRangeInsideNinetyDays(t *testing.T) {
	a, bank, _ := setup(t)
	bank.answers["GET "+txPath] = jsonAnswer(200, transactionsOK)
	page, err := a.Transactions(context.Background(), "access-1", "afebcd15690aefd4", now.AddDate(-1, 0, 0), "")
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 3 || page.NextCursor != "2" {
		t.Fatalf("page %+v", page)
	}
	out, in, pending := page.Items[0], page.Items[1], page.Items[2]
	if out.ProviderTxID != "trx0001" || out.AmountMinor != -100_000_000 || out.Status != ports.TxBooked ||
		out.MerchantRaw != "Soluciones Industriales S.A.S." || !out.BookedAt.Equal(time.Date(2025, 1, 31, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("debit %+v", out)
	}
	if in.AmountMinor != 100_000_000 || in.MerchantRaw != "" || in.Description != "TRANSF. RECIBIDA" {
		t.Fatalf("credit %+v", in)
	}
	if pending.Status != ports.TxPending || pending.AmountMinor != -1_248_035 {
		t.Fatalf("pending %+v", pending)
	}
	q := bank.calls[0].query
	if q.Get("fromValueDate") != now.Add(-History).Format(time.RFC3339) || q.Get("toValueDate") != now.Format(time.RFC3339) ||
		q.Get("pageNumber") != "" {
		t.Fatalf("query %v", q)
	}

	if _, err := a.Transactions(context.Background(), "access-1", "afebcd15690aefd4", now.Add(-72*time.Hour), "2"); err != nil {
		t.Fatal(err)
	}
	q = bank.calls[1].query
	if q.Get("pageNumber") != "2" || q.Get("fromValueDate") != now.Add(-72*time.Hour).Format(time.RFC3339) {
		t.Fatalf("incremental query %v", q)
	}
}

func TestAnAccountWithoutMovementsIsAnEmptyPage(t *testing.T) {
	a, bank, _ := setup(t)
	bank.answers["GET "+txPath] = jsonAnswer(404,
		`{"Code":"X050","Message":"Transactions not available","Errors":[{"ErrorCode":"BP40453012","Detail":"Transactions not available."}]}`)
	page, err := a.Transactions(context.Background(), "access-1", "afebcd15690aefd4", now.AddDate(0, 0, -3), "")
	if err != nil || len(page.Items) != 0 || page.NextCursor != "" {
		t.Fatalf("page %+v, %v", page, err)
	}
}

func TestDecimalAmountsBecomeCentavosWithoutFloatingPoint(t *testing.T) {
	for in, want := range map[decimal]int64{
		"950000.00": 95_000_000, "0.5": 50, "12": 1200, "-42000.10": -4_200_010, "2150000.50": 215_000_050,
	} {
		if got, err := in.minor(); err != nil || got != want {
			t.Errorf("%s: got %d, %v; want %d", in, got, err, want)
		}
	}
	for _, bad := range []decimal{"", "1.234", "abc", "."} {
		if _, err := bad.minor(); err == nil {
			t.Errorf("%q: want an error", bad)
		}
	}
}
