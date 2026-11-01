// Package kcadmin is the small slice of the Keycloak admin API the identity module uses:
// read the profile, change the names and end a session. It authenticates as the service
// account of the client fynk-admin (client credentials) and never logs or returns what
// Keycloak answers in an error.
package kcadmin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
)

const (
	adminClientID = "fynk-admin"
	// Timeout is the budget of every call to Keycloak, token request included.
	Timeout = 5 * time.Second
	// refreshMargin is how long before expiry the cached token is replaced.
	refreshMargin = 30 * time.Second
)

var (
	// ErrUnavailable means the admin client is not configured or Keycloak could not be reached.
	ErrUnavailable = errors.New("kcadmin: admin API unavailable")
	// ErrNotFound means the user does not exist.
	ErrNotFound = errors.New("kcadmin: user not found")
)

// User is the part of a Keycloak user Fynk shows.
type User struct {
	Email         string
	FirstName     string
	LastName      string
	EmailVerified bool
	CreatedAt     time.Time
}

// Client talks to the Keycloak admin API.
type Client struct {
	base   string // KeycloakURL without a trailing slash
	realm  string
	secret string
	http   *http.Client
	now    func() time.Time

	mu      sync.Mutex
	token   string
	expires time.Time
}

// New builds the client. Without a secret every method returns ErrUnavailable and nothing
// goes to the network. A nil hc gets a client with a 5 second timeout.
func New(cfg config.Config, hc *http.Client) *Client {
	if hc == nil {
		hc = &http.Client{Timeout: Timeout}
	}
	return &Client{
		base: strings.TrimRight(cfg.KeycloakURL, "/"), realm: cfg.KeycloakRealm,
		secret: cfg.KeycloakAdminClientSecret, http: hc, now: time.Now,
	}
}

func (c *Client) configured() bool { return c.secret != "" && c.base != "" }

func (c *Client) realmURL(path string) string {
	return c.base + "/admin/realms/" + url.PathEscape(c.realm) + path
}

// bearer returns a valid access token. The mutex makes concurrent callers share one request.
func (c *Client) bearer(ctx context.Context) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.token != "" && c.now().Before(c.expires) {
		return c.token, nil
	}
	form := url.Values{"grant_type": {"client_credentials"}, "client_id": {adminClientID}, "client_secret": {c.secret}}
	tokenURL := c.base + "/realms/" + url.PathEscape(c.realm) + "/protocol/openid-connect/token"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", ErrUnavailable
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := c.http.Do(req)
	if err != nil {
		return "", ErrUnavailable
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("%w: token request status %d", ErrUnavailable, resp.StatusCode)
	}
	var tok struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&tok); err != nil || tok.AccessToken == "" {
		return "", fmt.Errorf("%w: token response", ErrUnavailable)
	}
	c.token = tok.AccessToken
	c.expires = c.now().Add(time.Duration(tok.ExpiresIn)*time.Second - refreshMargin)
	return c.token, nil
}

// do sends an authenticated request and returns the body of a 2xx answer, with the status
// code (also for failures, so callers can map 404). A 401 drops the cached token so the next
// call asks for a new one.
func (c *Client) do(ctx context.Context, op, method, target string, body any) ([]byte, int, error) {
	if !c.configured() {
		return nil, 0, ErrUnavailable
	}
	tok, err := c.bearer(ctx)
	if err != nil {
		return nil, 0, err
	}
	var rd io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return nil, 0, fmt.Errorf("kcadmin: %s: encode", op)
		}
		rd = strings.NewReader(string(raw))
	}
	req, err := http.NewRequestWithContext(ctx, method, target, rd)
	if err != nil {
		return nil, 0, fmt.Errorf("kcadmin: %s: build request", op)
	}
	req.Header.Set("Authorization", "Bearer "+tok)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, 0, ErrUnavailable
	}
	defer func() { _ = resp.Body.Close() }()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode == http.StatusUnauthorized {
		c.mu.Lock()
		c.token = ""
		c.mu.Unlock()
	}
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return nil, resp.StatusCode, fmt.Errorf("kcadmin: %s: status %d", op, resp.StatusCode)
	}
	return data, resp.StatusCode, nil
}

// GetUser reads the user. ErrNotFound when Keycloak answers 404.
func (c *Client) GetUser(ctx context.Context, id string) (User, error) {
	data, status, err := c.do(ctx, "get user", http.MethodGet, c.realmURL("/users/"+url.PathEscape(id)), nil)
	if status == http.StatusNotFound {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, err
	}
	var u struct {
		Email            string `json:"email"`
		FirstName        string `json:"firstName"`
		LastName         string `json:"lastName"`
		EmailVerified    bool   `json:"emailVerified"`
		CreatedTimestamp int64  `json:"createdTimestamp"`
	}
	if err := json.Unmarshal(data, &u); err != nil {
		return User{}, errors.New("kcadmin: get user: decode")
	}
	return User{
		Email: u.Email, FirstName: u.FirstName, LastName: u.LastName, EmailVerified: u.EmailVerified,
		CreatedAt: time.UnixMilli(u.CreatedTimestamp).UTC(),
	}, nil
}

// PasswordUpdatedAt returns when the password credential was created or last changed.
// The bool is false when the user has no password credential.
func (c *Client) PasswordUpdatedAt(ctx context.Context, id string) (time.Time, bool, error) {
	data, status, err := c.do(ctx, "get credentials", http.MethodGet, c.realmURL("/users/"+url.PathEscape(id)+"/credentials"), nil)
	if status == http.StatusNotFound {
		return time.Time{}, false, ErrNotFound
	}
	if err != nil {
		return time.Time{}, false, err
	}
	var creds []struct {
		Type        string `json:"type"`
		CreatedDate int64  `json:"createdDate"`
	}
	if err := json.Unmarshal(data, &creds); err != nil {
		return time.Time{}, false, errors.New("kcadmin: get credentials: decode")
	}
	for _, cr := range creds {
		if cr.Type == "password" && cr.CreatedDate > 0 {
			return time.UnixMilli(cr.CreatedDate).UTC(), true, nil
		}
	}
	return time.Time{}, false, nil
}

// EmailResetAttribute is the user attribute the Keycloak extension fills (epoch milliseconds
// as a string) when a password reset with the email code is verified. Only that flow writes
// it, and it is admin-only: the person cannot see or change it.
const EmailResetAttribute = "fynkEmailResetAt"

// EmailResetAt returns when the person last proved the mailbox with a password reset by email
// code. The bool is false when the attribute is missing or not a valid timestamp. ErrNotFound
// when the user does not exist.
func (c *Client) EmailResetAt(ctx context.Context, id string) (time.Time, bool, error) {
	data, status, err := c.do(ctx, "get user", http.MethodGet, c.realmURL("/users/"+url.PathEscape(id)), nil)
	if status == http.StatusNotFound {
		return time.Time{}, false, ErrNotFound
	}
	if err != nil {
		return time.Time{}, false, err
	}
	var u struct {
		Attributes map[string][]string `json:"attributes"`
	}
	if err := json.Unmarshal(data, &u); err != nil {
		return time.Time{}, false, errors.New("kcadmin: get user: decode")
	}
	vals := u.Attributes[EmailResetAttribute]
	if len(vals) == 0 {
		return time.Time{}, false, nil
	}
	ms, err := strconv.ParseInt(vals[0], 10, 64)
	if err != nil || ms <= 0 {
		return time.Time{}, false, nil
	}
	return time.UnixMilli(ms).UTC(), true, nil
}

// SessionStart returns when the user's Keycloak session sid started. The bool is false when
// the user has no session with that id (it ended, or it belongs to someone else). ErrNotFound
// when the user does not exist.
func (c *Client) SessionStart(ctx context.Context, id, sid string) (time.Time, bool, error) {
	data, status, err := c.do(ctx, "get sessions", http.MethodGet, c.realmURL("/users/"+url.PathEscape(id)+"/sessions"), nil)
	if status == http.StatusNotFound {
		return time.Time{}, false, ErrNotFound
	}
	if err != nil {
		return time.Time{}, false, err
	}
	var sessions []struct {
		ID    string `json:"id"`
		Start int64  `json:"start"`
	}
	if err := json.Unmarshal(data, &sessions); err != nil {
		return time.Time{}, false, errors.New("kcadmin: get sessions: decode")
	}
	for _, s := range sessions {
		if s.ID == sid && s.Start > 0 {
			return time.UnixMilli(s.Start).UTC(), true, nil
		}
	}
	return time.Time{}, false, nil
}

// UpdateNames changes only firstName and lastName. It reads the whole user and writes it
// back without the attributes: Keycloak keeps the stored attributes (such as the terms
// acceptance) when the PUT has none, whereas sending the read-only unmanaged ones back is
// not needed.
func (c *Client) UpdateNames(ctx context.Context, id, first, last string) error {
	path := c.realmURL("/users/" + url.PathEscape(id))
	data, status, err := c.do(ctx, "get user", http.MethodGet, path, nil)
	if status == http.StatusNotFound {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	var rep map[string]any
	if err := json.Unmarshal(data, &rep); err != nil {
		return errors.New("kcadmin: update names: decode")
	}
	delete(rep, "attributes")
	rep["firstName"], rep["lastName"] = first, last
	_, status, err = c.do(ctx, "update user", http.MethodPut, path, rep)
	if status == http.StatusNotFound {
		return ErrNotFound
	}
	return err
}

// DeleteSession ends a Keycloak session. A session that is already gone is not an error.
func (c *Client) DeleteSession(ctx context.Context, sid string) error {
	_, status, err := c.do(ctx, "delete session", http.MethodDelete, c.realmURL("/sessions/"+url.PathEscape(sid)), nil)
	if status == http.StatusNotFound {
		return nil
	}
	return err
}

// DeleteUser removes a user from Keycloak. A user that is already gone is not an error.
func (c *Client) DeleteUser(ctx context.Context, id string) error {
	_, status, err := c.do(ctx, "delete user", http.MethodDelete, c.realmURL("/users/"+url.PathEscape(id)), nil)
	if status == http.StatusNotFound {
		return nil
	}
	return err
}
