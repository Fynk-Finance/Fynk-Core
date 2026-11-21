//go:build integration

package postgres_test

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/migrations"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/db"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/migrate"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
)

type deviceJSON struct {
	ID      string `json:"id"`
	Status  string `json:"status"`
	Current bool   `json:"current"`
}

// TestDevicesOverHTTP mounts the real identity module over a real pool and walks the flow of
// the linked devices.
func TestDevicesOverHTTP(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL is not set")
	}
	ctx := context.Background()
	sqldb, err := sql.Open("pgx", dbURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = sqldb.Close() })
	reset := func() { _, _ = sqldb.ExecContext(ctx, "DROP SCHEMA IF EXISTS identity CASCADE") }
	reset()
	t.Cleanup(reset)
	if _, err := migrate.Up(ctx, dbURL, migrate.Source{Schema: "identity", FS: migrations.FS}); err != nil {
		t.Fatal(err)
	}
	pool, err := db.Open(ctx, dbURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)

	auth.Install(auth.DevVerifier{Env: config.EnvLocal})
	t.Cleanup(func() { auth.Install(nil) })
	m := identity.New(module.Deps{DB: pool, Clock: clock.System{}, Audit: nopAudit{}})
	r := chi.NewRouter()
	r.Route("/v1", m.Routes)

	call := func(method, path, body, deviceID string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+auth.DevToken)
		req.Header.Set("Content-Type", "application/json")
		if deviceID != "" {
			req.Header.Set("X-Device-Id", deviceID)
		}
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		return rec
	}
	register := func(name string, keyByte byte, want int) deviceJSON {
		t.Helper()
		k := base64.StdEncoding.EncodeToString(key(keyByte))
		rec := call("POST", "/v1/devices", `{"name":"`+name+`","platform":"android","publicKey":"`+k+`"}`, "")
		if rec.Code != want {
			t.Fatalf("register %s: status %d: %s", name, rec.Code, rec.Body)
		}
		var d deviceJSON
		_ = json.Unmarshal(rec.Body.Bytes(), &d)
		return d
	}

	first := register("Pixel de Camila", 1, http.StatusCreated)
	if first.Status != "active" {
		t.Fatalf("first device %+v", first)
	}
	if again := register("Pixel de Camila", 1, http.StatusOK); again.ID != first.ID {
		t.Fatalf("same key gave another device: %+v", again)
	}
	second := register("Tablet de Camila", 2, http.StatusCreated)
	if second.Status != "pending" {
		t.Fatalf("second device %+v", second)
	}

	rec := call("GET", "/v1/devices", "", first.ID)
	var list struct {
		Items []deviceJSON `json:"items"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &list)
	if rec.Code != 200 || len(list.Items) != 2 {
		t.Fatalf("list: %d %s", rec.Code, rec.Body)
	}
	for _, d := range list.Items {
		if d.Current != (d.ID == first.ID) {
			t.Fatalf("current flag wrong: %+v", d)
		}
	}

	if rec := call("GET", "/v1/devices/current", "", first.ID); rec.Code != 200 || !strings.Contains(rec.Body.String(), `"current":true`) {
		t.Fatalf("current: %d %s", rec.Code, rec.Body)
	}
	// A pending device cannot remove another one, nor a request without a device.
	if rec := call("DELETE", "/v1/devices/"+first.ID, "", second.ID); rec.Code != 403 || !strings.Contains(rec.Body.String(), "device_not_active") {
		t.Fatalf("pending removes active: %d %s", rec.Code, rec.Body)
	}
	if rec := call("POST", "/v1/devices/sign-out-others", "", second.ID); rec.Code != 403 {
		t.Fatalf("pending signs out others: %d %s", rec.Code, rec.Body)
	}
	if rec := call("DELETE", "/v1/devices/"+second.ID, "", ""); rec.Code != 403 {
		t.Fatalf("remove without a device: %d %s", rec.Code, rec.Body)
	}
	if rec := call("DELETE", "/v1/devices/"+second.ID, "", first.ID); rec.Code != 204 {
		t.Fatalf("remove: %d %s", rec.Code, rec.Body)
	}
	if rec := call("GET", "/v1/devices/current", "", second.ID); rec.Code != 410 || !strings.Contains(rec.Body.String(), "device_removed") {
		t.Fatalf("removed current: %d %s", rec.Code, rec.Body)
	}
	if rec := call("DELETE", "/v1/devices/3f8b2a54-6a1e-4c58-9d3b-7a1f0c2e9b11", "", first.ID); rec.Code != 404 {
		t.Fatalf("unknown device: %d", rec.Code)
	}
	// A removed key cannot come back.
	k := base64.StdEncoding.EncodeToString(key(2))
	if rec := call("POST", "/v1/devices", `{"name":"Tablet","platform":"ios","publicKey":"`+k+`"}`, ""); rec.Code != 409 {
		t.Fatalf("removed key: %d %s", rec.Code, rec.Body)
	}

	third := register("Celular nuevo", 3, http.StatusCreated)
	// A pending device may always remove itself (sign out); a fourth one checks it.
	fourth := register("Celular de prueba", 4, http.StatusCreated)
	if rec := call("DELETE", "/v1/devices/"+fourth.ID, "", fourth.ID); rec.Code != 204 {
		t.Fatalf("pending removes itself: %d %s", rec.Code, rec.Body)
	}
	if rec := call("POST", "/v1/devices/sign-out-others", "", first.ID); rec.Code != 204 {
		t.Fatalf("sign out others: %d %s", rec.Code, rec.Body)
	}
	if rec := call("GET", "/v1/devices/current", "", third.ID); rec.Code != 410 {
		t.Fatalf("third after sign out: %d", rec.Code)
	}
	if rec := call("GET", "/v1/devices/current", "", first.ID); rec.Code != 200 {
		t.Fatalf("first after sign out: %d", rec.Code)
	}
	rec = call("GET", "/v1/devices", "", first.ID)
	list.Items = nil
	_ = json.Unmarshal(rec.Body.Bytes(), &list)
	if len(list.Items) != 1 || list.Items[0].ID != first.ID {
		t.Fatalf("final list: %s", rec.Body)
	}
}
