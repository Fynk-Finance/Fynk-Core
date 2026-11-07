package keycloak

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"testing"
)

// The banco-demo realm belongs to M16 (the simulated bank). "Ingresar con Fynk" ties it to the fynk
// realm of this package, so the checks of both sides live together (HU-057).
var bancoDemoRealmFile = filepath.Join("..", "..", "..", "..", "keycloak", "realms", "banco-demo-realm.json")

type bancoDemoRealm struct {
	Realm                       string
	RegistrationEmailAsUsername bool
	DefaultSignatureAlgorithm   string
	AuthenticationFlows         []flow
	Components                  map[string][]component
	Clients                     []client
	IdentityProviders           []identityProvider
	IdentityProviderMappers     []idpMapper
}

type identityProvider struct {
	Alias                     string
	DisplayName               string
	ProviderID                string
	Enabled                   bool
	StoreToken                bool
	TrustEmail                bool
	FirstBrokerLoginFlowAlias string
	Config                    map[string]string
}

type idpMapper struct {
	Name                   string
	IdentityProviderAlias  string
	IdentityProviderMapper string
	Config                 map[string]string
}

func loadBancoDemo(t *testing.T) (bancoDemoRealm, []byte) {
	t.Helper()
	raw, err := os.ReadFile(bancoDemoRealmFile)
	if err != nil {
		t.Fatalf("read realm: %v", err)
	}
	var r bancoDemoRealm
	if err := json.Unmarshal(raw, &r); err != nil {
		t.Fatalf("parse realm: %v", err)
	}
	return r, raw
}

func bancoDemoClient(t *testing.T, r bancoDemoRealm, id string) client {
	t.Helper()
	for _, c := range r.Clients {
		if c.ClientID == id {
			return c
		}
	}
	t.Fatalf("client %q is missing", id)
	return client{}
}

func fynkProvider(t *testing.T, r bancoDemoRealm) identityProvider {
	t.Helper()
	for _, p := range r.IdentityProviders {
		if p.Alias == "fynk" {
			return p
		}
	}
	t.Fatal("identity provider fynk is missing")
	return identityProvider{}
}

func TestBancoDemoOffersIngresarConFynk(t *testing.T) {
	r, _ := loadBancoDemo(t)
	p := fynkProvider(t, r)
	if p.DisplayName != "Ingresar con Fynk" || p.ProviderID != "oidc" || !p.Enabled {
		t.Fatalf("provider = %+v", p)
	}
	if p.StoreToken || p.TrustEmail {
		t.Fatal("the Fynk token is not stored and no email is trusted")
	}
	c := p.Config
	if c["clientId"] != "banco-demo-broker" || c["clientSecret"] != "${BANCO_DEMO_BROKER_SECRET}" {
		t.Fatalf("client = %q, secret = %q", c["clientId"], c["clientSecret"])
	}
	if c["pkceEnabled"] != "true" || c["pkceMethod"] != "S256" {
		t.Fatalf("pkce = %q %q", c["pkceEnabled"], c["pkceMethod"])
	}
	if c["validateSignature"] != "true" || c["useJwksUrl"] != "true" || c["disableUserInfo"] != "true" {
		t.Fatalf("the ID token signature must be checked against the JWKS, config = %v", c)
	}
	// The browser goes to the public host, Keycloak itself calls the container host.
	if !strings.HasPrefix(c["authorizationUrl"], "http://localhost:8081/realms/fynk/") ||
		!strings.HasPrefix(c["tokenUrl"], "http://keycloak:8080/realms/fynk/") ||
		!strings.HasPrefix(c["jwksUrl"], "http://keycloak:8080/realms/fynk/") ||
		c["issuer"] != "http://localhost:8081/realms/fynk" {
		t.Fatalf("urls = %v", c)
	}
}

func TestFynkLoginCreatesTheUserWithoutAReviewForm(t *testing.T) {
	r, _ := loadBancoDemo(t)
	p := fynkProvider(t, r)
	var f flow
	for _, candidate := range r.AuthenticationFlows {
		if candidate.Alias == p.FirstBrokerLoginFlowAlias {
			f = candidate
		}
	}
	if f.Alias == "" {
		t.Fatalf("first broker login flow %q is missing", p.FirstBrokerLoginFlowAlias)
	}
	var create bool
	for _, e := range f.AuthenticationExecutions {
		switch e.Authenticator {
		case "idp-create-user-if-unique":
			create = true
		case "idp-auto-link":
		default:
			t.Errorf("the flow must not hold %q (no review-profile, no password or email step)", e.Authenticator)
		}
	}
	if !create {
		t.Fatal("the flow must create the user")
	}
}

// Fynk sends no email, so the user cannot depend on one: not as the user name, not as a required
// attribute of the profile.
func TestBrokeredUsersNeedNoEmail(t *testing.T) {
	r, _ := loadBancoDemo(t)
	if r.RegistrationEmailAsUsername {
		t.Fatal("registrationEmailAsUsername would make the brokered user fail: the user name comes from the Fynk id")
	}
	var template bool
	for _, m := range r.IdentityProviderMappers {
		if m.IdentityProviderAlias == "fynk" && m.IdentityProviderMapper == "oidc-username-idp-mapper" {
			template = m.Config["template"] == "${ALIAS}.${CLAIM.fynk_sub}" && m.Config["target"] == "LOCAL"
		}
	}
	if !template {
		t.Fatal("the user name must be a template of the fynk_sub claim")
	}
	comps := r.Components["org.keycloak.userprofile.UserProfileProvider"]
	if len(comps) != 1 || len(comps[0].Config["kc.user.profile.config"]) != 1 {
		t.Fatal("the realm needs its own declarative user profile")
	}
	var profile userProfile
	if err := json.Unmarshal([]byte(comps[0].Config["kc.user.profile.config"][0]), &profile); err != nil {
		t.Fatal(err)
	}
	for _, a := range profile.Attributes {
		if a.Name == "email" && len(a.Required) != 0 {
			t.Fatalf("email must be optional, required = %s", a.Required)
		}
	}
}

func TestFynkSubIsImportedAndPutInTheIDToken(t *testing.T) {
	r, _ := loadBancoDemo(t)
	var imported bool
	for _, m := range r.IdentityProviderMappers {
		if m.IdentityProviderAlias == "fynk" && m.IdentityProviderMapper == "oidc-user-attribute-idp-mapper" &&
			m.Config["claim"] == "fynk_sub" && m.Config["user.attribute"] == "fynk_sub" {
			imported = true
		}
	}
	if !imported {
		t.Fatal("an attribute importer must store the fynk_sub claim as the user attribute fynk_sub")
	}

	c := bancoDemoClient(t, r, "bank-portal")
	var claims []string
	for _, pm := range c.ProtocolMappers {
		if pm.Config["id.token.claim"] != "true" || pm.Config["access.token.claim"] == "true" {
			t.Errorf("mapper %+v must be ID token only", pm)
		}
		claims = append(claims, pm.Config["claim.name"])
		if pm.ProtocolMapper == "oidc-usermodel-attribute-mapper" && (pm.Config["user.attribute"] != "fynk_sub" || pm.Config["claim.name"] != "fynk_sub") {
			t.Errorf("attribute mapper = %+v", pm)
		}
	}
	// oidc-sub-mapper has no claim.name: it writes sub.
	for _, want := range []string{"fynk_sub", "preferred_username"} {
		if !slices.Contains(claims, want) {
			t.Errorf("bank-portal ID tokens lack %s, claims = %v", want, claims)
		}
	}
	for _, bad := range []string{"email", "given_name", "family_name", "name"} {
		if slices.Contains(claims, bad) {
			t.Errorf("bank-portal ID tokens must not carry %s", bad)
		}
	}
}

func TestBankPortalIsAConfidentialClientWithPKCE(t *testing.T) {
	r, _ := loadBancoDemo(t)
	c := bancoDemoClient(t, r, "bank-portal")
	if c.PublicClient || !c.StandardFlowEnabled || c.ImplicitFlowEnabled || c.DirectAccessGrantsEnabled {
		t.Fatal("bank-portal must be confidential with only the standard flow")
	}
	if c.Secret != "${BANK_PORTAL_CLIENT_SECRET}" {
		t.Fatalf("secret must come from the environment, got %q", c.Secret)
	}
	if c.Attributes["pkce.code.challenge.method"] != "S256" {
		t.Fatalf("pkce = %q", c.Attributes["pkce.code.challenge.method"])
	}
	if !slices.Contains(c.RedirectURIs, "http://localhost:8082/*") {
		t.Fatalf("redirectUris = %v", c.RedirectURIs)
	}
}

// The simulator accepts PS256 ID tokens only, so the realm needs an active PS256 key.
func TestBancoDemoSignsWithPS256(t *testing.T) {
	r, _ := loadBancoDemo(t)
	if r.DefaultSignatureAlgorithm != "PS256" {
		t.Fatalf("defaultSignatureAlgorithm = %q", r.DefaultSignatureAlgorithm)
	}
	for _, k := range r.Components["org.keycloak.keys.KeyProvider"] {
		if k.ProviderID == "rsa-generated" && slices.Contains(k.Config["algorithm"], "PS256") && slices.Contains(k.Config["active"], "true") {
			return
		}
	}
	t.Fatal("no active PS256 key provider")
}

func TestNoSecretIsWrittenInTheBancoDemoRealmFile(t *testing.T) {
	_, raw := loadBancoDemo(t)
	var doc any
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatal(err)
	}
	placeholder := regexp.MustCompile(`^\$\{[A-Z0-9_]+\}$`)
	var walk func(path string, v any)
	walk = func(path string, v any) {
		switch v := v.(type) {
		case map[string]any:
			for k, child := range v {
				secret := strings.EqualFold(k, "clientSecret") || isSecretKey(path, k)
				if s, ok := child.(string); ok && secret && !placeholder.MatchString(s) {
					t.Errorf("%s.%s is not an environment placeholder without default", path, k)
				}
				walk(path+"."+k, child)
			}
		case []any:
			for _, child := range v {
				walk(path+"[]", child)
			}
		}
	}
	walk("realm", doc)
}
