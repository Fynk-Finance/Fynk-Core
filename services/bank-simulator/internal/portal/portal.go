package portal

import (
	"fmt"
	"html/template"
	"net/http"
	"strconv"
	"strings"

	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/domain"
	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/store"
)

type Handler struct {
	store *store.BankStore
	tmpl  *template.Template
}

func NewHandler(s *store.BankStore) *Handler {
	tmpl := template.Must(template.New("portal").Funcs(template.FuncMap{
		"formatMoney": func(minor int64) string {
			return domain.MinorToDecimal(minor, false)
		},
		"formatSignedMoney": func(minor int64) string {
			return domain.MinorToDecimal(minor, true)
		},
		"formatDate": func(t any) string {
			return fmt.Sprintf("%v", t)
		},
	}).Parse(portalTemplates))

	return &Handler{
		store: s,
		tmpl:  tmpl,
	}
}

func (h *Handler) currentCustomerID(r *http.Request) string {
	// Keycloak or dev fallback
	if c := r.URL.Query().Get("user"); c != "" {
		return c
	}
	return "cliente.demo@bancodemo.local"
}

func (h *Handler) Dashboard(w http.ResponseWriter, r *http.Request) {
	customerID := h.currentCustomerID(r)
	custData := h.store.GetCustomer(customerID)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = h.tmpl.ExecuteTemplate(w, "dashboard", map[string]any{
		"Customer":      custData,
		"Accounts":      custData.Accounts,
		"Transactions":  custData.Transactions,
		"Subscriptions": custData.Subscriptions,
		"CdtProducts":   custData.CdtProducts,
		"ActiveTab":     "resumen",
		"Notice":        r.URL.Query().Get("notice"),
		"Error":         r.URL.Query().Get("error"),
	})
}

func (h *Handler) AccountDetails(w http.ResponseWriter, r *http.Request) {
	customerID := h.currentCustomerID(r)
	accID := r.URL.Query().Get("id")
	custData := h.store.GetCustomer(customerID)

	var targetAcc *domain.Account
	for i := range custData.Accounts {
		if custData.Accounts[i].ID == accID {
			targetAcc = &custData.Accounts[i]
			break
		}
	}
	if targetAcc == nil {
		http.Redirect(w, r, "/portal?error=Cuenta+no+encontrada", http.StatusSeeOther)
		return
	}

	var accTxs []domain.Transaction
	for _, tx := range custData.Transactions {
		if tx.AccountID == accID {
			accTxs = append(accTxs, tx)
		}
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = h.tmpl.ExecuteTemplate(w, "account", map[string]any{
		"Customer":     custData,
		"Account":      targetAcc,
		"Transactions": accTxs,
		"ActiveTab":    "resumen",
	})
}

func (h *Handler) ActionsPage(w http.ResponseWriter, r *http.Request) {
	customerID := h.currentCustomerID(r)
	custData := h.store.GetCustomer(customerID)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = h.tmpl.ExecuteTemplate(w, "actions", map[string]any{
		"Customer":    custData,
		"Accounts":    custData.Accounts,
		"CdtProducts": custData.CdtProducts,
		"ActiveTab":   "acciones",
		"Notice":      r.URL.Query().Get("notice"),
		"Error":       r.URL.Query().Get("error"),
	})
}

func (h *Handler) SubscriptionsPage(w http.ResponseWriter, r *http.Request) {
	customerID := h.currentCustomerID(r)
	custData := h.store.GetCustomer(customerID)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = h.tmpl.ExecuteTemplate(w, "subscriptions", map[string]any{
		"Customer":      custData,
		"Accounts":      custData.Accounts,
		"Subscriptions": custData.Subscriptions,
		"ActiveTab":     "suscripciones",
		"Notice":        r.URL.Query().Get("notice"),
		"Error":         r.URL.Query().Get("error"),
	})
}

func (h *Handler) ConsentsPage(w http.ResponseWriter, r *http.Request) {
	customerID := h.currentCustomerID(r)
	consents := h.store.GetCustomerConsents(customerID)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = h.tmpl.ExecuteTemplate(w, "consents", map[string]any{
		"Consents":  consents,
		"ActiveTab": "consentimientos",
		"Notice":    r.URL.Query().Get("notice"),
		"Error":     r.URL.Query().Get("error"),
	})
}

func (h *Handler) AdminPage(w http.ResponseWriter, r *http.Request) {
	customerID := h.currentCustomerID(r)
	custData := h.store.GetCustomer(customerID)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = h.tmpl.ExecuteTemplate(w, "admin", map[string]any{
		"Customer":  custData,
		"ActiveTab": "admin",
		"Notice":    r.URL.Query().Get("notice"),
		"Error":     r.URL.Query().Get("error"),
	})
}

// ---------------- Action Handlers ----------------

func (h *Handler) PostPayment(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/portal/actions?error=Error+en+el+formulario", http.StatusSeeOther)
		return
	}
	customerID := h.currentCustomerID(r)
	accountID := r.FormValue("account_id")
	merchant := r.FormValue("merchant")
	category := r.FormValue("category")
	amountStr := r.FormValue("amount")

	amountMinor, err := parseMoneyInput(amountStr)
	if err != nil {
		http.Redirect(w, r, "/portal/actions?error=Monto+invalido", http.StatusSeeOther)
		return
	}

	tx, err := h.store.RecordPayment(customerID, accountID, merchant, category, amountMinor)
	if err != nil {
		http.Redirect(w, r, fmt.Sprintf("/portal/actions?error=%s", urlQueryEscape(err.Error())), http.StatusSeeOther)
		return
	}

	http.Redirect(w, r, fmt.Sprintf("/portal/actions?notice=Pago+registrado+exitosamente+con+id+%s", tx.ID), http.StatusSeeOther)
}

func (h *Handler) PostReceive(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/portal/actions?error=Error+en+el+formulario", http.StatusSeeOther)
		return
	}
	customerID := h.currentCustomerID(r)
	accountID := r.FormValue("account_id")
	desc := r.FormValue("description")
	amountStr := r.FormValue("amount")

	amountMinor, err := parseMoneyInput(amountStr)
	if err != nil {
		http.Redirect(w, r, "/portal/actions?error=Monto+invalido", http.StatusSeeOther)
		return
	}

	_, err = h.store.ReceiveMoney(customerID, accountID, desc, amountMinor)
	if err != nil {
		http.Redirect(w, r, fmt.Sprintf("/portal/actions?error=%s", urlQueryEscape(err.Error())), http.StatusSeeOther)
		return
	}

	http.Redirect(w, r, "/portal/actions?notice=Dinero+recibido+exitosamente", http.StatusSeeOther)
}

func (h *Handler) PostTransfer(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/portal/actions?error=Error+en+el+formulario", http.StatusSeeOther)
		return
	}
	customerID := h.currentCustomerID(r)
	fromAcc := r.FormValue("from_account")
	toAcc := r.FormValue("to_account")
	amountStr := r.FormValue("amount")

	if fromAcc == toAcc {
		http.Redirect(w, r, "/portal/actions?error=Las+cuentas+deben+ser+distintas", http.StatusSeeOther)
		return
	}

	amountMinor, err := parseMoneyInput(amountStr)
	if err != nil {
		http.Redirect(w, r, "/portal/actions?error=Monto+invalido", http.StatusSeeOther)
		return
	}

	err = h.store.TransferOwn(customerID, fromAcc, toAcc, amountMinor)
	if err != nil {
		http.Redirect(w, r, fmt.Sprintf("/portal/actions?error=%s", urlQueryEscape(err.Error())), http.StatusSeeOther)
		return
	}

	http.Redirect(w, r, "/portal/actions?notice=Transferencia+realizada+con+exito", http.StatusSeeOther)
}

func (h *Handler) PostPayCard(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/portal/actions?error=Error+en+el+formulario", http.StatusSeeOther)
		return
	}
	customerID := h.currentCustomerID(r)
	fromAcc := r.FormValue("from_account")
	cardAcc := r.FormValue("card_account")
	amountStr := r.FormValue("amount")

	amountMinor, err := parseMoneyInput(amountStr)
	if err != nil {
		http.Redirect(w, r, "/portal/actions?error=Monto+invalido", http.StatusSeeOther)
		return
	}

	err = h.store.PayCard(customerID, fromAcc, cardAcc, amountMinor)
	if err != nil {
		http.Redirect(w, r, fmt.Sprintf("/portal/actions?error=%s", urlQueryEscape(err.Error())), http.StatusSeeOther)
		return
	}

	http.Redirect(w, r, "/portal/actions?notice=Tarjeta+pagada+con+exito", http.StatusSeeOther)
}

func (h *Handler) PostOpenCDT(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/portal/actions?error=Error+en+el+formulario", http.StatusSeeOther)
		return
	}
	customerID := h.currentCustomerID(r)
	fromAcc := r.FormValue("from_account")
	productID := r.FormValue("product_id")
	amountStr := r.FormValue("amount")

	amountMinor, err := parseMoneyInput(amountStr)
	if err != nil {
		http.Redirect(w, r, "/portal/actions?error=Monto+invalido", http.StatusSeeOther)
		return
	}

	err = h.store.OpenCDT(customerID, fromAcc, productID, amountMinor)
	if err != nil {
		http.Redirect(w, r, fmt.Sprintf("/portal/actions?error=%s", urlQueryEscape(err.Error())), http.StatusSeeOther)
		return
	}

	http.Redirect(w, r, "/portal/actions?notice=CDT+aperturado+con+exito", http.StatusSeeOther)
}

func (h *Handler) PostCancelCDT(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/portal/actions?error=Error+en+el+formulario", http.StatusSeeOther)
		return
	}
	customerID := h.currentCustomerID(r)
	cdtAcc := r.FormValue("cdt_account")
	toAcc := r.FormValue("to_account")

	err := h.store.CancelCDT(customerID, cdtAcc, toAcc)
	if err != nil {
		http.Redirect(w, r, fmt.Sprintf("/portal/actions?error=%s", urlQueryEscape(err.Error())), http.StatusSeeOther)
		return
	}

	http.Redirect(w, r, "/portal/actions?notice=CDT+cancelado+y+fondos+reintegrados", http.StatusSeeOther)
}

// ---------------- Subscription Actions ----------------

func (h *Handler) PostNewSubscription(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/portal/subscriptions?error=Error+en+el+formulario", http.StatusSeeOther)
		return
	}
	customerID := h.currentCustomerID(r)
	accID := r.FormValue("account_id")
	merchant := r.FormValue("merchant")
	periodicity := r.FormValue("periodicity")
	day, _ := strconv.Atoi(r.FormValue("day"))
	amountMinor, err := parseMoneyInput(r.FormValue("amount"))
	if err != nil {
		http.Redirect(w, r, "/portal/subscriptions?error=Monto+invalido", http.StatusSeeOther)
		return
	}

	_, err = h.store.AddSubscription(customerID, accID, merchant, amountMinor, periodicity, day)
	if err != nil {
		http.Redirect(w, r, fmt.Sprintf("/portal/subscriptions?error=%s", urlQueryEscape(err.Error())), http.StatusSeeOther)
		return
	}

	http.Redirect(w, r, "/portal/subscriptions?notice=Suscripcion+creada+con+exito", http.StatusSeeOther)
}

func (h *Handler) PostChangePrice(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/portal/subscriptions?error=Error", http.StatusSeeOther)
		return
	}
	customerID := h.currentCustomerID(r)
	subID := r.FormValue("sub_id")
	newPriceMinor, err := parseMoneyInput(r.FormValue("new_amount"))
	if err != nil {
		http.Redirect(w, r, "/portal/subscriptions?error=Monto+invalido", http.StatusSeeOther)
		return
	}

	err = h.store.UpdateSubscriptionPrice(customerID, subID, newPriceMinor)
	if err != nil {
		http.Redirect(w, r, fmt.Sprintf("/portal/subscriptions?error=%s", urlQueryEscape(err.Error())), http.StatusSeeOther)
		return
	}

	http.Redirect(w, r, "/portal/subscriptions?notice=Precio+de+suscripcion+actualizado", http.StatusSeeOther)
}

func (h *Handler) PostChargeNow(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/portal/subscriptions?error=Error", http.StatusSeeOther)
		return
	}
	customerID := h.currentCustomerID(r)
	subID := r.FormValue("sub_id")

	tx, err := h.store.ChargeSubscriptionNow(customerID, subID)
	if err != nil {
		http.Redirect(w, r, fmt.Sprintf("/portal/subscriptions?error=%s", urlQueryEscape(err.Error())), http.StatusSeeOther)
		return
	}

	http.Redirect(w, r, fmt.Sprintf("/portal/subscriptions?notice=Cargo+aplicado+inmediatamente+(ID:+%s)", tx.ID), http.StatusSeeOther)
}

func (h *Handler) PostCancelSubscription(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/portal/subscriptions?error=Error", http.StatusSeeOther)
		return
	}
	customerID := h.currentCustomerID(r)
	subID := r.FormValue("sub_id")

	err := h.store.CancelSubscription(customerID, subID)
	if err != nil {
		http.Redirect(w, r, fmt.Sprintf("/portal/subscriptions?error=%s", urlQueryEscape(err.Error())), http.StatusSeeOther)
		return
	}

	http.Redirect(w, r, "/portal/subscriptions?notice=Suscripcion+cancelada", http.StatusSeeOther)
}

func (h *Handler) PostRevokeConsent(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/portal/consents?error=Error", http.StatusSeeOther)
		return
	}
	consentID := r.FormValue("consent_id")

	err := h.store.RevokeConsent(consentID)
	if err != nil {
		http.Redirect(w, r, fmt.Sprintf("/portal/consents?error=%s", urlQueryEscape(err.Error())), http.StatusSeeOther)
		return
	}

	http.Redirect(w, r, "/portal/consents?notice=Consentimiento+revocado+con+exito", http.StatusSeeOther)
}

func (h *Handler) PostAdminReset(w http.ResponseWriter, r *http.Request) {
	customerID := h.currentCustomerID(r)
	h.store.ResetCustomer(customerID)
	http.Redirect(w, r, "/portal/admin?notice=Datos+del+cliente+restablecidos+a+la+semilla+inicial", http.StatusSeeOther)
}

func (h *Handler) PostAdminAdvanceTime(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/portal/admin?error=Error", http.StatusSeeOther)
		return
	}
	customerID := h.currentCustomerID(r)
	days, _ := strconv.Atoi(r.FormValue("days"))
	if days <= 0 {
		days = 1
	}
	h.store.AdvanceTime(customerID, days)
	http.Redirect(w, r, fmt.Sprintf("/portal/admin?notice=Tiempo+adelantado+en+%d+dias", days), http.StatusSeeOther)
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /portal", h.Dashboard)
	mux.HandleFunc("GET /portal/account", h.AccountDetails)
	mux.HandleFunc("GET /portal/actions", h.ActionsPage)
	mux.HandleFunc("GET /portal/subscriptions", h.SubscriptionsPage)
	mux.HandleFunc("GET /portal/consents", h.ConsentsPage)
	mux.HandleFunc("GET /portal/admin", h.AdminPage)

	mux.HandleFunc("POST /portal/actions/pay", h.PostPayment)
	mux.HandleFunc("POST /portal/actions/receive", h.PostReceive)
	mux.HandleFunc("POST /portal/actions/transfer", h.PostTransfer)
	mux.HandleFunc("POST /portal/actions/pay-card", h.PostPayCard)
	mux.HandleFunc("POST /portal/actions/open-cdt", h.PostOpenCDT)
	mux.HandleFunc("POST /portal/actions/cancel-cdt", h.PostCancelCDT)

	mux.HandleFunc("POST /portal/subscriptions/new", h.PostNewSubscription)
	mux.HandleFunc("POST /portal/subscriptions/change-price", h.PostChangePrice)
	mux.HandleFunc("POST /portal/subscriptions/charge-now", h.PostChargeNow)
	mux.HandleFunc("POST /portal/subscriptions/cancel", h.PostCancelSubscription)

	mux.HandleFunc("POST /portal/consents/revoke", h.PostRevokeConsent)
	mux.HandleFunc("POST /portal/admin/reset", h.PostAdminReset)
	mux.HandleFunc("POST /portal/admin/advance-time", h.PostAdminAdvanceTime)
}

func parseMoneyInput(s string) (int64, error) {
	cleaned := strings.ReplaceAll(s, "$", "")
	cleaned = strings.ReplaceAll(cleaned, ".", "")
	cleaned = strings.ReplaceAll(cleaned, ",", ".")
	cleaned = strings.TrimSpace(cleaned)

	var major int64
	var minor int64 = 0

	parts := strings.Split(cleaned, ".")
	if len(parts) > 0 {
		val, err := strconv.ParseInt(parts[0], 10, 64)
		if err != nil {
			return 0, err
		}
		major = val
	}
	if len(parts) > 1 {
		decStr := parts[1]
		if len(decStr) > 2 {
			decStr = decStr[:2]
		} else if len(decStr) == 1 {
			decStr += "0"
		}
		decVal, err := strconv.ParseInt(decStr, 10, 64)
		if err == nil {
			minor = decVal
		}
	}
	return (major * 100) + minor, nil
}

func urlQueryEscape(s string) string {
	return strings.ReplaceAll(s, " ", "+")
}
