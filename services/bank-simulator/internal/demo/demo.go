// Package demo holds the demo-only endpoints. They exist only in the simulator,
// never in a real bank. The handler never logs the customerRef, the token or the body.
package demo

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/domain"
	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/store"
)

// ProvisionScope is the scope a client token needs to create demo customers.
const ProvisionScope = "demo:provision"

const maxBodyBytes = 4 << 10

// A Keycloak sub is a UUID. The pattern also keeps emails out.
var customerRefPattern = regexp.MustCompile(`^[A-Za-z0-9._:-]{1,128}$`)

type Handler struct {
	store *store.BankStore
}

func NewHandler(s *store.BankStore) *Handler {
	return &Handler{store: s}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /demo/v1/customers", h.ProvisionCustomer)
}

type entityJSON struct {
	ProviderID   string `json:"providerId"`
	DisplayName  string `json:"displayName"`
	Kind         string `json:"kind"`
	AccountCount int    `json:"accountCount"`
}

func writeProblem(w http.ResponseWriter, r *http.Request, status int, code, title, detail string) {
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"type":     fmt.Sprintf("https://bancodemo.fynk.local/errors/%s", code),
		"title":    title,
		"status":   status,
		"detail":   detail,
		"code":     code,
		"instance": r.URL.Path,
	})
}

// ProvisionCustomer creates the customer for a Fynk sub when missing and lists
// the entities where it has accounts. The same call gives the same answer.
func (h *Handler) ProvisionCustomer(w http.ResponseWriter, r *http.Request) {
	// Only the mTLS listener has a client certificate. The public one answers 404.
	if r.TLS == nil || len(r.TLS.PeerCertificates) == 0 {
		writeProblem(w, r, http.StatusNotFound, "not_found", "Not Found", "Resource not found.")
		return
	}

	token := bearerToken(r)
	rec, ok := h.store.LookupToken(token)
	if !ok || rec.Kind != store.TokenKindClient {
		writeProblem(w, r, http.StatusUnauthorized, "unauthorized", "Unauthorized", "Missing, invalid or expired client token.")
		return
	}
	if !hasScope(rec.Scope, ProvisionScope) {
		writeProblem(w, r, http.StatusForbidden, "insufficient_scope", "Forbidden", "The token lacks the demo:provision scope.")
		return
	}

	var body struct {
		CustomerRef string `json:"customerRef"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeProblem(w, r, http.StatusBadRequest, "invalid_request", "Bad Request", "The body must be JSON with a customerRef.")
		return
	}
	// The seeded demo user is the one email-shaped id the simulator knows.
	if body.CustomerRef != domain.DemoCustomerID && !customerRefPattern.MatchString(body.CustomerRef) {
		writeProblem(w, r, http.StatusBadRequest, "invalid_customer_ref", "Bad Request", "customerRef is not a valid opaque id.")
		return
	}

	summaries := domain.EntitySummaries(h.store.GetCustomer(body.CustomerRef))
	entities := make([]entityJSON, 0, len(summaries))
	for _, e := range summaries {
		entities = append(entities, entityJSON{e.ProviderID, e.DisplayName, string(e.Kind), e.AccountCount})
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"entities": entities})
}

func bearerToken(r *http.Request) string {
	parts := strings.SplitN(r.Header.Get("Authorization"), " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

func hasScope(granted, want string) bool {
	for _, s := range strings.Fields(granted) {
		if s == want {
			return true
		}
	}
	return false
}
