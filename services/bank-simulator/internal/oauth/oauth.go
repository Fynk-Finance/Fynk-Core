package oauth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/demo"
	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/domain"
	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/store"
)

type PARData struct {
	RequestURI          string
	ConsentID           string
	ClientID            string
	RedirectURI         string
	Scope               string
	CodeChallenge       string
	CodeChallengeMethod string
	State               string
	ProviderID          string
	Nonce               string // optional, never logged
	FynkConsentID       string // optional, never logged
	ExpiresAt           time.Time
}

const (
	accessTokenTTL  = 5 * time.Minute
	refreshTokenTTL = 30 * 24 * time.Hour
)

var validProviders = map[string]bool{
	domain.ProviderBancoDemo:        true,
	domain.ProviderBilleteraDemo:    true,
	domain.ProviderBancoDigitalDemo: true,
	domain.ProviderCooperativaDemo:  true,
}

func writeOAuthError(w http.ResponseWriter, status int, code, desc string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	body := map[string]string{"error": code}
	if desc != "" {
		body["error_description"] = desc
	}
	_ = json.NewEncoder(w).Encode(body)
}

type AuthCodeData struct {
	Code        string
	ConsentID   string
	CustomerID  string
	ClientID    string
	RedirectURI string
	PAR         *PARData
	ExpiresAt   time.Time
}

type Service struct {
	mu        sync.RWMutex
	parData   map[string]*PARData
	authCodes map[string]*AuthCodeData
	store     *store.BankStore

	// provisionClientID is the only client that may get the demo:provision scope.
	provisionClientID string
}

// Option changes how a Service is built.
type Option func(*Service)

// WithProvisionClientID sets the client allowed to get the demo:provision scope.
func WithProvisionClientID(id string) Option {
	return func(s *Service) { s.provisionClientID = id }
}

func NewService(s *store.BankStore, opts ...Option) *Service {
	svc := &Service{
		parData:   make(map[string]*PARData),
		authCodes: make(map[string]*AuthCodeData),
		store:     s,
	}
	for _, opt := range opts {
		opt(svc)
	}
	return svc
}

func randomToken(prefix string) string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%s-%s", prefix, hex.EncodeToString(b))
}

// issueConsentTokens creates an opaque access and refresh token for a consent
// and registers both. The consent id is never part of a token.
func (s *Service) issueConsentTokens(consentID, clientID string) (access, refresh string) {
	access = randomToken("at")
	refresh = randomToken("rt")
	scope := "accounts transactions"
	s.store.IssueToken(access, store.TokenRecord{Kind: store.TokenKindAccess, ConsentID: consentID, ClientID: clientID, Scope: scope, ExpiresAt: time.Now().Add(accessTokenTTL)})
	s.store.IssueToken(refresh, store.TokenRecord{Kind: store.TokenKindRefresh, ConsentID: consentID, ClientID: clientID, Scope: scope, ExpiresAt: time.Now().Add(refreshTokenTTL)})
	return access, refresh
}

// verifyPKCE validates code_verifier against code_challenge using S256
func verifyPKCE(verifier, challenge string) bool {
	h := sha256.Sum256([]byte(verifier))
	computed := base64.RawURLEncoding.EncodeToString(h[:])
	return computed == challenge
}

// validateClientAssertion parses and performs basic structural/security checks on the client assertion JWT
func validateClientAssertion(assertion, expectedClientID string) error {
	parts := strings.Split(assertion, ".")
	if len(parts) != 3 {
		return errors.New("malformed client_assertion JWT")
	}

	headerJSON, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return fmt.Errorf("invalid assertion header: %w", err)
	}

	var header struct {
		Alg string `json:"alg"`
	}
	if err := json.Unmarshal(headerJSON, &header); err != nil {
		return fmt.Errorf("failed to decode header JSON: %w", err)
	}

	// Security rule: reject insecure algorithms like 'none' or 'HS256'
	if header.Alg != "PS256" && header.Alg != "RS256" {
		return fmt.Errorf("unsupported algorithm: %s, only PS256/RS256 accepted", header.Alg)
	}

	payloadJSON, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return fmt.Errorf("invalid assertion payload: %w", err)
	}

	var payload struct {
		Iss string `json:"iss"`
		Sub string `json:"sub"`
		Exp int64  `json:"exp"`
	}
	if err := json.Unmarshal(payloadJSON, &payload); err != nil {
		return fmt.Errorf("failed to decode payload JSON: %w", err)
	}

	if expectedClientID != "" && payload.Iss != expectedClientID && payload.Sub != expectedClientID {
		return fmt.Errorf("client assertion issuer %s does not match client_id %s", payload.Iss, expectedClientID)
	}

	if payload.Exp > 0 && time.Now().Unix() > payload.Exp {
		return errors.New("client assertion expired")
	}

	return nil
}

// HandlePAR processes Pushed Authorization Requests (RFC 9126)
func (s *Service) HandlePAR(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	clientID := r.FormValue("client_id")
	assertionType := r.FormValue("client_assertion_type")
	assertion := r.FormValue("client_assertion")

	if assertionType != "" && assertion != "" {
		if err := validateClientAssertion(assertion, clientID); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error":             "invalid_client",
				"error_description": err.Error(),
			})
			return
		}
	}

	challenge := r.FormValue("code_challenge")
	method := r.FormValue("code_challenge_method")
	if challenge == "" || method != "S256" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error":             "invalid_request",
			"error_description": "code_challenge and code_challenge_method=S256 are required",
		})
		return
	}

	entity := r.FormValue("entity")
	if !validProviders[entity] {
		writeOAuthError(w, http.StatusBadRequest, "invalid_request", "entity must be one of the simulated provider ids")
		return
	}

	requestURI := fmt.Sprintf("urn:ietf:params:oauth:request_uri:%s", randomToken("par"))
	consentID := randomToken("consent")

	s.mu.Lock()
	par := &PARData{
		RequestURI:          requestURI,
		ConsentID:           consentID,
		ClientID:            clientID,
		RedirectURI:         r.FormValue("redirect_uri"),
		Scope:               r.FormValue("scope"),
		CodeChallenge:       challenge,
		CodeChallengeMethod: method,
		State:               r.FormValue("state"),
		ProviderID:          entity,
		Nonce:               r.FormValue("nonce"),
		FynkConsentID:       r.FormValue("fynk_consent_id"),
		ExpiresAt:           time.Now().Add(5 * time.Minute),
	}
	s.parData[requestURI] = par

	// The consent stays pending, with no customer, until the person authorizes.
	s.store.CreatePendingConsent(consentID, clientID, entity, strings.Fields(par.Scope), "Open Finance Data Sharing", 365)
	s.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"request_uri": requestURI,
		"expires_in":  300,
		"consent_id":  consentID,
	})
}

// LookupPAR returns a copy of the pushed request when it exists and has not expired.
func (s *Service) LookupPAR(requestURI string) (PARData, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	par, ok := s.parData[requestURI]
	if !ok || time.Now().After(par.ExpiresAt) {
		return PARData{}, false
	}
	return *par, true
}

// DropPAR forgets a pushed request, after the person decided. The consent
// stays pending and nobody can activate it any more.
func (s *Service) DropPAR(requestURI string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.parData, requestURI)
}

// CompleteAuthorization simulates user consent in browser and generates authorization code
func (s *Service) CompleteAuthorization(requestURI, customerID string) (string, string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	par, ok := s.parData[requestURI]
	if !ok || time.Now().After(par.ExpiresAt) {
		return "", "", errors.New("invalid or expired request_uri")
	}

	// Fails with store.ErrNoProductsAtEntity and leaves the consent pending.
	if err := s.store.ActivateConsent(par.ConsentID, customerID); err != nil {
		return "", "", err
	}

	code := randomToken("code")
	authCode := &AuthCodeData{
		Code:        code,
		ConsentID:   par.ConsentID,
		CustomerID:  customerID,
		ClientID:    par.ClientID,
		RedirectURI: par.RedirectURI,
		PAR:         par,
		ExpiresAt:   time.Now().Add(5 * time.Minute),
	}
	s.authCodes[code] = authCode

	redirect := fmt.Sprintf("%s?code=%s&state=%s", par.RedirectURI, code, par.State)
	return code, redirect, nil
}

// HandleToken handles OAuth 2.0 token exchanges (/oauth/token)
func (s *Service) HandleToken(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	grantType := r.FormValue("grant_type")
	clientID := r.FormValue("client_id")
	assertionType := r.FormValue("client_assertion_type")
	assertion := r.FormValue("client_assertion")

	if assertionType != "" && assertion != "" {
		if err := validateClientAssertion(assertion, clientID); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error":             "invalid_client",
				"error_description": err.Error(),
			})
			return
		}
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	switch grantType {
	case "authorization_code":
		code := r.FormValue("code")
		authData, ok := s.authCodes[code]
		if !ok || time.Now().After(authData.ExpiresAt) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error":             "invalid_grant",
				"error_description": "authorization code is invalid or expired",
			})
			return
		}

		verifier := r.FormValue("code_verifier")
		if authData.PAR != nil && authData.PAR.CodeChallenge != "" {
			if !verifyPKCE(verifier, authData.PAR.CodeChallenge) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				_ = json.NewEncoder(w).Encode(map[string]string{
					"error":             "invalid_grant",
					"error_description": "PKCE code_verifier does not match code_challenge",
				})
				return
			}
		}

		delete(s.authCodes, code)

		accessToken, refreshToken := s.issueConsentTokens(authData.ConsentID, authData.ClientID)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"access_token":  accessToken,
			"token_type":    "Bearer",
			"expires_in":    300,
			"refresh_token": refreshToken,
			"scope":         "accounts transactions",
			"consent_id":    authData.ConsentID,
		})

	case "refresh_token":
		rt := r.FormValue("refresh_token")
		if rt == "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "invalid_request",
			})
			return
		}

		rec, ok := s.store.LookupToken(rt)
		if !ok || rec.Kind != store.TokenKindRefresh {
			writeOAuthError(w, http.StatusBadRequest, "invalid_grant", "refresh token is invalid or expired")
			return
		}
		consent, err := s.store.GetConsent(rec.ConsentID)
		if err != nil || consent.Status != domain.ConsentStatusActive {
			writeOAuthError(w, http.StatusBadRequest, "invalid_grant", "the consent is not active")
			return
		}
		consentID := rec.ConsentID

		accessToken, newRefreshToken := s.issueConsentTokens(consentID, rec.ClientID)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"access_token":  accessToken,
			"token_type":    "Bearer",
			"expires_in":    300,
			"refresh_token": newRefreshToken,
			"scope":         "accounts transactions",
			"consent_id":    consentID,
		})

	case "client_credentials":
		if assertionType == "" || assertion == "" {
			writeOAuthError(w, http.StatusUnauthorized, "invalid_client", "client_assertion is required")
			return
		}
		// No scope asked for keeps the admin token that consent revocation uses.
		granted := "admin"
		if asked := strings.Fields(r.FormValue("scope")); len(asked) > 0 {
			for _, sc := range asked {
				if sc != demo.ProvisionScope {
					writeOAuthError(w, http.StatusBadRequest, "invalid_scope", "unknown scope")
					return
				}
				if s.provisionClientID == "" || clientID != s.provisionClientID {
					writeOAuthError(w, http.StatusBadRequest, "invalid_scope", "scope not allowed for this client")
					return
				}
			}
			granted = strings.Join(asked, " ")
		}
		cc := randomToken("cc")
		s.store.IssueToken(cc, store.TokenRecord{Kind: store.TokenKindClient, ClientID: clientID, Scope: granted, ExpiresAt: time.Now().Add(accessTokenTTL)})
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"access_token": cc,
			"token_type":   "Bearer",
			"expires_in":   300,
			"scope":        granted,
		})

	default:
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error": "unsupported_grant_type",
		})
	}
}

// HandleRevoke handles token or consent revocation (/oauth/revoke)
func (s *Service) HandleRevoke(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	token := r.FormValue("token")
	// RFC 7009: an unknown token is not an error and revokes nothing.
	if rec, ok := s.store.LookupToken(token); ok && rec.ConsentID != "" {
		_ = s.store.RevokeConsent(rec.ConsentID)
	}

	w.WriteHeader(http.StatusOK)
}

func (s *Service) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /oauth/par", s.HandlePAR)
	mux.HandleFunc("POST /oauth/token", s.HandleToken)
	mux.HandleFunc("POST /oauth/revoke", s.HandleRevoke)
}
