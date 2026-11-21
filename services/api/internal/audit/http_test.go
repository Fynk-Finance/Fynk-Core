package audit

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

type mockVerifier struct {
	res VerificationResult
	err error
}

func (m mockVerifier) Verify(context.Context) (VerificationResult, error) {
	return m.res, m.err
}

func TestVerifyHandler(t *testing.T) {
	handler := func(v mockVerifier) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			res, err := v.Verify(r.Context())
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

	t.Run("valid chain returns 200", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/internal/audit/verify", nil)
		rec := httptest.NewRecorder()

		h := handler(mockVerifier{
			res: VerificationResult{Valid: true, Count: 42, HeadHash: "abcdef123456"},
		})
		h.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}
		var body VerificationResult
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatalf("unmarshal response: %v", err)
		}
		if !body.Valid || body.Count != 42 || body.HeadHash != "abcdef123456" {
			t.Fatalf("unexpected body: %+v", body)
		}
	})

	t.Run("broken chain returns 500", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/internal/audit/verify", nil)
		rec := httptest.NewRecorder()

		h := handler(mockVerifier{
			res: VerificationResult{Valid: false, BrokenAtID: 7, Reason: "hash mismatch"},
		})
		h.ServeHTTP(rec, req)

		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("expected 500, got %d", rec.Code)
		}
		var body VerificationResult
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatalf("unmarshal response: %v", err)
		}
		if body.Valid || body.BrokenAtID != 7 {
			t.Fatalf("unexpected body: %+v", body)
		}
	})
}
