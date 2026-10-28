//go:build integration

package keycloak

import (
	"context"
	"errors"
	"html"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/kcadmin"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
)

// Same value the container receives as FYNK_ADMIN_CLIENT_SECRET in startStack.
const adminClientSecret = "integration-only-secret"

func adminClient() *kcadmin.Client {
	return kcadmin.New(config.Config{
		KeycloakURL: env.keycloak, KeycloakRealm: "fynk", KeycloakAdminClientSecret: adminClientSecret,
	}, nil)
}

// acceptTerms signs in as a user that has the TERMS_AND_CONDITIONS action pending, accepts
// the terms (Keycloak then stores terms_and_conditions) and returns the tokens.
func acceptTerms(t *testing.T, email string) tokenResponse {
	t.Helper()
	b := newBrowser(t)
	p := newPKCE()
	page := b.loginPage(p, nil)
	code, termsPage := b.submit(formAction(t, page, "kc-form-login"), url.Values{"username": {email}, "password": {goodPassword}})
	if code != "" {
		t.Fatal("the terms action did not appear")
	}
	var action string
	for _, tag := range formTag.FindAllString(termsPage, -1) {
		if m := actionAttr.FindStringSubmatch(tag); m != nil {
			action = absolute(html.UnescapeString(m[1]))
		}
	}
	if action == "" {
		t.Fatal("no form on the terms page")
	}
	code, _ = b.submit(action, url.Values{"accept": {"Accept"}})
	if code == "" {
		t.Fatal("accepting the terms did not finish the sign-in")
	}
	return exchange(t, code, p)
}

// D2: the API reads and writes the profile and ends sessions as the fynk-admin service account.
func TestIntegrationAdminClientProfileAndSessions(t *testing.T) {
	ctx := context.Background()
	email := newEmail("admin")
	resp := adminDo(t, http.MethodPost, "/admin/realms/fynk/users", map[string]any{
		"username": email, "email": email, "enabled": true, "emailVerified": true,
		"firstName": "Camila", "lastName": "Rojas",
		"requiredActions": []string{"TERMS_AND_CONDITIONS"},
		"credentials":     []map[string]any{{"type": "password", "value": goodPassword, "temporary": false}},
	})
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create user: %d", resp.StatusCode)
	}
	id := findUser(t, email).ID
	tok := acceptTerms(t, email)
	c := adminClient()

	before := findUser(t, email)
	if len(before.Attributes["terms_and_conditions"]) != 1 {
		t.Fatalf("setup: terms acceptance not recorded: %v", before.Attributes)
	}

	u, err := c.GetUser(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if u.Email != email || u.FirstName != "Camila" || u.LastName != "Rojas" || !u.EmailVerified ||
		time.Since(u.CreatedAt) > 5*time.Minute || u.CreatedAt.After(time.Now().Add(time.Minute)) {
		t.Fatalf("user %+v", u)
	}
	if _, err := c.GetUser(ctx, "00000000-0000-0000-0000-000000000000"); !errors.Is(err, kcadmin.ErrNotFound) {
		t.Fatalf("unknown user: %v", err)
	}

	pwd, ok, err := c.PasswordUpdatedAt(ctx, id)
	if err != nil || !ok || time.Since(pwd) > 5*time.Minute || pwd.After(time.Now().Add(time.Minute)) {
		t.Fatalf("password date %v %v %v", pwd, ok, err)
	}

	if err := c.UpdateNames(ctx, id, "Ana", "Pérez"); err != nil {
		t.Fatal(err)
	}
	after, err := c.GetUser(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if after.FirstName != "Ana" || after.LastName != "Pérez" || after.Email != email || !after.EmailVerified {
		t.Fatalf("after update %+v", after)
	}
	kept := findUser(t, email)
	if len(kept.Attributes["terms_and_conditions"]) != 1 || kept.Attributes["terms_and_conditions"][0] != before.Attributes["terms_and_conditions"][0] {
		t.Fatalf("terms_and_conditions changed: %v -> %v", before.Attributes, kept.Attributes)
	}
	if again, _, err := c.PasswordUpdatedAt(ctx, id); err != nil || !again.Equal(pwd) {
		t.Fatalf("the password credential changed: %v %v", again, err)
	}
	if err := c.UpdateNames(ctx, "00000000-0000-0000-0000-000000000000", "A", "B"); !errors.Is(err, kcadmin.ErrNotFound) {
		t.Fatalf("update unknown user: %v", err)
	}

	_, claims := decodeJWT(t, tok.AccessToken)
	sid, _ := claims["sid"].(string)
	if sid == "" {
		t.Fatal("the access token has no sid")
	}
	if err := c.DeleteSession(ctx, sid); err != nil {
		t.Fatal(err)
	}
	got := postToken(t, url.Values{"grant_type": {"refresh_token"}, "client_id": {clientID}, "refresh_token": {tok.RefreshToken}})
	if got.Error != "invalid_grant" {
		t.Fatalf("refresh after DeleteSession: error = %q, want invalid_grant", got.Error)
	}
	if err := c.DeleteSession(ctx, sid); err != nil {
		t.Fatalf("deleting a session that is gone: %v", err)
	}
}

func TestIntegrationAdminClientWithAWrongSecretIsUnavailable(t *testing.T) {
	c := kcadmin.New(config.Config{KeycloakURL: env.keycloak, KeycloakRealm: "fynk", KeycloakAdminClientSecret: "wrong"}, nil)
	if _, err := c.GetUser(context.Background(), "x"); !errors.Is(err, kcadmin.ErrUnavailable) {
		t.Fatalf("wrong secret: %v", err)
	}
}
