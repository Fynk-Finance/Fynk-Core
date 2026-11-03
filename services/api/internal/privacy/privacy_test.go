package privacy_test

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	identity "github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/privacy"
	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/privacy/http"
)

var quiet = slog.New(slog.NewJSONHandler(io.Discard, nil))

type fakeProfileReader struct {
	user identity.UserProfile
	err  error
}

func (f fakeProfileReader) GetUser(ctx context.Context, userID string) (identity.UserProfile, error) {
	if f.err != nil {
		return identity.UserProfile{}, f.err
	}
	return f.user, nil
}

type fakeSessions struct {
	start time.Time
	found bool
	err   error
}

func (f fakeSessions) SessionStart(ctx context.Context, userID, sid string) (time.Time, bool, error) {
	return f.start, f.found, f.err
}

type memAuditRecorder struct {
	events []audit.Event
}

func (m *memAuditRecorder) Record(_ context.Context, e audit.Event) error {
	m.events = append(m.events, e)
	return nil
}

type fakeConsentsRevoker struct {
	revokedUsers []string
}

func (f *fakeConsentsRevoker) RevokeAll(_ context.Context, userID string) error {
	f.revokedUsers = append(f.revokedUsers, userID)
	return nil
}

type fakeUserDeleter struct {
	deletedUsers []string
}

func (f *fakeUserDeleter) DeleteUser(_ context.Context, userID string) error {
	f.deletedUsers = append(f.deletedUsers, userID)
	return nil
}

func TestCurrentPolicyValidity(t *testing.T) {
	p := privacy.CurrentPolicy()

	if p.Version != "2026-11-v1" {
		t.Errorf("version = %q, want 2026-11-v1", p.Version)
	}
	if p.DataController != "Fynk Finance S.A.S." {
		t.Errorf("dataController = %q, want Fynk Finance S.A.S.", p.DataController)
	}
	if p.ContactEmail != "privacidad@fynk.com.co" {
		t.Errorf("contactEmail = %q, want privacidad@fynk.com.co", p.ContactEmail)
	}
	if p.QueryResponseDays != 10 {
		t.Errorf("queryResponseDays = %d, want 10", p.QueryResponseDays)
	}
	if p.ClaimResponseDays != 15 {
		t.Errorf("claimResponseDays = %d, want 15", p.ClaimResponseDays)
	}

	// Verify SHA-256 matches bodyMd
	expectedHash := sha256.Sum256([]byte(p.BodyMd))
	expectedHex := hex.EncodeToString(expectedHash[:])
	if p.Sha256 != expectedHex {
		t.Errorf("sha256 = %q, want %q", p.Sha256, expectedHex)
	}

	// Verify required legal sections per Ley 1581 and M13 requirements
	requiredPhrases := []string{
		"Fynk Finance S.A.S.",
		"Ley 1581 de 2012",
		"Decreto 1377 de 2013",
		"Gestión de finanzas personales",
		"Recomendaciones informativas",
		"Seguridad y prevención del fraude",
		"Superintendencia Financiera de Colombia",
		"Circular Externa 004 de 2024",
		"Superintendencia de Industria y Comercio",
		"SIC",
		"bóveda cifrada de tu teléfono",
		"diez (10) días hábiles",
		"quince (15) días hábiles",
		"privacidad@fynk.com.co",
	}

	for _, phrase := range requiredPhrases {
		if !strings.Contains(p.BodyMd, phrase) {
			t.Errorf("policy markdown missing required phrase: %q", phrase)
		}
	}
}

func TestCollectorExportFallback(t *testing.T) {
	now := time.Date(2026, 11, 1, 12, 0, 0, 0, time.UTC)
	clk := clock.NewFixed(now)

	profileUser := identity.UserProfile{
		Email:         "juan@example.com",
		FirstName:     "Juan",
		LastName:      "Contreras",
		EmailVerified: true,
		CreatedAt:     now.Add(-24 * time.Hour),
	}

	collector := privacy.NewCollector(nil, fakeProfileReader{user: profileUser}, clk)
	export, err := collector.Export(context.Background(), "user-123")
	if err != nil {
		t.Fatalf("export failed: %v", err)
	}

	if export.ExportedAt != now {
		t.Errorf("exportedAt = %v, want %v", export.ExportedAt, now)
	}
	if export.Profile.Id != "user-123" {
		t.Errorf("profile.id = %q, want user-123", export.Profile.Id)
	}
	if string(export.Profile.Email) != "juan@example.com" {
		t.Errorf("profile.email = %q, want juan@example.com", export.Profile.Email)
	}
	if export.Profile.FirstName == nil || *export.Profile.FirstName != "Juan" {
		t.Errorf("profile.firstName = %v, want Juan", export.Profile.FirstName)
	}
	if export.Profile.LastName == nil || *export.Profile.LastName != "Contreras" {
		t.Errorf("profile.lastName = %v, want Contreras", export.Profile.LastName)
	}
	if !export.Profile.EmailVerified {
		t.Errorf("profile.emailVerified = false, want true")
	}

	if export.Devices == nil || len(export.Devices) != 0 {
		t.Errorf("devices = %v, want empty non-nil slice", export.Devices)
	}
	if export.Consents == nil || len(export.Consents) != 0 {
		t.Errorf("consents = %v, want empty non-nil slice", export.Consents)
	}
	if export.BankLinks == nil || len(export.BankLinks) != 0 {
		t.Errorf("bankLinks = %v, want empty non-nil slice", export.BankLinks)
	}
	if export.AuditEvents == nil || len(export.AuditEvents) != 0 {
		t.Errorf("auditEvents = %v, want empty non-nil slice", export.AuditEvents)
	}
}

func TestDeletionMessage(t *testing.T) {
	dt := time.Date(2026, 11, 1, 14, 30, 0, 0, time.UTC)
	msg := privacy.DeletionMessage(dt)
	want := "Tu cuenta y tus datos fueron eliminados el 1 de noviembre de 2026."
	if msg != want {
		t.Errorf("message = %q, want %q", msg, want)
	}
}

func setupTestRouter(t *testing.T) *httptest.Server {
	t.Helper()
	auth.Install(auth.DevVerifier{Env: config.EnvLocal})
	t.Cleanup(func() { auth.Install(nil) })

	d := module.Deps{
		Clock: clock.System{},
		Log:   quiet,
		Config: config.Config{
			AppEnv: config.EnvLocal,
		},
	}

	mod := privacy.New(d)
	r := chi.NewRouter()
	r.Route("/v1", func(v1 chi.Router) {
		mod.Routes(v1)
	})

	srv := httptest.NewServer(r)
	t.Cleanup(srv.Close)
	return srv
}

func TestPrivacyHTTPRoutes(t *testing.T) {
	srv := setupTestRouter(t)

	// 1. GET /v1/privacy/health is public
	res, err := http.Get(srv.URL + "/v1/privacy/health")
	if err != nil {
		t.Fatalf("GET /privacy/health: %v", err)
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode != http.StatusOK {
		t.Errorf("health status = %d, want 200", res.StatusCode)
	}

	// 2. GET /v1/privacy/policy is public (no Authorization header required)
	resPolicy, err := http.Get(srv.URL + "/v1/privacy/policy")
	if err != nil {
		t.Fatalf("GET /privacy/policy: %v", err)
	}
	defer func() { _ = resPolicy.Body.Close() }()
	if resPolicy.StatusCode != http.StatusOK {
		t.Fatalf("policy status = %d, want 200", resPolicy.StatusCode)
	}
	var policy httpapi.PrivacyPolicy
	if err := json.NewDecoder(resPolicy.Body).Decode(&policy); err != nil {
		t.Fatalf("decode policy json: %v", err)
	}
	if policy.Version != "2026-11-v1" {
		t.Errorf("policy.version = %q, want 2026-11-v1", policy.Version)
	}

	// 3. GET /v1/privacy/my-data without token returns 401
	resMyDataNoAuth, err := http.Get(srv.URL + "/v1/privacy/my-data")
	if err != nil {
		t.Fatalf("GET /privacy/my-data: %v", err)
	}
	defer func() { _ = resMyDataNoAuth.Body.Close() }()
	if resMyDataNoAuth.StatusCode != http.StatusUnauthorized {
		t.Errorf("my-data unauthenticated status = %d, want 401", resMyDataNoAuth.StatusCode)
	}

	// 4. GET /v1/privacy/my-data with valid token returns 200
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/v1/privacy/my-data", nil)
	req.Header.Set("Authorization", "Bearer "+auth.DevToken)
	resMyData, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET /privacy/my-data with token: %v", err)
	}
	defer func() { _ = resMyData.Body.Close() }()
	if resMyData.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resMyData.Body)
		t.Fatalf("my-data authenticated status = %d, want 200, body: %s", resMyData.StatusCode, body)
	}
	var export httpapi.PrivacyDataExport
	if err := json.NewDecoder(resMyData.Body).Decode(&export); err != nil {
		t.Fatalf("decode export json: %v", err)
	}
	if export.Profile.Id != "dev-user" {
		t.Errorf("export profile id = %q, want dev-user", export.Profile.Id)
	}

	// 5. POST /v1/privacy/deletion-requests without token returns 401
	reqDelNoAuth, _ := http.NewRequest(http.MethodPost, srv.URL+"/v1/privacy/deletion-requests", nil)
	resDelNoAuth, err := http.DefaultClient.Do(reqDelNoAuth)
	if err != nil {
		t.Fatalf("POST /privacy/deletion-requests without token: %v", err)
	}
	defer func() { _ = resDelNoAuth.Body.Close() }()
	if resDelNoAuth.StatusCode != http.StatusUnauthorized {
		t.Errorf("deletion without auth status = %d, want 401", resDelNoAuth.StatusCode)
	}

	// 6. POST /v1/privacy/deletion-requests with invalid confirmation returns 400
	badBody := []byte(`{"confirmation": "CANCELAR"}`)
	reqBad, _ := http.NewRequest(http.MethodPost, srv.URL+"/v1/privacy/deletion-requests", bytes.NewReader(badBody))
	reqBad.Header.Set("Authorization", "Bearer "+auth.DevToken)
	reqBad.Header.Set("Content-Type", "application/json")
	resBad, err := http.DefaultClient.Do(reqBad)
	if err != nil {
		t.Fatalf("POST /privacy/deletion-requests invalid confirmation: %v", err)
	}
	defer func() { _ = resBad.Body.Close() }()
	if resBad.StatusCode != http.StatusBadRequest {
		t.Errorf("deletion bad confirmation status = %d, want 400", resBad.StatusCode)
	}

	// 7. POST /v1/privacy/deletion-requests with valid confirmation returns 202
	goodBody := []byte(`{"confirmation": "ELIMINAR", "reason": "No longer using service"}`)
	reqGood, _ := http.NewRequest(http.MethodPost, srv.URL+"/v1/privacy/deletion-requests", bytes.NewReader(goodBody))
	reqGood.Header.Set("Authorization", "Bearer "+auth.DevToken)
	reqGood.Header.Set("Content-Type", "application/json")
	resGood, err := http.DefaultClient.Do(reqGood)
	if err != nil {
		t.Fatalf("POST /privacy/deletion-requests valid: %v", err)
	}
	defer func() { _ = resGood.Body.Close() }()
	if resGood.StatusCode != http.StatusAccepted {
		body, _ := io.ReadAll(resGood.Body)
		t.Fatalf("deletion status = %d, want 202, body: %s", resGood.StatusCode, body)
	}
	var delResp httpapi.PrivacyDeletionRequest
	if err := json.NewDecoder(resGood.Body).Decode(&delResp); err != nil {
		t.Fatalf("decode deletion response: %v", err)
	}
	if delResp.Status != httpapi.Completed {
		t.Errorf("status = %q, want completed", delResp.Status)
	}
	if !strings.Contains(delResp.Message, "Tu cuenta y tus datos fueron eliminados") {
		t.Errorf("message = %q, want containing deletion statement", delResp.Message)
	}

	// 8. GET /v1/privacy/deletion-requests/{id} is public (no token needed)
	unknownUUID := uuid.New().String()
	resGetPub, err := http.Get(srv.URL + "/v1/privacy/deletion-requests/" + unknownUUID)
	if err != nil {
		t.Fatalf("GET /privacy/deletion-requests/{id}: %v", err)
	}
	defer func() { _ = resGetPub.Body.Close() }()
	// For pool == nil fallback, returns 404 (not 401!)
	if resGetPub.StatusCode != http.StatusNotFound {
		t.Errorf("public GET deletion-requests status = %d, want 404", resGetPub.StatusCode)
	}
}

func TestDeleterFreshLoginValidation(t *testing.T) {
	now := time.Date(2026, 11, 1, 12, 0, 0, 0, time.UTC)
	clk := clock.NewFixed(now)
	rec := &memAuditRecorder{}
	consentsRevoker := &fakeConsentsRevoker{}
	userDeleter := &fakeUserDeleter{}

	// Case 1: Session started 10 minutes ago (> 5 minutes) -> rejects with ErrFreshLoginRequired
	staleSessions := fakeSessions{
		start: now.Add(-10 * time.Minute),
		found: true,
	}
	deleterStale := privacy.NewDeleter(nil, clk, rec, staleSessions, consentsRevoker, userDeleter)
	user := auth.User{ID: "user-1", SessionID: "sid-1"}
	_, err := deleterStale.DeleteAccount(context.Background(), user, httpapi.PrivacyDeletionRequestCreate{})
	if !errors.Is(err, privacy.ErrFreshLoginRequired) {
		t.Errorf("expected ErrFreshLoginRequired, got %v", err)
	}

	// Case 2: Session started 2 minutes ago (<= 5 minutes) -> succeeds
	freshSessions := fakeSessions{
		start: now.Add(-2 * time.Minute),
		found: true,
	}
	deleterFresh := privacy.NewDeleter(nil, clk, rec, freshSessions, consentsRevoker, userDeleter)
	resp, err := deleterFresh.DeleteAccount(context.Background(), user, httpapi.PrivacyDeletionRequestCreate{})
	if err != nil {
		t.Fatalf("expected success, got %v", err)
	}
	if resp.Status != httpapi.Completed {
		t.Errorf("status = %q, want completed", resp.Status)
	}
	if len(consentsRevoker.revokedUsers) != 1 || consentsRevoker.revokedUsers[0] != "user-1" {
		t.Errorf("consents revoked users = %v, want [user-1]", consentsRevoker.revokedUsers)
	}
	if len(userDeleter.deletedUsers) != 1 || userDeleter.deletedUsers[0] != "user-1" {
		t.Errorf("deleted users = %v, want [user-1]", userDeleter.deletedUsers)
	}
	if len(rec.events) != 2 {
		t.Fatalf("audit events count = %d, want 2", len(rec.events))
	}
	if rec.events[0].Type != audit.PrivacyDeletionRequested {
		t.Errorf("first audit event = %q, want %q", rec.events[0].Type, audit.PrivacyDeletionRequested)
	}
	if rec.events[1].Type != audit.PrivacyDeletionCompleted {
		t.Errorf("second audit event = %q, want %q", rec.events[1].Type, audit.PrivacyDeletionCompleted)
	}
}
