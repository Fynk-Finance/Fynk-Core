package audit

import (
	"encoding/json"
	"net/http"
)

// VerifyHandler returns an HTTP handler for GET /internal/audit/verify.
func VerifyHandler(s *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		res, err := s.Verify(r.Context())
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		if err != nil || !res.Valid {
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(res)
			return
		}
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(res)
	}
}
