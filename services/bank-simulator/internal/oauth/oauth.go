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
	ExpiresAt           time.Time
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
}

func NewService(s *store.BankStore) *Service {
	return &Service{
		parData:   make(map[string]*PARData),
		authCodes: make(map[string]*AuthCodeData),
		store:     s,
	}
}

func randomToken(prefix string) string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%s-%s", prefix, hex.EncodeToString(b))
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
		ExpiresAt:           time.Now().Add(5 * time.Minute),
	}
	s.parData[requestURI] = par

	// Also register consent in store with demo customer
	s.store.CreateConsent(consentID, "cliente.demo@bancodemo.local", clientID, strings.Split(par.Scope, " "), "Open Finance Data Sharing", 365)
	s.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"request_uri": requestURI,
		"expires_in":  300,
		"consent_id":  consentID,
	})
}

// CompleteAuthorization simulates user consent in browser and generates authorization code
func (s *Service) CompleteAuthorization(requestURI, customerID string) (string, string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	par, ok := s.parData[requestURI]
	if !ok || time.Now().After(par.ExpiresAt) {
		return "", "", errors.New("invalid or expired request_uri")
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

		accessToken := fmt.Sprintf("at-%s-%s", authData.ConsentID, randomToken("tok"))
		refreshToken := fmt.Sprintf("rt-%s-%s", authData.ConsentID, randomToken("tok"))

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

		parts := strings.Split(rt, "-")
		consentID := "consent-demo-001"
		if len(parts) >= 2 {
			consentID = parts[1]
		}

		accessToken := fmt.Sprintf("at-%s-%s", consentID, randomToken("tok"))
		newRefreshToken := fmt.Sprintf("rt-%s-%s", consentID, randomToken("tok"))

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
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"access_token": randomToken("cc-token"),
			"token_type":   "Bearer",
			"expires_in":   300,
			"scope":        "admin",
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
	if token != "" {
		// Extract consent ID if present in token string
		parts := strings.Split(token, "-")
		if len(parts) >= 3 && parts[0] == "at" {
			_ = s.store.RevokeConsent(parts[1])
		} else if strings.HasPrefix(token, "consent-") {
			_ = s.store.RevokeConsent(token)
		} else {
			_ = s.store.RevokeConsent("consent-demo-001")
		}
	}

	w.WriteHeader(http.StatusOK)
}

func (s *Service) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /oauth/par", s.HandlePAR)
	mux.HandleFunc("POST /oauth/token", s.HandleToken)
	mux.HandleFunc("POST /oauth/revoke", s.HandleRevoke)
}
