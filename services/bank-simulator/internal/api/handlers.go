package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/store"
)

type ProblemDetails struct {
	Type     string `json:"type"`
	Title    string `json:"title"`
	Status   int    `json:"status"`
	Detail   string `json:"detail"`
	Code     string `json:"code,omitempty"`
	Instance string `json:"instance,omitempty"`
}

func writeProblem(w http.ResponseWriter, r *http.Request, status int, code, title, detail string) {
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(ProblemDetails{
		Type:     fmt.Sprintf("https://bancodemo.fynk.local/errors/%s", code),
		Title:    title,
		Status:   status,
		Detail:   detail,
		Code:     code,
		Instance: r.URL.Path,
	})
}

type Handler struct {
	store *store.BankStore
}

func NewHandler(s *store.BankStore) *Handler {
	return &Handler{store: s}
}

func (h *Handler) extractConsentID(r *http.Request) (string, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return "", errors.New("missing Authorization header")
	}

	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return "", errors.New("invalid Authorization header format")
	}

	token := strings.TrimSpace(parts[1])
	if token == "" {
		return "", errors.New("empty bearer token")
	}

	// Dev and test convenience tokens map to the seeded demo consent.
	if token == "dev-token" || token == "test-token" {
		return "consent-demo-001", nil
	}
	rec, ok := h.store.LookupToken(token)
	if !ok || rec.Kind != store.TokenKindAccess || rec.ConsentID == "" {
		return "", errors.New("invalid or expired access token")
	}
	return rec.ConsentID, nil
}

func (h *Handler) checkRateLimit(w http.ResponseWriter, r *http.Request, consentID string) bool {
	allowed, retryAfter := h.store.CheckRateLimit(consentID, time.Now())
	if !allowed {
		w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
		writeProblem(w, r, http.StatusTooManyRequests, "rate_limit_exceeded", "Too Many Requests", "Rate limit exceeded (max 60 requests per minute).")
		return false
	}
	return true
}

func (h *Handler) GetAccounts(w http.ResponseWriter, r *http.Request) {
	consentID, err := h.extractConsentID(r)
	if err != nil {
		writeProblem(w, r, http.StatusUnauthorized, "unauthorized", "Unauthorized", err.Error())
		return
	}

	if !h.checkRateLimit(w, r, consentID) {
		return
	}

	accounts, err := h.store.GetAccounts(consentID)
	if err != nil {
		if errors.Is(err, store.ErrConsentRevoked) {
			writeProblem(w, r, http.StatusForbidden, "consent_revoked", "Consent Revoked", "The consent for this account access has been revoked.")
			return
		}
		if errors.Is(err, store.ErrConsentNotAuthorized) {
			writeProblem(w, r, http.StatusForbidden, "consent_not_authorized", "Consent Not Authorized", "The consent has not been authorized yet.")
			return
		}
		if errors.Is(err, store.ErrConsentNotFound) {
			writeProblem(w, r, http.StatusNotFound, "consent_not_found", "Consent Not Found", "Specified consent does not exist.")
			return
		}
		writeProblem(w, r, http.StatusInternalServerError, "internal_error", "Internal Server Error", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"data": accounts,
	})
}

func (h *Handler) GetTransactions(w http.ResponseWriter, r *http.Request) {
	consentID, err := h.extractConsentID(r)
	if err != nil {
		writeProblem(w, r, http.StatusUnauthorized, "unauthorized", "Unauthorized", err.Error())
		return
	}

	if !h.checkRateLimit(w, r, consentID) {
		return
	}

	accountID := r.PathValue("id")
	if accountID == "" {
		writeProblem(w, r, http.StatusBadRequest, "invalid_account_id", "Bad Request", "Missing account id.")
		return
	}

	q := r.URL.Query()
	var fromDate time.Time
	if fromStr := q.Get("fromBookingDate"); fromStr != "" {
		if t, err := time.Parse(time.RFC3339, fromStr); err == nil {
			fromDate = t
		} else if t, err := time.Parse("2006-01-02", fromStr); err == nil {
			fromDate = t
		}
	}

	cursor := q.Get("cursor")
	pageSize := 50
	if sizeStr := q.Get("pageSize"); sizeStr != "" {
		if parsed, err := strconv.Atoi(sizeStr); err == nil && parsed > 0 {
			pageSize = parsed
		}
	}

	txs, hasMore, nextCursor, err := h.store.GetTransactions(consentID, accountID, fromDate, cursor, pageSize)
	if err != nil {
		if errors.Is(err, store.ErrConsentRevoked) {
			writeProblem(w, r, http.StatusForbidden, "consent_revoked", "Consent Revoked", "The consent for this account access has been revoked.")
			return
		}
		if errors.Is(err, store.ErrConsentNotAuthorized) {
			writeProblem(w, r, http.StatusForbidden, "consent_not_authorized", "Consent Not Authorized", "The consent has not been authorized yet.")
			return
		}
		if errors.Is(err, store.ErrAccountNotInConsent) {
			writeProblem(w, r, http.StatusForbidden, "account_not_in_consent", "Forbidden", "The account is not covered by this consent.")
			return
		}
		if errors.Is(err, store.ErrAccountNotFound) {
			writeProblem(w, r, http.StatusNotFound, "account_not_found", "Account Not Found", "Account not found for this consent.")
			return
		}
		writeProblem(w, r, http.StatusInternalServerError, "internal_error", "Internal Server Error", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"data": txs,
		"meta": map[string]any{
			"hasMore":    hasMore,
			"nextCursor": nextCursor,
		},
	})
}

func (h *Handler) RevokeConsent(w http.ResponseWriter, r *http.Request) {
	consentID := r.PathValue("id")
	if consentID == "" {
		writeProblem(w, r, http.StatusBadRequest, "invalid_consent_id", "Bad Request", "Missing consent id.")
		return
	}
	switch h.revokeAccess(r, consentID) {
	case http.StatusUnauthorized:
		writeProblem(w, r, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Missing, invalid or expired token.")
		return
	case http.StatusForbidden:
		writeProblem(w, r, http.StatusForbidden, "forbidden", "Forbidden", "This token cannot revoke the consent.")
		return
	}

	err := h.store.RevokeConsent(consentID)
	if err != nil {
		if errors.Is(err, store.ErrConsentNotFound) {
			writeProblem(w, r, http.StatusNotFound, "consent_not_found", "Not Found", "Consent not found.")
			return
		}
		writeProblem(w, r, http.StatusInternalServerError, "internal_error", "Internal Error", err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// revokeAccess tells if the bearer token may revoke the consent: a client token
// (Fynk's revoke path), the consent's own access token, or a dev token for the
// demo consent. It returns 401 for a missing or unknown token and 403 otherwise.
func (h *Handler) revokeAccess(r *http.Request, consentID string) int {
	parts := strings.SplitN(r.Header.Get("Authorization"), " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return http.StatusUnauthorized
	}
	token := strings.TrimSpace(parts[1])
	if token == "dev-token" || token == "test-token" {
		if consentID == "consent-demo-001" {
			return http.StatusOK
		}
		return http.StatusForbidden
	}
	rec, ok := h.store.LookupToken(token)
	switch {
	case !ok:
		return http.StatusUnauthorized
	case rec.Kind == store.TokenKindClient, rec.Kind == store.TokenKindAccess && rec.ConsentID == consentID:
		return http.StatusOK
	default:
		return http.StatusForbidden
	}
}

func (h *Handler) GetCdtProducts(w http.ResponseWriter, _ *http.Request) {
	products := h.store.GetCdtProducts()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"data": products,
	})
}

// RegisterRoutes registers the Open Finance API routes on a http.ServeMux.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /open-finance/v1/accounts", h.GetAccounts)
	mux.HandleFunc("GET /open-finance/v1/accounts/{id}/transactions", h.GetTransactions)
	mux.HandleFunc("DELETE /open-finance/v1/consents/{id}", h.RevokeConsent)
	mux.HandleFunc("GET /open-finance/v1/products/cdt", h.GetCdtProducts)
}
