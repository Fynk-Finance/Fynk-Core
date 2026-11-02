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

// realmFile is the realm Keycloak imports at start (services/keycloak/realms/).
var realmFile = filepath.Join("..", "..", "..", "..", "keycloak", "realms", "fynk-realm.json")

// realm holds the parts of the realm representation these tests check. encoding/json matches
// field names without case, so ssoSessionIdleTimeout fills SsoSessionIdleTimeout.
type realm struct {
	Realm                               string
	Enabled                             bool
	LoginWithEmailAllowed               bool
	RegistrationAllowed                 bool
	RegistrationEmailAsUsername         bool
	DuplicateEmailsAllowed              bool
	VerifyEmail                         bool
	ResetPasswordAllowed                bool
	InternationalizationEnabled         bool
	SupportedLocales                    []string
	DefaultLocale                       string
	LoginTheme                          string
	EmailTheme                          string
	BruteForceProtected                 bool
	PermanentLockout                    bool
	FailureFactor                       int
	WaitIncrementSeconds                int
	MaxFailureWaitSeconds               int
	PasswordPolicy                      string
	DefaultSignatureAlgorithm           string
	AccessTokenLifespan                 int
	RevokeRefreshToken                  bool
	RefreshTokenMaxReuse                int
	SsoSessionIdleTimeout               int
	SsoSessionMaxLifespan               int
	ActionTokenGeneratedByUserLifespan  int
	ActionTokenGeneratedByAdminLifespan int
	EventsEnabled                       bool
	EventsExpiration                    int
	EventsListeners                     []string
	EnabledEventTypes                   []string
	AdminEventsEnabled                  bool
	AdminEventsDetailsEnabled           bool
	Attributes                          map[string]string
	SMTPServer                          map[string]string
	RegistrationFlow                    string
	ResetCredentialsFlow                string
	AuthenticationFlows                 []flow
	RequiredActions                     []requiredAction
	AuthenticatorConfig                 []authenticatorConfig
	Components                          map[string][]component
	Clients                             []client
	Users                               []user
}

type flow struct {
	Alias                    string
	TopLevel                 bool
	AuthenticationExecutions []execution
}

type execution struct {
	Authenticator       string
	AuthenticatorConfig string
	Requirement         string
	FlowAlias           string
	Priority            int
}

type authenticatorConfig struct {
	Alias  string
	Config map[string]string
}

type requiredAction struct {
	Alias         string
	ProviderID    string
	Enabled       bool
	DefaultAction bool
	Priority      int
}

type component struct {
	Name       string
	ProviderID string
	Config     map[string][]string
}

type client struct {
	ClientID                  string
	Enabled                   bool
	PublicClient              bool
	BearerOnly                bool
	StandardFlowEnabled       bool
	ImplicitFlowEnabled       bool
	DirectAccessGrantsEnabled bool
	ServiceAccountsEnabled    bool
	ConsentRequired           bool
	Secret                    string
	BaseURL                   string
	RedirectURIs              []string
	WebOrigins                []string
	Attributes                map[string]string
	DefaultClientScopes       []string
	OptionalClientScopes      []string
	ProtocolMappers           []mapper
}

type mapper struct {
	ProtocolMapper string
	Config         map[string]string
}

type user struct {
	Username               string
	ServiceAccountClientID string
	ClientRoles            map[string][]string
}

// userProfile is the declarative user profile stored as a JSON string in its component.
type userProfile struct {
	UnmanagedAttributePolicy string
	Attributes               []struct {
		Name     string
		Required json.RawMessage
	}
}

func loadRealm(t *testing.T) (realm, []byte) {
	t.Helper()
	raw, err := os.ReadFile(realmFile)
	if err != nil {
		t.Fatalf("read realm: %v", err)
	}
	var r realm
	if err := json.Unmarshal(raw, &r); err != nil {
		t.Fatalf("parse realm: %v", err)
	}
	return r, raw
}

func clientByID(t *testing.T, r realm, id string) client {
	t.Helper()
	for _, c := range r.Clients {
		if c.ClientID == id {
			return c
		}
	}
	t.Fatalf("client %q is missing", id)
	return client{}
}

func flowByAlias(t *testing.T, r realm, alias string) flow {
	t.Helper()
	for _, f := range r.AuthenticationFlows {
		if f.Alias == alias {
			return f
		}
	}
	t.Fatalf("authentication flow %q is missing", alias)
	return flow{}
}

func TestRealmIsFynkAndEnabled(t *testing.T) {
	r, _ := loadRealm(t)
	if r.Realm != "fynk" || !r.Enabled {
		t.Fatalf("realm = %q, enabled = %v", r.Realm, r.Enabled)
	}
}

// HU-001: registration with the email as login, one account per email, email verified.
func TestRegistrationUsesTheEmailOnceAndVerifiesIt(t *testing.T) {
	r, _ := loadRealm(t)
	if !r.RegistrationAllowed || !r.LoginWithEmailAllowed || !r.RegistrationEmailAsUsername {
		t.Fatal("registration with the email as username must be on")
	}
	if r.DuplicateEmailsAllowed {
		t.Fatal("duplicate emails must not be allowed")
	}
	if !r.VerifyEmail {
		t.Fatal("verify email must be required")
	}
	if !r.ResetPasswordAllowed {
		t.Fatal("password reset by email must be allowed (HU-005)")
	}
}

// HU-050 and HU-001: at least 8 characters, one letter, one digit, not the email.
func TestPasswordPolicy(t *testing.T) {
	r, _ := loadRealm(t)
	want := "length(8) and regexPattern(.*[A-Za-z].*) and digits(1) and notEmail"
	if r.PasswordPolicy != want {
		t.Fatalf("passwordPolicy = %q, want %q", r.PasswordPolicy, want)
	}
}

// HU-050: lock the user for 15 minutes after 5 failures, never permanently.
func TestBruteForceProtection(t *testing.T) {
	r, _ := loadRealm(t)
	if !r.BruteForceProtected || r.PermanentLockout {
		t.Fatalf("bruteForceProtected = %v, permanentLockout = %v", r.BruteForceProtected, r.PermanentLockout)
	}
	if r.FailureFactor != 5 || r.WaitIncrementSeconds != 900 || r.MaxFailureWaitSeconds != 900 {
		t.Fatalf("failureFactor = %d, wait = %d s, max wait = %d s; want 5, 900, 900",
			r.FailureFactor, r.WaitIncrementSeconds, r.MaxFailureWaitSeconds)
	}
}

// HU-050: PS256 tokens from a real PS256 key, 5 minute access tokens, refresh token rotation.
func TestTokensArePS256ShortLivedAndRotated(t *testing.T) {
	r, _ := loadRealm(t)
	if r.DefaultSignatureAlgorithm != "PS256" {
		t.Fatalf("defaultSignatureAlgorithm = %q", r.DefaultSignatureAlgorithm)
	}
	var ps256 bool
	for _, k := range r.Components["org.keycloak.keys.KeyProvider"] {
		if k.ProviderID == "rsa-generated" && slices.Equal(k.Config["algorithm"], []string{"PS256"}) {
			ps256 = true
		}
	}
	if !ps256 {
		t.Fatal("no rsa-generated key provider with algorithm PS256")
	}
	if r.AccessTokenLifespan != 300 {
		t.Fatalf("accessTokenLifespan = %d, want 300", r.AccessTokenLifespan)
	}
	if !r.RevokeRefreshToken || r.RefreshTokenMaxReuse != 0 {
		t.Fatalf("revokeRefreshToken = %v, refreshTokenMaxReuse = %d", r.RevokeRefreshToken, r.RefreshTokenMaxReuse)
	}
}

// Sessions without offline tokens (team decision, CLAUDE.md "Offline sessions"): 30 days idle, 90 days max.
func TestSessionsLast30DaysIdleWithoutOfflineAccess(t *testing.T) {
	r, _ := loadRealm(t)
	if r.SsoSessionIdleTimeout != 30*24*3600 || r.SsoSessionMaxLifespan != 90*24*3600 {
		t.Fatalf("ssoSessionIdleTimeout = %d, ssoSessionMaxLifespan = %d", r.SsoSessionIdleTimeout, r.SsoSessionMaxLifespan)
	}
	m := clientByID(t, r, "fynk-mobile")
	if m.Attributes["client.session.idle.timeout"] != "2592000" || m.Attributes["client.session.max.lifespan"] != "7776000" {
		t.Fatalf("fynk-mobile session attributes = %v", m.Attributes)
	}
	if slices.Contains(m.DefaultClientScopes, "offline_access") || slices.Contains(m.OptionalClientScopes, "offline_access") {
		t.Fatal("fynk-mobile must not offer offline_access")
	}
}

// HU-050 and HU-005: the email codes (verification and password reset) expire after 10 minutes.
// The code extension reads the realm-wide action token lifespan.
func TestEmailCodesExpireIn10Minutes(t *testing.T) {
	r, _ := loadRealm(t)
	// No per-action overrides: the realm-wide values apply to every email code.
	if r.ActionTokenGeneratedByUserLifespan != 600 || r.ActionTokenGeneratedByAdminLifespan != 600 {
		t.Fatalf("action token lifespans = %d (user), %d (admin), want 600",
			r.ActionTokenGeneratedByUserLifespan, r.ActionTokenGeneratedByAdminLifespan)
	}
	for k := range r.Attributes {
		if strings.HasPrefix(k, "actionTokenGeneratedBy") {
			t.Fatalf("attribute %s overrides the 10 minute code lifespan", k)
		}
	}
}

// HU-001: the terms and the privacy policy are accepted on the registration form.
func TestTermsAreRequiredOnTheRegistrationForm(t *testing.T) {
	r, _ := loadRealm(t)
	top := flowByAlias(t, r, r.RegistrationFlow)
	if !top.TopLevel || len(top.AuthenticationExecutions) != 1 || top.AuthenticationExecutions[0].FlowAlias == "" {
		t.Fatalf("registration flow %q must hold one form subflow", r.RegistrationFlow)
	}
	form := flowByAlias(t, r, top.AuthenticationExecutions[0].FlowAlias)
	want := map[string]bool{
		"registration-user-creation":        false,
		"registration-password-action":      false,
		"registration-terms-and-conditions": false,
	}
	for _, e := range form.AuthenticationExecutions {
		if _, ok := want[e.Authenticator]; ok && e.Requirement == "REQUIRED" {
			want[e.Authenticator] = true
		}
	}
	for name, required := range want {
		if !required {
			t.Fatalf("%s must be REQUIRED in %q", name, form.Alias)
		}
	}
	// Keycloak records the acceptance date (user attribute terms_and_conditions) only while
	// this required action is enabled.
	if !requiredActionEnabled(r, "TERMS_AND_CONDITIONS") {
		t.Fatal("required action TERMS_AND_CONDITIONS must be enabled")
	}
}

// Listing requiredActions replaces Keycloak's defaults instead of adding to them. Without
// UPDATE_PASSWORD the reset flow fails, and without the code action an unverified user gets tokens.
func TestRequiredActionsKeepTheCodeActionAndUpdatePassword(t *testing.T) {
	r, _ := loadRealm(t)
	for _, alias := range []string{"fynk-verify-email-code", "UPDATE_PASSWORD", "UPDATE_PROFILE", "VERIFY_PROFILE"} {
		if !requiredActionEnabled(r, alias) {
			t.Fatalf("required action %s must be listed and enabled", alias)
		}
	}
}

// The email is verified with a 6 digit code (extension fynk-email-code), not with Keycloak's link.
// A disabled required action is never triggered nor executed, so VERIFY_EMAIL stays listed but off.
func TestEmailIsVerifiedWithTheCodeActionNotTheLink(t *testing.T) {
	r, _ := loadRealm(t)
	var link, code requiredAction
	for _, a := range r.RequiredActions {
		switch a.Alias {
		case "VERIFY_EMAIL":
			link = a
		case "fynk-verify-email-code":
			code = a
		}
	}
	if link.Alias == "" || link.Enabled {
		t.Fatalf("VERIFY_EMAIL must be listed and disabled, got %+v", link)
	}
	if code.ProviderID != "fynk-verify-email-code" || !code.Enabled || code.DefaultAction {
		t.Fatalf("fynk-verify-email-code must be enabled and not a default action, got %+v", code)
	}
	if code.Priority != link.Priority {
		t.Fatalf("the code action priority = %d, want %d (the one VERIFY_EMAIL had)", code.Priority, link.Priority)
	}
	if !r.VerifyEmail {
		t.Fatal("verifyEmail must stay on, it is what triggers the code action")
	}
}

// With verifyEmail on, Keycloak hides the password on the registration form unless this is set.
// The password is chosen at registration and the code only proves the email.
func TestRegistrationAsksForThePasswordBeforeTheCode(t *testing.T) {
	r, _ := loadRealm(t)
	top := flowByAlias(t, r, r.RegistrationFlow)
	form := flowByAlias(t, r, top.AuthenticationExecutions[0].FlowAlias)
	for _, e := range form.AuthenticationExecutions {
		if e.Authenticator != "registration-password-action" {
			continue
		}
		for _, c := range r.AuthenticatorConfig {
			if c.Alias == e.AuthenticatorConfig && c.Config["always_set_password_on_register_form"] == "true" {
				return
			}
		}
		t.Fatalf("registration-password-action config %q must set always_set_password_on_register_form to true", e.AuthenticatorConfig)
	}
	t.Fatal("registration-password-action is missing from the registration form")
}

// Password recovery uses the 6-digit code (extension fynk-email-code), never Keycloak's link.
// The code step sits between choosing the user and setting the password, and there is no OTP step.
func TestPasswordResetUsesTheCodeNotTheLink(t *testing.T) {
	r, _ := loadRealm(t)
	if !r.ResetPasswordAllowed {
		t.Fatal("resetPasswordAllowed must stay on")
	}
	if r.ResetCredentialsFlow != "fynk reset credentials" {
		t.Fatalf("resetCredentialsFlow = %q, want fynk reset credentials", r.ResetCredentialsFlow)
	}
	f := flowByAlias(t, r, r.ResetCredentialsFlow)
	if !f.TopLevel {
		t.Fatal("the reset flow must be top level")
	}
	want := []string{"reset-credentials-choose-user", "fynk-reset-credential-code", "reset-password"}
	var got []string
	for i, e := range f.AuthenticationExecutions {
		if e.Requirement != "REQUIRED" {
			t.Fatalf("execution %s is %s, want REQUIRED", e.Authenticator, e.Requirement)
		}
		if i > 0 && e.Priority <= f.AuthenticationExecutions[i-1].Priority {
			t.Fatalf("priorities must increase: %+v", f.AuthenticationExecutions)
		}
		got = append(got, e.Authenticator)
	}
	if !slices.Equal(got, want) {
		t.Fatalf("reset executions = %v, want %v", got, want)
	}
	for _, fl := range r.AuthenticationFlows {
		for _, e := range fl.AuthenticationExecutions {
			if e.Authenticator == "reset-credential-email" {
				t.Fatalf("flow %q uses the link authenticator reset-credential-email", fl.Alias)
			}
		}
	}
}

func requiredActionEnabled(r realm, alias string) bool {
	for _, a := range r.RequiredActions {
		if a.Alias == alias {
			return a.Enabled
		}
	}
	return false
}

// HU-001: the cédula is never asked for or stored. Users cannot add attributes of their own,
// and the name is optional at registration (M3 asks for it later).
func TestUserProfileHasNoCedulaAndAnOptionalName(t *testing.T) {
	r, raw := loadRealm(t)
	if regexp.MustCompile(`(?i)c[eé]dula|documento`).Match(raw) {
		t.Fatal("the realm mentions a cédula or document field")
	}
	providers := r.Components["org.keycloak.userprofile.UserProfileProvider"]
	if len(providers) != 1 || len(providers[0].Config["kc.user.profile.config"]) != 1 {
		t.Fatal("the realm must define the declarative user profile")
	}
	var up userProfile
	if err := json.Unmarshal([]byte(providers[0].Config["kc.user.profile.config"][0]), &up); err != nil {
		t.Fatalf("parse user profile: %v", err)
	}
	if up.UnmanagedAttributePolicy != "ADMIN_VIEW" {
		t.Fatalf("unmanagedAttributePolicy = %q, want ADMIN_VIEW (users cannot add attributes)", up.UnmanagedAttributePolicy)
	}
	allowed := map[string]bool{"username": true, "email": true, "firstName": true, "lastName": true}
	for _, a := range up.Attributes {
		if !allowed[a.Name] {
			t.Fatalf("unexpected user profile attribute %q", a.Name)
		}
		if (a.Name == "firstName" || a.Name == "lastName") && len(a.Required) > 0 {
			t.Fatalf("%s must not be required at registration", a.Name)
		}
	}
}

// HU-050 and HU-002: the app is a public client with Authorization Code and PKCE S256 only.
func TestMobileClientIsPublicWithPKCE(t *testing.T) {
	r, _ := loadRealm(t)
	m := clientByID(t, r, "fynk-mobile")
	if !m.Enabled || !m.PublicClient || !m.StandardFlowEnabled {
		t.Fatal("fynk-mobile must be an enabled public client with the standard flow")
	}
	if m.ImplicitFlowEnabled || m.DirectAccessGrantsEnabled || m.ServiceAccountsEnabled || m.ConsentRequired {
		t.Fatal("fynk-mobile must not allow implicit, password or service account grants, nor ask for consent")
	}
	if m.Attributes["pkce.code.challenge.method"] != "S256" {
		t.Fatalf("pkce.code.challenge.method = %q", m.Attributes["pkce.code.challenge.method"])
	}
	if m.Attributes["oauth2.device.authorization.grant.enabled"] != "false" {
		t.Fatal("the device grant must be off")
	}
	if !slices.Equal(m.RedirectURIs, []string{"co.fynk.app://oauth/callback"}) || len(m.WebOrigins) != 0 {
		t.Fatalf("redirectUris = %v, webOrigins = %v", m.RedirectURIs, m.WebOrigins)
	}
	var audience bool
	for _, pm := range m.ProtocolMappers {
		if pm.ProtocolMapper == "oidc-audience-mapper" && pm.Config["included.client.audience"] == "fynk-api" &&
			pm.Config["access.token.claim"] == "true" {
			audience = true
		}
	}
	if !audience {
		t.Fatal("fynk-mobile access tokens must carry aud=fynk-api")
	}
}

func TestAPIClientIsBearerOnly(t *testing.T) {
	r, _ := loadRealm(t)
	if c := clientByID(t, r, "fynk-api"); !c.BearerOnly || c.StandardFlowEnabled || c.DirectAccessGrantsEnabled {
		t.Fatal("fynk-api must be bearer-only")
	}
}

// The backend reads users and sends verification emails with its own confidential client.
func TestAdminClientIsAConfidentialServiceAccount(t *testing.T) {
	r, _ := loadRealm(t)
	c := clientByID(t, r, "fynk-admin")
	if c.PublicClient || !c.ServiceAccountsEnabled || c.StandardFlowEnabled || c.DirectAccessGrantsEnabled {
		t.Fatal("fynk-admin must be confidential with only the service account")
	}
	if c.Secret != "${FYNK_ADMIN_CLIENT_SECRET}" {
		t.Fatalf("fynk-admin secret must come from the environment, got %q", c.Secret)
	}
	for _, u := range r.Users {
		if u.ServiceAccountClientID == "fynk-admin" {
			roles := slices.Sorted(slices.Values(u.ClientRoles["realm-management"]))
			if !slices.Equal(roles, []string{"manage-users", "view-events", "view-users"}) || len(u.ClientRoles) != 1 {
				t.Fatalf("fynk-admin roles = %v, want realm-management manage-users, view-events and view-users", u.ClientRoles)
			}
			return
		}
	}
	t.Fatal("the fynk-admin service account user is missing")
}

// HU-050 and HU-002: login, error and recovery events are kept 90 days for the audit (M13).
func TestAuthenticationEventsAreStoredFor90Days(t *testing.T) {
	r, _ := loadRealm(t)
	if !r.EventsEnabled || r.EventsExpiration != 90*24*3600 {
		t.Fatalf("eventsEnabled = %v, eventsExpiration = %d", r.EventsEnabled, r.EventsExpiration)
	}
	for _, e := range []string{
		"LOGIN", "LOGIN_ERROR", "REGISTER", "RESET_PASSWORD", "SEND_RESET_PASSWORD",
		"UPDATE_PASSWORD", "UPDATE_CREDENTIAL", "VERIFY_EMAIL", "LOGOUT",
	} {
		if !slices.Contains(r.EnabledEventTypes, e) {
			t.Fatalf("event type %s is not stored", e)
		}
	}
	if !r.AdminEventsEnabled || r.AdminEventsDetailsEnabled || r.Attributes["adminEventsExpiration"] != "7776000" {
		t.Fatal("admin events must be stored 90 days, without representations (they contain emails)")
	}
	// The jboss-logging listener writes the username, which is the email, to the logs.
	if slices.Contains(r.EventsListeners, "jboss-logging") {
		t.Fatal("events must not be written to the Keycloak logs")
	}
}

func TestSpanishIsTheOnlyLocale(t *testing.T) {
	r, _ := loadRealm(t)
	if !r.InternationalizationEnabled || !slices.Equal(r.SupportedLocales, []string{"es"}) || r.DefaultLocale != "es" {
		t.Fatalf("locales = %v, default %q", r.SupportedLocales, r.DefaultLocale)
	}
}

// The login pages are the Keycloakify theme `fynk` (services/keycloak/theme), built into the image
// by the Dockerfile. The email theme is not built yet: the emails stay the extension's own.
// fynk-mobile has no base URL because Keycloak rejects a custom-scheme one; the theme takes the
// way back to the app from the login session instead (theme/src/login/appReturnUrl.ts).
func TestLoginUsesTheFynkTheme(t *testing.T) {
	r, _ := loadRealm(t)
	if r.LoginTheme != "fynk" {
		t.Fatalf("loginTheme = %q, want fynk", r.LoginTheme)
	}
	if r.EmailTheme != "fynk" {
		t.Fatalf("emailTheme = %q, want fynk", r.EmailTheme)
	}
	if got := clientByID(t, r, "fynk-mobile").BaseURL; got != "" {
		t.Fatalf("fynk-mobile baseUrl = %q: Keycloak rejects custom-scheme base URLs", got)
	}
}

// Secrets come from the environment (Secrets Manager in AWS) and never have a default in the file.
func TestNoSecretIsWrittenInTheRealmFile(t *testing.T) {
	_, raw := loadRealm(t)
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
				if s, ok := child.(string); ok && isSecretKey(path, k) && !placeholder.MatchString(s) {
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

func isSecretKey(path, key string) bool {
	switch strings.ToLower(key) {
	case "secret", "password":
		return true
	case "value":
		return strings.HasSuffix(path, ".credentials[]")
	}
	return false
}

func TestSMTPComesFromTheEnvironment(t *testing.T) {
	r, _ := loadRealm(t)
	for _, k := range []string{"host", "port", "from", "auth", "starttls", "user", "password"} {
		if !strings.HasPrefix(r.SMTPServer[k], "${FYNK_SMTP_") {
			t.Fatalf("smtpServer.%s = %q, want a ${FYNK_SMTP_*} placeholder", k, r.SMTPServer[k])
		}
	}
}

// HU-005 / M2: fynkEmailResetAt records a password reset with the email code. The person must
// not be able to see or write it: it stays an unmanaged attribute, which ADMIN_VIEW hides from
// the account console, the account API and the forms. If it is ever declared, it is admin only.
func TestEmailResetStampIsAdminOnly(t *testing.T) {
	r, raw := loadRealm(t)
	var up userProfile
	if err := json.Unmarshal([]byte(r.Components["org.keycloak.userprofile.UserProfileProvider"][0].Config["kc.user.profile.config"][0]), &up); err != nil {
		t.Fatalf("parse user profile: %v", err)
	}
	if up.UnmanagedAttributePolicy != "ADMIN_VIEW" {
		t.Fatalf("unmanagedAttributePolicy = %q, want ADMIN_VIEW", up.UnmanagedAttributePolicy)
	}
	for _, a := range up.Attributes {
		if a.Name == "fynkEmailResetAt" {
			t.Fatal("fynkEmailResetAt must stay unmanaged, or be admin only in both view and edit")
		}
	}
	if regexp.MustCompile(`fynkEmailResetAt`).Match(raw) {
		t.Fatal("the realm file must not mention fynkEmailResetAt (no mapper may put it in a token)")
	}
}
