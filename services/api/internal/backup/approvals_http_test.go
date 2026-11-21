package backup

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/approvals"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
)

const apprID = "4a6e8c10-2b3d-4f5a-8c7e-9d1b3f5a7c20"

var apprAt = time.Date(2026, 10, 27, 14, 3, 11, 0, time.UTC)

type fakeApprovals struct {
	err       error
	gotKey    string
	gotID     string
	gotGrant  approvals.Grant
	gotUser   auth.User
	calls     int
	open      []approvals.Open
	view      approvals.View
	decidedAs string
}

func (f *fakeApprovals) approval(s approvals.Status) approvals.Approval {
	return approvals.Approval{ID: apprID, Status: s, CreatedAt: apprAt, ExpiresAt: apprAt.Add(approvals.TTL)}
}

func (f *fakeApprovals) Create(_ context.Context, u auth.User, key string) (approvals.Approval, error) {
	f.calls, f.gotUser, f.gotKey = f.calls+1, u, key
	return f.approval(approvals.Pending), f.err
}
func (f *fakeApprovals) Pending(_ context.Context, u auth.User) ([]approvals.Open, error) {
	f.calls, f.gotUser = f.calls+1, u
	return f.open, f.err
}
func (f *fakeApprovals) Get(_ context.Context, u auth.User, id string) (approvals.View, error) {
	f.calls, f.gotUser, f.gotID = f.calls+1, u, id
	return f.view, f.err
}
func (f *fakeApprovals) Approve(_ context.Context, u auth.User, id string, g approvals.Grant) (approvals.Approval, error) {
	f.calls, f.gotUser, f.gotID, f.gotGrant, f.decidedAs = f.calls+1, u, id, g, "approve"
	return f.approval(approvals.Approved), f.err
}
func (f *fakeApprovals) Reject(_ context.Context, u auth.User, id string) (approvals.Approval, error) {
	f.calls, f.gotUser, f.gotID, f.decidedAs = f.calls+1, u, id, "reject"
	return f.approval(approvals.Rejected), f.err
}

func serveApprovals(t *testing.T, f *fakeApprovals) http.Handler {
	t.Helper()
	auth.Install(auth.DevVerifier{Env: config.EnvLocal})
	t.Cleanup(func() { auth.Install(nil) })
	m := New(module.Deps{}).(mod)
	m.approvals = f
	r := chi.NewRouter()
	r.Route("/v1", m.Routes)
	return r
}

func grantBody(mut func(map[string]any)) string {
	m := map[string]any{"ephemeralPublicKey": b64(32, 1), "wrappedDek": b64(48, 2), "nonce": b64(12, 3)}
	if mut != nil {
		mut(m)
	}
	b, _ := json.Marshal(m)
	return string(b)
}

// noKeyText fails when a response carries any of the request's key material.
func noKeyText(t *testing.T, rec *httptest.ResponseRecorder) {
	t.Helper()
	for _, s := range []string{b64(32, 1), b64(48, 2), b64(12, 3), b64(32, 9)} {
		if strings.Contains(rec.Body.String(), s) {
			t.Fatalf("response carries key material: %s", rec.Body)
		}
	}
}

func TestCreateDeviceApproval(t *testing.T) {
	f := &fakeApprovals{}
	h := serveApprovals(t, f)
	rec := do(h, "POST", "/v1/device-approvals", "")
	var got struct{ ID, Status, CreatedAt, ExpiresAt string }
	if rec.Code != 201 || json.Unmarshal(rec.Body.Bytes(), &got) != nil || got.ID != apprID || got.Status != "pending" ||
		got.ExpiresAt != "2026-10-27T14:13:11Z" || f.gotUser.DeviceID != devID || f.gotKey != "" {
		t.Fatalf("%d %s (key %q)", rec.Code, rec.Body, f.gotKey)
	}
	req := httptest.NewRequest("POST", "/v1/device-approvals", nil)
	req.Header.Set("Authorization", "Bearer "+auth.DevToken)
	req.Header.Set("X-Device-Id", devID)
	req.Header.Set("Idempotency-Key", "retry-1")
	h.ServeHTTP(httptest.NewRecorder(), req)
	if f.gotKey != "retry-1" {
		t.Fatalf("idempotency key %q", f.gotKey)
	}
}

func TestCreateDeviceApprovalErrors(t *testing.T) {
	f := &fakeApprovals{err: approvals.ErrAlreadyActive}
	h := serveApprovals(t, f)
	wantProblem(t, do(h, "POST", "/v1/device-approvals", ""), 409, "device_already_active")
	f.err = approvals.ErrNotActive
	wantProblem(t, do(h, "POST", "/v1/device-approvals", ""), 403, "device_not_active")
	f.err = errors.New("db down with " + b64(32, 9))
	rec := do(h, "POST", "/v1/device-approvals", "")
	wantProblem(t, rec, 500, "internal")
	noKeyText(t, rec)

	f.err, f.calls = nil, 0
	req := httptest.NewRequest("POST", "/v1/device-approvals", nil)
	req.Header.Set("Authorization", "Bearer "+auth.DevToken)
	req.Header.Set("X-Device-Id", devID)
	req.Header.Set("Idempotency-Key", strings.Repeat("k", approvals.MaxIdempotency+1))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	wantProblem(t, w, 400, "invalid_request")
	if f.calls != 0 || !strings.Contains(w.Body.String(), "Idempotency-Key") {
		t.Fatalf("calls=%d body=%s", f.calls, w.Body)
	}
}

func TestListPendingDeviceApprovals(t *testing.T) {
	f := &fakeApprovals{open: []approvals.Open{{
		Approval:   approvals.Approval{ID: apprID, NewDevicePublicKey: []byte(strings.Repeat("\x09", 32)), CreatedAt: apprAt, ExpiresAt: apprAt.Add(approvals.TTL)},
		DeviceName: "Pixel de Camila", Platform: "android"}}}
	h := serveApprovals(t, f)
	rec := do(h, "GET", "/v1/device-approvals/pending", "")
	var got struct {
		Approvals []struct{ ID, DeviceName, Platform, NewDevicePublicKey, CreatedAt, ExpiresAt string }
	}
	if rec.Code != 200 || json.Unmarshal(rec.Body.Bytes(), &got) != nil || len(got.Approvals) != 1 ||
		got.Approvals[0].DeviceName != "Pixel de Camila" || got.Approvals[0].Platform != "android" ||
		got.Approvals[0].NewDevicePublicKey != b64(32, 9) || got.Approvals[0].ID != apprID {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	f.open = nil
	if rec := do(h, "GET", "/v1/device-approvals/pending", ""); rec.Code != 200 || strings.TrimSpace(rec.Body.String()) != `{"approvals":[]}` {
		t.Fatalf("empty: %d %s", rec.Code, rec.Body)
	}
	f.err = approvals.ErrNotActive
	wantProblem(t, do(h, "GET", "/v1/device-approvals/pending", ""), 403, "device_not_active")
}

func TestGetDeviceApproval(t *testing.T) {
	f := &fakeApprovals{view: approvals.View{Approval: approvals.Approval{ID: apprID, Status: approvals.Pending, ExpiresAt: apprAt.Add(approvals.TTL)}}}
	h := serveApprovals(t, f)
	rec := do(h, "GET", "/v1/device-approvals/"+apprID, "")
	if rec.Code != 200 || f.gotID != apprID || strings.Contains(rec.Body.String(), "wrappedDek") ||
		!strings.Contains(rec.Body.String(), `"status":"pending"`) {
		t.Fatalf("pending: %d %s", rec.Code, rec.Body)
	}
	f.view = approvals.View{Approval: approvals.Approval{Status: approvals.Approved, ExpiresAt: apprAt},
		Keys: &approvals.Grant{EphemeralPublicKey: []byte(strings.Repeat("\x01", 32)), WrappedDEK: []byte(strings.Repeat("\x02", 48)), Nonce: []byte(strings.Repeat("\x03", 12))}}
	rec = do(h, "GET", "/v1/device-approvals/"+apprID, "")
	var got map[string]any
	if rec.Code != 200 || json.Unmarshal(rec.Body.Bytes(), &got) != nil || got["id"] != apprID || got["status"] != "approved" ||
		got["ephemeralPublicKey"] != b64(32, 1) || got["wrappedDek"] != b64(48, 2) || got["nonce"] != b64(12, 3) {
		t.Fatalf("approved: %d %s", rec.Code, rec.Body)
	}
	f.view = approvals.View{Approval: approvals.Approval{Status: approvals.Approved}}
	if rec := do(h, "GET", "/v1/device-approvals/"+apprID, ""); rec.Code != 200 || strings.Contains(rec.Body.String(), "wrappedDek") {
		t.Fatalf("read again: %d %s", rec.Code, rec.Body)
	}
	f.err = approvals.ErrNotFound
	wantProblem(t, do(h, "GET", "/v1/device-approvals/"+apprID, ""), 404, "approval_not_found")
	wantProblem(t, do(h, "GET", "/v1/device-approvals/not-a-uuid", ""), 400, "bad_request")
}

func TestApproveDeviceApproval(t *testing.T) {
	f := &fakeApprovals{}
	h := serveApprovals(t, f)
	rec := do(h, "POST", "/v1/device-approvals/"+apprID+"/approve", grantBody(nil))
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), `"status":"approved"`) || f.gotID != apprID ||
		len(f.gotGrant.EphemeralPublicKey) != 32 || len(f.gotGrant.WrappedDEK) != 48 || len(f.gotGrant.Nonce) != 12 || f.gotUser.DeviceID != devID {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	noKeyText(t, rec)
}

func TestApproveDeviceApprovalInvalidBody(t *testing.T) {
	f := &fakeApprovals{}
	h := serveApprovals(t, f)
	bad := map[string]func(map[string]any){
		"ephemeralPublicKey": func(m map[string]any) { m["ephemeralPublicKey"] = b64(31, 1) },
		"wrappedDek":         func(m map[string]any) { m["wrappedDek"] = b64(49, 2) },
		"nonce":              func(m map[string]any) { m["nonce"] = "AAECAwQFBgcICQoL" + "x" },
	}
	for field, mut := range bad {
		rec := do(h, "POST", "/v1/device-approvals/"+apprID+"/approve", grantBody(mut))
		wantProblem(t, rec, 400, "invalid_request")
		var p struct{ Detail string }
		_ = json.Unmarshal(rec.Body.Bytes(), &p)
		if !strings.Contains(p.Detail, field) {
			t.Fatalf("%s: detail %q", field, p.Detail)
		}
		noKeyText(t, rec)
	}
	for _, body := range map[string]string{
		"url-safe base64": grantBody(func(m map[string]any) {
			m["wrappedDek"] = strings.NewReplacer("+", "-", "/", "_").Replace(b64(48, 0xfb))
		}),
		"unpadded": grantBody(func(m map[string]any) { m["nonce"] = strings.TrimRight(b64(12, 3), "=") + "A" }),
		"empty":    `{}`,
	} {
		wantProblem(t, do(h, "POST", "/v1/device-approvals/"+apprID+"/approve", body), 400, "invalid_request")
	}
	if f.calls != 0 {
		t.Fatal("an invalid body reached the service")
	}
}

func TestApproveAndRejectErrors(t *testing.T) {
	f := &fakeApprovals{}
	h := serveApprovals(t, f)
	cases := []struct {
		err    error
		status int
		code   string
	}{
		{approvals.ErrNotActive, 403, "device_not_active"},
		{approvals.ErrNotFound, 404, "approval_not_found"},
		{approvals.ErrNotPending, 409, "approval_not_pending"},
		{approvals.ErrExpired, 410, "approval_expired"},
		{errors.New("db down with " + b64(48, 2)), 500, "internal"},
	}
	for _, c := range cases {
		f.err = c.err
		rec := do(h, "POST", "/v1/device-approvals/"+apprID+"/approve", grantBody(nil))
		wantProblem(t, rec, c.status, c.code)
		noKeyText(t, rec)
		rec = do(h, "POST", "/v1/device-approvals/"+apprID+"/reject", "")
		wantProblem(t, rec, c.status, c.code)
		noKeyText(t, rec)
	}
}

func TestRejectDeviceApproval(t *testing.T) {
	f := &fakeApprovals{}
	h := serveApprovals(t, f)
	rec := do(h, "POST", "/v1/device-approvals/"+apprID+"/reject", "")
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), `"status":"rejected"`) || f.decidedAs != "reject" || f.gotID != apprID {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	wantProblem(t, do(h, "POST", "/v1/device-approvals/not-a-uuid/reject", ""), 400, "bad_request")
}

func TestDeviceApprovalsNeedAuthentication(t *testing.T) {
	f := &fakeApprovals{}
	h := serveApprovals(t, f)
	for _, c := range [][2]string{{"POST", "/v1/device-approvals"}, {"GET", "/v1/device-approvals/pending"},
		{"GET", "/v1/device-approvals/" + apprID}, {"POST", "/v1/device-approvals/" + apprID + "/approve"},
		{"POST", "/v1/device-approvals/" + apprID + "/reject"}} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(c[0], c[1], nil))
		if rec.Code != 401 {
			t.Fatalf("%v: %d %s", c, rec.Code, rec.Body)
		}
	}
	if f.calls != 0 {
		t.Fatal("an unauthenticated call reached the service")
	}
}

func TestApproveMalformedJSONIsBadRequest(t *testing.T) {
	f := &fakeApprovals{}
	wantProblem(t, do(serveApprovals(t, f), "POST", "/v1/device-approvals/"+apprID+"/approve", `nope`), 400, "bad_request")
	if f.calls != 0 {
		t.Fatal("malformed body reached the service")
	}
}
