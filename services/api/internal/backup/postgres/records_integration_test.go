//go:build integration

package postgres_test

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
)

type recordsAPI struct {
	t               *testing.T
	h               http.Handler
	active, pending string
}

// newRecordsAPI mounts the real identity and backup modules and registers an active and a
// pending device for the dev user.
func newRecordsAPI(t *testing.T) (*recordsAPI, *recAudit, module.Deps) {
	pool := setup(t)
	auth.Install(auth.DevVerifier{Env: config.EnvLocal})
	t.Cleanup(func() { auth.Install(nil) })
	rec := &recAudit{}
	d := module.Deps{DB: pool, Clock: clock.System{}, Audit: rec}
	r := chi.NewRouter()
	r.Route("/v1", func(r chi.Router) { identity.New(d).Routes(r); backup.New(d).Routes(r) })
	a := &recordsAPI{t: t, h: r}
	reg := func(b byte) string {
		pk := base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{b}, 32))
		w := a.call("POST", "/v1/devices", `{"name":"Phone","platform":"android","publicKey":"`+pk+`"}`, "")
		var dev struct{ ID string }
		_ = json.Unmarshal(w.Body.Bytes(), &dev)
		if w.Code != 201 {
			t.Fatalf("register: %d %s", w.Code, w.Body)
		}
		return dev.ID
	}
	a.active, a.pending = reg(1), reg(2)
	return a, rec, d
}

func (a *recordsAPI) call(method, path, body, deviceID string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+auth.DevToken)
	req.Header.Set("Content-Type", "application/json")
	if deviceID != "" {
		req.Header.Set("X-Device-Id", deviceID)
	}
	w := httptest.NewRecorder()
	a.h.ServeHTTP(w, req)
	return w
}

func envelope(id string, version int, nonce, ct []byte) map[string]any {
	return map[string]any{"collection": "savings.goals", "recordId": id, "version": version, "deleted": false,
		"nonce": base64.StdEncoding.EncodeToString(nonce), "ciphertext": base64.StdEncoding.EncodeToString(ct)}
}

func (a *recordsAPI) put(device string, envs ...map[string]any) *httptest.ResponseRecorder {
	b, _ := json.Marshal(map[string]any{"records": envs})
	return a.call("PUT", "/v1/backup/records", string(b), device)
}

func uid(n int) string { return fmt.Sprintf("00000000-0000-4000-8000-%012d", n) }

type page struct {
	Records []struct {
		RecordID string `json:"recordId"`
		Version  int    `json:"version"`
	} `json:"records"`
	NextCursor *string `json:"nextCursor"`
}

func (a *recordsAPI) get(device, query string) (page, *httptest.ResponseRecorder) {
	w := a.call("GET", "/v1/backup/records"+query, "", device)
	var p page
	if w.Code == 200 {
		_ = json.Unmarshal(w.Body.Bytes(), &p)
	}
	return p, w
}

func TestStoredRecordNeverContainsPlaintext(t *testing.T) {
	a, rec, d := newRecordsAPI(t)
	plaintext := []byte(`{"name":"Viaje a Cartagena","target":1250000000,"note":"PLAINTEXT-MARKER-4f9a"}`)
	key := make([]byte, 32)
	nonce := make([]byte, 12)
	_, _ = rand.Read(key)
	_, _ = rand.Read(nonce)
	blk, _ := aes.NewCipher(key)
	gcm, _ := cipher.NewGCM(blk)
	sealed := gcm.Seal(nil, nonce, plaintext, nil)

	if w := a.put(a.active, envelope(uid(1), 1, nonce, sealed)); w.Code != 200 {
		t.Fatalf("PUT: %d %s", w.Code, w.Body)
	}
	ctx := t.Context()
	var asText string
	var gotNonce, gotCT []byte
	err := d.DB.QueryRow(ctx, `SELECT t::text, nonce, ciphertext FROM backup.records t`).Scan(&asText, &gotNonce, &gotCT)
	if err != nil {
		t.Fatal(err)
	}
	for name, hay := range map[string][]byte{"row text": []byte(asText), "nonce": gotNonce, "ciphertext": gotCT} {
		for _, needle := range [][]byte{plaintext, []byte("PLAINTEXT-MARKER"), []byte("Cartagena"), []byte(hex.EncodeToString(plaintext[:16]))} {
			if bytes.Contains(hay, needle) {
				t.Fatalf("%s contains the plaintext", name)
			}
		}
	}
	if !bytes.Equal(gotCT, sealed) {
		t.Fatal("the server changed the ciphertext")
	}
	// What comes back through the API decrypts to the same plaintext.
	p, w := a.get(a.active, "")
	if w.Code != 200 || len(p.Records) != 1 {
		t.Fatalf("GET: %d %s", w.Code, w.Body)
	}
	var back struct{ Records []struct{ Nonce, Ciphertext string } }
	_ = json.Unmarshal(w.Body.Bytes(), &back)
	n, _ := base64.StdEncoding.DecodeString(back.Records[0].Nonce)
	c, _ := base64.StdEncoding.DecodeString(back.Records[0].Ciphertext)
	if got, err := gcm.Open(nil, n, c, nil); err != nil || !bytes.Equal(got, plaintext) {
		t.Fatalf("round trip failed: %v", err)
	}
	if len(rec.types) != 3 || rec.types[2] != "backup.uploaded" {
		t.Fatalf("audit %v", rec.types)
	}
}

func TestPendingDeviceCannotReadOrWriteRecords(t *testing.T) {
	a, _, _ := newRecordsAPI(t)
	ct := bytes.Repeat([]byte{9}, 32)
	nonce := bytes.Repeat([]byte{1}, 12)
	if w := a.put(a.active, envelope(uid(1), 1, nonce, ct)); w.Code != 200 {
		t.Fatalf("active PUT: %d %s", w.Code, w.Body)
	}
	if w := a.put(a.pending, envelope(uid(2), 1, nonce, ct)); w.Code != 403 || !strings.Contains(w.Body.String(), "device_not_active") {
		t.Fatalf("pending PUT: %d %s", w.Code, w.Body)
	}
	_, w := a.get(a.pending, "")
	if w.Code != 403 || strings.Contains(w.Body.String(), base64.StdEncoding.EncodeToString(ct)) {
		t.Fatalf("pending GET: %d %s", w.Code, w.Body)
	}
	if w := a.call("GET", "/v1/backup/records", "", "11111111-1111-4111-8111-111111111111"); w.Code != 403 {
		t.Fatalf("unknown device GET: %d", w.Code)
	}
	if p, _ := a.get(a.active, ""); len(p.Records) != 1 {
		t.Fatalf("pending PUT stored something: %+v", p)
	}
}

func TestRecordsPagingAcrossUpdates(t *testing.T) {
	a, _, _ := newRecordsAPI(t)
	ct, nonce := bytes.Repeat([]byte{9}, 32), bytes.Repeat([]byte{1}, 12)
	for i := 1; i <= 5; i++ {
		if w := a.put(a.active, envelope(uid(i), 1, nonce, ct)); w.Code != 200 {
			t.Fatalf("PUT %d: %d %s", i, w.Code, w.Body)
		}
	}
	var seen []string
	p, w := a.get(a.active, "?limit=2")
	if w.Code != 200 || len(p.Records) != 2 || p.NextCursor == nil {
		t.Fatalf("page 1: %d %s", w.Code, w.Body)
	}
	if strings.Contains(*p.NextCursor, "=") || strings.ContainsAny(*p.NextCursor, "+/") {
		t.Fatalf("cursor is not base64url without padding: %s", *p.NextCursor)
	}
	// Record 1 changes after page 1 was read: it must come back later.
	if w := a.put(a.active, envelope(uid(1), 2, nonce, ct)); w.Code != 200 {
		t.Fatalf("update: %d %s", w.Code, w.Body)
	}
	pages := 1
	for {
		for _, r := range p.Records {
			seen = append(seen, fmt.Sprintf("%s:%d", r.RecordID[len(r.RecordID)-1:], r.Version))
		}
		if p.NextCursor == nil {
			break
		}
		p, w = a.get(a.active, "?limit=2&updatedAfter="+*p.NextCursor)
		if w.Code != 200 {
			t.Fatalf("page %d: %d %s", pages+1, w.Code, w.Body)
		}
		pages++
	}
	if got, want := strings.Join(seen, " "), "1:1 2:1 3:1 4:1 5:1 1:2"; got != want {
		t.Fatalf("pages gave %q, want %q (%d pages)", got, want, pages)
	}
	if _, w := a.get(a.active, "?updatedAfter=not-a-cursor!"); w.Code != 400 || !strings.Contains(w.Body.String(), "invalid_request") {
		t.Fatalf("bad cursor: %d %s", w.Code, w.Body)
	}
}

func TestStaleVersionAndQuotaOnRealRows(t *testing.T) {
	a, rec, d := newRecordsAPI(t)
	nonce := bytes.Repeat([]byte{1}, 12)
	small := bytes.Repeat([]byte{7}, 32)
	count := func() (n int) {
		_ = d.DB.QueryRow(t.Context(), `SELECT count(*) FROM backup.records`).Scan(&n)
		return n
	}
	if w := a.put(a.active, envelope(uid(1), 5, nonce, small)); w.Code != 200 {
		t.Fatalf("PUT: %d %s", w.Code, w.Body)
	}
	// An equal version is an idempotent retry.
	if w := a.put(a.active, envelope(uid(1), 5, nonce, small)); w.Code != 200 {
		t.Fatalf("retry: %d %s", w.Code, w.Body)
	}
	w := a.put(a.active, envelope(uid(2), 1, nonce, small), envelope(uid(1), 4, nonce, small))
	if w.Code != 409 || !strings.Contains(w.Body.String(), "stale_version") || count() != 1 {
		t.Fatalf("stale: %d %s rows=%d", w.Code, w.Body, count())
	}
	if w := a.put(a.active, envelope(uid(3), 1, nonce, small), envelope(uid(3), 2, nonce, small)); w.Code != 400 {
		t.Fatalf("duplicate in batch: %d %s", w.Code, w.Body)
	}

	// 79 full-size records fit in 5 MiB, the 80th does not.
	big := bytes.Repeat([]byte{3}, 65536)
	for start := 10; start < 10+79; start += 40 {
		var envs []map[string]any
		for i := start; i < start+40 && i < 10+79; i++ {
			envs = append(envs, envelope(uid(i), 1, nonce, big))
		}
		if w := a.put(a.active, envs...); w.Code != 200 {
			t.Fatalf("fill at %d: %d %.200s", start, w.Code, w.Body)
		}
	}
	before := count()
	w = a.put(a.active, envelope(uid(500), 1, nonce, big), envelope(uid(501), 1, nonce, small))
	if w.Code != 413 || !strings.Contains(w.Body.String(), "quota_exceeded") || count() != before {
		t.Fatalf("quota: %d %.200s rows %d -> %d", w.Code, w.Body, before, count())
	}
	// Shrinking a record by a new version frees quota and the same batch then fits.
	if w := a.put(a.active, envelope(uid(10), 2, nonce, small)); w.Code != 200 {
		t.Fatalf("shrink: %d %.200s", w.Code, w.Body)
	}
	if w := a.put(a.active, envelope(uid(500), 1, nonce, big)); w.Code != 200 {
		t.Fatalf("after shrink: %d %.200s", w.Code, w.Body)
	}
	for _, typ := range rec.types[2:] {
		if typ != "backup.uploaded" {
			t.Fatalf("unexpected audit %v", rec.types)
		}
	}
}
