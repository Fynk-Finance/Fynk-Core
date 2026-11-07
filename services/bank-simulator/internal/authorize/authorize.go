// Package authorize is the authorization page of the simulated bank. It sits on
// the public listener: the person logs in at the banco-demo realm (with the bank's
// own user or "Ingresar con Fynk"), sees what Fynk asks for, and accepts or declines.
//
// Nothing here logs a token, a code, a subject, an email or an amount.
package authorize

import (
	"context"
	"crypto/subtle"
	"errors"
	"html/template"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/demo"
	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/domain"
	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/oauth"
	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/oidc"
	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/store"
)

const (
	sessionCookie = "bank_session"
	loginCookie   = "bank_login"
	cookiePath    = "/oauth"
	sessionTTL    = 30 * time.Minute
	loginTTL      = 10 * time.Minute

	authorizePath = "/oauth/authorize"
	callbackPath  = "/oauth/authorize/callback"
	decisionPath  = "/oauth/authorize/decision"
)

// Config is the banco-demo OIDC client. With no Issuer or no ClientSecret the
// page answers 503 and the rest of the simulator works as before.
type Config struct {
	PublicURL      string
	Issuer         string
	BackchannelURL string
	ClientID       string
	ClientSecret   string

	Logger     *slog.Logger
	HTTPClient *http.Client
	Now        func() time.Time
}

type session struct {
	customerID string
	csrf       string
	expires    time.Time
}

type login struct {
	requestURI string
	clientID   string
	nonce      string
	verifier   string
	expires    time.Time
}

type Handler struct {
	svc   *oauth.Service
	store *store.BankStore
	oidc  *oidc.Client // nil when not configured
	log   *slog.Logger
	now   func() time.Time
	tmpl  *template.Template

	mu       sync.Mutex
	sessions map[string]*session
	logins   map[string]*login
}

func NewHandler(svc *oauth.Service, st *store.BankStore, cfg Config) *Handler {
	h := &Handler{
		svc: svc, store: st, log: cfg.Logger, now: cfg.Now,
		tmpl:     template.Must(template.New("authorize").Parse(pageTemplates)),
		sessions: map[string]*session{},
		logins:   map[string]*login{},
	}
	if h.log == nil {
		h.log = slog.New(slog.NewTextHandler(io.Discard, nil))
	}
	if h.now == nil {
		h.now = time.Now
	}
	if cfg.Issuer != "" && cfg.ClientSecret != "" {
		h.oidc = oidc.New(oidc.Config{
			Issuer: cfg.Issuer, BackchannelURL: cfg.BackchannelURL,
			ClientID: cfg.ClientID, ClientSecret: cfg.ClientSecret,
			RedirectURL: strings.TrimRight(cfg.PublicURL, "/") + callbackPath,
			HTTPClient:  cfg.HTTPClient, Now: cfg.Now,
		})
	}
	return h
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET "+authorizePath, h.Authorize)
	mux.HandleFunc("GET "+callbackPath, h.Callback)
	mux.HandleFunc("POST "+decisionPath, h.Decision)
}

type page struct {
	Title       string
	Message     string
	Entity      string
	DataLabels  []string
	Term        int
	RequestURI  string
	ClientID    string
	CSRF        string
	Receiver    string
	Purpose     string
	NoProducts  bool
	ConsentForm bool
}

func (h *Handler) render(w http.ResponseWriter, status int, name string, p page) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = h.tmpl.ExecuteTemplate(w, name, p)
}

func (h *Handler) fail(w http.ResponseWriter, status int, message string) {
	h.render(w, status, "message", page{Title: "No se pudo continuar", Message: message})
}

// Authorize shows the consent page, or sends the person to log in first.
func (h *Handler) Authorize(w http.ResponseWriter, r *http.Request) {
	if h.oidc == nil {
		h.fail(w, http.StatusServiceUnavailable, "El inicio de sesión del banco simulado no está configurado.")
		return
	}
	par, ok := h.pushedRequest(r.URL.Query().Get("request_uri"), r.URL.Query().Get("client_id"))
	if !ok {
		h.fail(w, http.StatusBadRequest, "La solicitud de autorización no existe o ya venció. Vuelve a Fynk e inténtalo de nuevo.")
		return
	}
	sess := h.currentSession(r)
	if sess == nil {
		h.startLogin(w, r, par)
		return
	}

	entity := domain.EntityDisplayName(par.ProviderID)
	if !hasProducts(h.store.GetCustomer(sess.customerID), par.ProviderID) {
		h.render(w, http.StatusOK, "noProducts", page{
			Title: "Sin productos", Entity: entity, RequestURI: par.RequestURI, ClientID: par.ClientID, CSRF: sess.csrf,
		})
		return
	}
	termDays := 365
	if c, err := h.store.GetConsent(par.ConsentID); err == nil && c.TermDays > 0 {
		termDays = c.TermDays
	}
	h.render(w, http.StatusOK, "consent", page{
		Title: "Autorizar a Fynk", Entity: entity, DataLabels: dataLabels(par.Scope), Term: termDays,
		Receiver: "Fynk", Purpose: "Mostrarte tus saldos y movimientos dentro de Fynk para ayudarte a ahorrar y entender tu dinero.",
		RequestURI: par.RequestURI, ClientID: par.ClientID, CSRF: sess.csrf,
	})
}

func (h *Handler) pushedRequest(requestURI, clientID string) (oauth.PARData, bool) {
	par, ok := h.svc.LookupPAR(requestURI)
	if !ok || par.ClientID != clientID || par.RedirectURI == "" {
		return oauth.PARData{}, false
	}
	return par, true
}

func (h *Handler) startLogin(w http.ResponseWriter, r *http.Request, par oauth.PARData) {
	state, nonce, verifier := oidc.RandomString(), oidc.RandomString(), oidc.RandomString()
	h.mu.Lock()
	h.sweepLocked()
	h.logins[state] = &login{requestURI: par.RequestURI, clientID: par.ClientID, nonce: nonce, verifier: verifier, expires: h.now().Add(loginTTL)}
	h.mu.Unlock()
	h.setCookie(w, r, loginCookie, state, loginTTL)
	http.Redirect(w, r, h.oidc.AuthURL(state, nonce, verifier), http.StatusFound)
}

// Callback finishes the realm login and returns to the authorization page.
func (h *Handler) Callback(w http.ResponseWriter, r *http.Request) {
	if h.oidc == nil {
		h.fail(w, http.StatusServiceUnavailable, "El inicio de sesión del banco simulado no está configurado.")
		return
	}
	state := r.URL.Query().Get("state")
	cookie, err := r.Cookie(loginCookie)
	h.mu.Lock()
	l, ok := h.logins[state]
	delete(h.logins, state)
	h.mu.Unlock()
	h.clearCookie(w, r, loginCookie)
	if !ok || err != nil || cookie.Value != state || h.now().After(l.expires) {
		h.fail(w, http.StatusBadRequest, "El inicio de sesión venció. Vuelve a Fynk e inténtalo de nuevo.")
		return
	}
	code := r.URL.Query().Get("code")
	if code == "" {
		h.fail(w, http.StatusBadRequest, "No se completó el inicio de sesión. Vuelve a Fynk e inténtalo de nuevo.")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	raw, err := h.oidc.Exchange(ctx, code, l.verifier)
	if err != nil {
		h.log.Warn("authorize: login code exchange failed")
		h.fail(w, http.StatusBadGateway, "No pudimos validar tu inicio de sesión. Inténtalo de nuevo.")
		return
	}
	claims, err := h.oidc.VerifyIDToken(ctx, raw, l.nonce)
	if err != nil {
		h.log.Warn("authorize: id token rejected")
		h.fail(w, http.StatusBadGateway, "No pudimos validar tu inicio de sesión. Inténtalo de nuevo.")
		return
	}
	customerID, ok := customerFor(claims)
	if !ok {
		h.log.Warn("authorize: id token carries no usable customer id")
		h.fail(w, http.StatusBadRequest, "No pudimos identificar tu cuenta del banco simulado.")
		return
	}
	sid, csrf := oidc.RandomString(), oidc.RandomString()
	h.mu.Lock()
	h.sessions[sid] = &session{customerID: customerID, csrf: csrf, expires: h.now().Add(sessionTTL)}
	h.mu.Unlock()
	h.setCookie(w, r, sessionCookie, sid, sessionTTL)
	back := url.Values{"request_uri": {l.requestURI}, "client_id": {l.clientID}}
	http.Redirect(w, r, authorizePath+"?"+back.Encode(), http.StatusSeeOther)
}

// customerFor picks the customer id from the ID token: the Fynk sub for brokered
// users, the seeded demo customer for its username, the realm sub otherwise.
func customerFor(c oidc.Claims) (string, bool) {
	id := c.Subject
	switch {
	case c.FynkSub != "":
		id = c.FynkSub
	case c.PreferredUsername == domain.DemoCustomerID:
		id = domain.DemoCustomerID
	}
	return id, demo.ValidCustomerRef(id)
}

// Decision handles "Autorizar" and "Cancelar" (and "Volver a Fynk").
func (h *Handler) Decision(w http.ResponseWriter, r *http.Request) {
	if h.oidc == nil {
		h.fail(w, http.StatusServiceUnavailable, "El inicio de sesión del banco simulado no está configurado.")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4<<10)
	if err := r.ParseForm(); err != nil {
		h.fail(w, http.StatusBadRequest, "Solicitud no válida.")
		return
	}
	par, ok := h.pushedRequest(r.PostFormValue("request_uri"), r.PostFormValue("client_id"))
	if !ok {
		h.fail(w, http.StatusBadRequest, "La solicitud de autorización no existe o ya venció. Vuelve a Fynk e inténtalo de nuevo.")
		return
	}
	sess := h.currentSession(r)
	if sess == nil || subtle.ConstantTimeCompare([]byte(sess.csrf), []byte(r.PostFormValue("csrf"))) != 1 {
		h.fail(w, http.StatusForbidden, "La sesión no es válida. Abre de nuevo la autorización desde Fynk.")
		return
	}

	if r.PostFormValue("decision") != "authorize" {
		h.svc.DropPAR(par.RequestURI)
		http.Redirect(w, r, returnURL(par.RedirectURI, url.Values{"error": {"access_denied"}, "state": {par.State}}), http.StatusSeeOther)
		return
	}
	code, _, err := h.svc.CompleteAuthorization(par.RequestURI, sess.customerID)
	if err != nil {
		if errors.Is(err, store.ErrNoProductsAtEntity) {
			h.render(w, http.StatusOK, "noProducts", page{
				Title: "Sin productos", Entity: domain.EntityDisplayName(par.ProviderID),
				RequestURI: par.RequestURI, ClientID: par.ClientID, CSRF: sess.csrf,
			})
			return
		}
		h.fail(w, http.StatusBadRequest, "No se pudo autorizar la solicitud. Vuelve a Fynk e inténtalo de nuevo.")
		return
	}
	h.svc.DropPAR(par.RequestURI)
	http.Redirect(w, r, returnURL(par.RedirectURI, url.Values{"code": {code}, "state": {par.State}}), http.StatusSeeOther)
}

func returnURL(redirectURI string, extra url.Values) string {
	u, err := url.Parse(redirectURI)
	if err != nil {
		return redirectURI
	}
	q := u.Query()
	for k, v := range extra {
		q[k] = v
	}
	u.RawQuery = q.Encode()
	return u.String()
}

func hasProducts(data *domain.CustomerData, providerID string) bool {
	for _, e := range domain.EntitySummaries(data) {
		if e.ProviderID == providerID {
			return true
		}
	}
	return false
}

// dataLabels turns the PAR scopes into what the person is told Fynk will read.
func dataLabels(scope string) []string {
	labels := map[string]string{"accounts": "Saldos y cuentas", "transactions": "Movimientos"}
	var out []string
	for _, s := range strings.Fields(scope) {
		if l, ok := labels[s]; ok {
			out = append(out, l)
		}
	}
	if len(out) == 0 {
		out = []string{labels["accounts"], labels["transactions"]}
	}
	return out
}

func (h *Handler) currentSession(r *http.Request) *session {
	c, err := r.Cookie(sessionCookie)
	if err != nil {
		return nil
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	s, ok := h.sessions[c.Value]
	if !ok || h.now().After(s.expires) {
		delete(h.sessions, c.Value)
		return nil
	}
	return s
}

func (h *Handler) sweepLocked() {
	now := h.now()
	for k, s := range h.sessions {
		if now.After(s.expires) {
			delete(h.sessions, k)
		}
	}
	for k, l := range h.logins {
		if now.After(l.expires) {
			delete(h.logins, k)
		}
	}
}

func secure(r *http.Request) bool {
	return r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https"
}

func (h *Handler) setCookie(w http.ResponseWriter, r *http.Request, name, value string, ttl time.Duration) {
	http.SetCookie(w, &http.Cookie{
		Name: name, Value: value, Path: cookiePath, MaxAge: int(ttl.Seconds()),
		HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: secure(r),
	})
}

func (h *Handler) clearCookie(w http.ResponseWriter, r *http.Request, name string) {
	http.SetCookie(w, &http.Cookie{
		Name: name, Value: "", Path: cookiePath, MaxAge: -1,
		HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: secure(r),
	})
}
