package bancolombia

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
)

var par = ports.PARRequest{
	RedirectURI: "fynk://bank/callback", CodeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
	State: "state-1234", Nonce: "nonce-1", ConsentID: "fynk-consent-1", TermDays: 365,
	Scopes: []ports.Scope{ports.ScopeBalances, ports.ScopeTransactions, ports.ScopeAccountDetails},
}

// HU-009 and HU-030: client credentials, the consent with exactly what the person accepted,
// then the PAR with that consent, PKCE S256 and private_key_jwt.
func TestPushAuthorizationCreatesTheConsentThenThePAR(t *testing.T) {
	a, bank, s := setup(t)
	got, err := a.PushAuthorization(context.Background(), par)
	if err != nil {
		t.Fatal(err)
	}
	if len(bank.calls) != 3 || bank.calls[0].path != "/auth/token" ||
		bank.calls[1].path != "/api/open-banking/v1/deposits/accounts/account-access-consent" ||
		bank.calls[2].path != "/auth/par" {
		t.Fatalf("calls %+v", bank.calls)
	}
	cc := bank.calls[0]
	if cc.form.Get("grant_type") != "client_credentials" || cc.form.Get("scope") != tokenScope ||
		cc.form.Get("client_assertion") != "signed.assertion.jwt" || cc.form.Get("client_assertion_type") != assertionType {
		t.Fatalf("client credentials form %v", cc.form)
	}
	if cc.header.Get("Client-Id") != "fynk-client" || cc.header.Get("Client-Secret") != "market-secret" {
		t.Fatal("the API Market credentials are missing")
	}

	consent := bank.calls[1]
	if consent.header.Get("Authorization") != "Bearer zlJojElfSalTBc1CKVwi3adSHPpr" ||
		consent.header.Get("x-fapi-interaction-id") == "" || consent.header.Get("x-fapi-financial-id") == "" {
		t.Fatalf("consent headers %v", consent.header)
	}
	data := consent.body["Data"].(map[string]any)
	perms, _ := json.Marshal(data["Permissions"])
	if string(perms) != `["ReadBalances","ReadTransactionsDetail","ReadAccountsBasic"]` {
		t.Fatalf("permissions %s", perms)
	}
	if data["ExpirationDateTime"] != "2027-11-05T15:00:00Z" {
		t.Fatalf("term %v", data["ExpirationDateTime"])
	}
	owner := data["AccountOwner"].(map[string]any)
	if owner["SchemeName"] != "CC" || owner["Identification"] != "78965432" || owner["Name"] != "Pepito Perez" {
		t.Fatalf("owner %v", owner)
	}

	p := bank.calls[2].form
	if p.Get("scope") != "openid accounts ndgn1c0n63ntok" || p.Get("response_type") != "code" ||
		p.Get("code_challenge") != par.CodeChallenge || p.Get("code_challenge_method") != "S256" ||
		p.Get("state") != "state-1234" || p.Get("redirect_uri") != "fynk://bank/callback" ||
		p.Get("client_id") != "fynk-client" || p.Get("client_assertion") == "" {
		t.Fatalf("par form %v", p)
	}
	for _, aud := range s.audiences {
		if aud != "https://auth1.bancolombia.example" {
			t.Fatalf("assertion audience %q", aud)
		}
	}

	u, _ := url.Parse(got.AuthorizeURL)
	if u.Host != "auth1.bancolombia.example" || u.Query().Get("client_id") != "fynk-client" ||
		u.Query().Get("request_uri") != "urn:ietf:params:oauth:request_uri:6esc_11ACC5bwc014ltc14eY22c" || len(u.Query()) != 2 {
		t.Fatalf("authorize URL %s", got.AuthorizeURL)
	}
	if got.ExpiresIn != 90*time.Second || got.ProviderConsentID != "ndgn1c0n63ntok" {
		t.Fatalf("got %+v", got)
	}
}

func TestConsentAndPARErrorsMapToThePortErrors(t *testing.T) {
	a, bank, _ := setup(t)
	bank.answers["POST /api/open-banking/v1/deposits/accounts/account-access-consent"] = jsonAnswer(401,
		`{"Code":"NAUT","Message":"Unauthorized third party provider","Errors":[{"ErrorCode":"BP40153010","Detail":"x"}]}`)
	if _, err := a.PushAuthorization(context.Background(), par); !errors.Is(err, ports.ErrInvalidGrant) {
		t.Fatalf("consent 401: %v", err)
	}

	a, bank, _ = setup(t)
	bank.answers["POST /auth/par"] = jsonAnswer(500, `{"error":"server_error"}`)
	if _, err := a.PushAuthorization(context.Background(), par); !errors.Is(err, ports.ErrProviderUnavailable) {
		t.Fatalf("par 500: %v", err)
	}

	a, _, _ = setup(t)
	if _, err := a.PushAuthorization(context.Background(), ports.PARRequest{State: "s"}); !errors.Is(err, ports.ErrProviderUnavailable) {
		t.Fatalf("no scopes: %v", err)
	}
}
