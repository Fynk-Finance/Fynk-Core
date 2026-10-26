// Package problem writes RFC 9457 error responses (application/problem+json).
// Every API error carries a stable machine-readable code such as consent_revoked.
package problem

import (
	"encoding/json"
	"net/http"
)

// ContentType is the media type of every error response.
const ContentType = "application/problem+json"

// Problem is an RFC 9457 problem details object plus Fynk's stable code.
type Problem struct {
	Type     string `json:"type"`
	Title    string `json:"title"`
	Status   int    `json:"status"`
	Detail   string `json:"detail,omitempty"`
	Instance string `json:"instance,omitempty"`
	Code     string `json:"code"`
}

// New builds a problem whose type is derived from the code: /problems/<code>.
func New(status int, code, title, detail string) Problem {
	return Problem{Type: "/problems/" + code, Title: title, Status: status, Detail: detail, Code: code}
}

// Write sends p as the response. Detail must never contain personal data.
func Write(w http.ResponseWriter, p Problem) {
	w.Header().Set("Content-Type", ContentType)
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(p.Status)
	_ = json.NewEncoder(w).Encode(p)
}

// NotImplemented answers 501 for routes whose module has not landed yet.
func NotImplemented(w http.ResponseWriter, _ *http.Request) {
	Write(w, New(http.StatusNotImplemented, "not_implemented", "Not implemented",
		"This endpoint is not implemented yet."))
}

// Unauthorized answers 401 when the access token is missing or invalid.
func Unauthorized(w http.ResponseWriter, _ *http.Request) {
	Write(w, New(http.StatusUnauthorized, "unauthorized", "Unauthorized",
		"A valid access token is required."))
}

// NotFound answers 404 for unknown routes.
func NotFound(w http.ResponseWriter, _ *http.Request) {
	Write(w, New(http.StatusNotFound, "not_found", "Not found", "The requested resource does not exist."))
}

// MethodNotAllowed answers 405.
func MethodNotAllowed(w http.ResponseWriter, _ *http.Request) {
	Write(w, New(http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed", ""))
}
