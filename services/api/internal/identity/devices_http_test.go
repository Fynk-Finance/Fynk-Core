package identity

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/devices"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

const (
	devA        = "3f8b2a54-6a1e-4c58-9d3b-7a1f0c2e9b11"
	devB        = "9c1d7e02-52b4-4f0a-8e6d-1b3a5c7d9e22"
	secretName  = "Telefono Secreto de Camila"
	validKeyB64 = "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA="
)

var at = time.Date(2026, 10, 27, 14, 0, 0, 0, time.UTC)

type fakeService struct {
	registerErr error
	created     bool
	gotIn       devices.RegisterInput
	gotIdem     string
	gotUser     auth.User
	gotCurrent  string
	gotOthers   string
	list        []devices.Device
	err         error
	registered  int
}

func dev(id string, st devices.Status) devices.Device {
	return devices.Device{ID: id, Name: secretName, Platform: devices.PlatformIOS, Status: st,
		PublicKey: make([]byte, 32), CreatedAt: at, LastSeenAt: at}
}

func (f *fakeService) Register(_ context.Context, u auth.User, in devices.RegisterInput, idem string) (devices.Device, bool, error) {
	f.registered++
	f.gotUser, f.gotIn, f.gotIdem = u, in, idem
	if f.registerErr != nil {
		return devices.Device{}, false, f.registerErr
	}
	return dev(devA, devices.StatusActive), f.created, nil
}
func (f *fakeService) List(context.Context, string) ([]devices.Device, error) { return f.list, f.err }
func (f *fakeService) Current(_ context.Context, _ auth.User, id string) (devices.Device, error) {
	f.gotCurrent = id
	if f.err != nil {
		return devices.Device{}, f.err
	}
	return dev(devA, devices.StatusActive), nil
}
func (f *fakeService) Remove(context.Context, string, string) (string, error) { return "", f.err }
func (f *fakeService) RemoveOthers(_ context.Context, _, cur string) ([]string, error) {
	f.gotOthers = cur
	return nil, f.err
}

func serve(t *testing.T, f *fakeService) http.Handler {
	t.Helper()
	auth.Install(auth.DevVerifier{Env: config.EnvLocal})
	t.Cleanup(func() { auth.Install(nil) })
	m := New(module.Deps{}).(mod)
	m.devices = f
	r := chi.NewRouter()
	r.Route("/v1", m.Routes)
	return r
}

func do(h http.Handler, method, path, body string, hdr map[string]string) *httptest.ResponseRecorder {
	var rd io.Reader
	if body != "" {
		rd = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, rd)
	req.Header.Set("Authorization", "Bearer "+auth.DevToken)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func regBody(key string) string {
	return `{"name":"` + secretName + `","platform":"ios","publicKey":"` + key + `"}`
}

func wantProblem(t *testing.T, rec *httptest.ResponseRecorder, status int, code string) problem.Problem {
	t.Helper()
	if rec.Code != status {
		t.Fatalf("status %d, want %d (%s)", rec.Code, status, rec.Body)
	}
	if ct := rec.Header().Get("Content-Type"); ct != problem.ContentType {
		t.Fatalf("Content-Type %q", ct)
	}
	var p problem.Problem
	if err := json.Unmarshal(rec.Body.Bytes(), &p); err != nil {
		t.Fatal(err)
	}
	if p.Code != code || p.Status != status {
		t.Fatalf("problem %+v, want code %s", p, code)
	}
	if strings.Contains(rec.Body.String(), secretName) || strings.Contains(rec.Body.String(), validKeyB64) {
		t.Fatalf("problem leaks request data: %s", rec.Body)
	}
	return p
}

func TestRegisterCreatedAndExisting(t *testing.T) {
	f := &fakeService{created: true}
	h := serve(t, f)
	rec := do(h, "POST", "/v1/devices", regBody(validKeyB64), map[string]string{"Idempotency-Key": "k-1"})
	if rec.Code != 201 {
		t.Fatalf("status %d: %s", rec.Code, rec.Body)
	}
	if f.gotIdem != "k-1" || f.gotUser.ID != "dev-user" || len(f.gotIn.PublicKey) != 32 || f.gotIn.Name != secretName {
		t.Fatalf("service got %+v idem=%q user=%+v", f.gotIn, f.gotIdem, f.gotUser)
	}
	var out map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	if _, ok := out["publicKey"]; ok {
		t.Fatal("response has the public key")
	}
	if out["id"] != devA || out["status"] != "active" || out["current"] != false {
		t.Fatalf("body %v", out)
	}

	f.created = false
	if rec := do(h, "POST", "/v1/devices", regBody(validKeyB64), nil); rec.Code != 200 {
		t.Fatalf("status %d, want 200", rec.Code)
	}
	if f.gotIdem != "" {
		t.Fatalf("idempotency key %q", f.gotIdem)
	}
}

func TestRegisterRejectsBadPublicKey(t *testing.T) {
	f := &fakeService{}
	h := serve(t, f)
	short := base64.StdEncoding.EncodeToString(make([]byte, 31))
	long := base64.StdEncoding.EncodeToString(make([]byte, 33))
	cases := map[string]string{
		"short":        short,
		"long":         long,
		"not base64":   strings.Repeat("!", 44),
		"unpadded":     strings.TrimRight(validKeyB64, "="),
		"url alphabet": strings.NewReplacer("+", "-", "/", "_").Replace(base64.StdEncoding.EncodeToString([]byte{0xfb, 0xff, 0xfe, 0xfb, 0xff, 0xfe, 0xfb, 0xff, 0xfe, 0xfb, 0xff, 0xfe, 0xfb, 0xff, 0xfe, 0xfb, 0xff, 0xfe, 0xfb, 0xff, 0xfe, 0xfb, 0xff, 0xfe, 0xfb, 0xff, 0xfe, 0xfb, 0xff, 0xfe, 0xfb, 0xff})),
		"empty":        "",
	}
	for name, k := range cases {
		t.Run(name, func(t *testing.T) {
			p := wantProblem(t, do(h, "POST", "/v1/devices", regBody(k), nil), 400, "invalid_device")
			if !strings.Contains(p.Detail, "publicKey") {
				t.Fatalf("detail %q does not name the field", p.Detail)
			}
		})
	}
	if f.registered != 0 {
		t.Fatal("service was called with a bad key")
	}
}

func TestRegisterErrors(t *testing.T) {
	cases := []struct {
		name   string
		err    error
		status int
		code   string
		detail string
	}{
		{"invalid field", wrapInvalid("name"), 400, "invalid_device", "name"},
		{"key removed", devices.ErrKeyRemoved, 409, "device_key_removed", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			h := serve(t, &fakeService{registerErr: c.err})
			p := wantProblem(t, do(h, "POST", "/v1/devices", regBody(validKeyB64), nil), c.status, c.code)
			if !strings.Contains(p.Detail, c.detail) {
				t.Fatalf("detail %q", p.Detail)
			}
		})
	}
}

func wrapInvalid(field string) error {
	_, err := devices.RegisterInput{Name: "", Platform: devices.PlatformIOS, PublicKey: make([]byte, 32)}.Validate()
	if field != "name" || err == nil {
		panic("test helper")
	}
	return err
}

func TestRegisterUnexpectedErrorIs500WithoutDetails(t *testing.T) {
	h := serve(t, &fakeService{registerErr: io.ErrUnexpectedEOF})
	p := wantProblem(t, do(h, "POST", "/v1/devices", regBody(validKeyB64), nil), 500, "internal")
	if strings.Contains(p.Detail, "EOF") {
		t.Fatalf("detail leaks the error: %q", p.Detail)
	}
}

func TestRegisterMalformedBodyIs400(t *testing.T) {
	h := serve(t, &fakeService{})
	wantProblem(t, do(h, "POST", "/v1/devices", `{"name":`, nil), 400, "bad_request")
}

func TestListMarksCurrent(t *testing.T) {
	f := &fakeService{list: []devices.Device{dev(devA, devices.StatusActive), dev(devB, devices.StatusPending)}}
	h := serve(t, f)
	rec := do(h, "GET", "/v1/devices", "", map[string]string{"X-Device-Id": devB})
	if rec.Code != 200 {
		t.Fatalf("status %d", rec.Code)
	}
	var out struct {
		Items []struct {
			ID      string `json:"id"`
			Current bool   `json:"current"`
		} `json:"items"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	if len(out.Items) != 2 || out.Items[0].Current || !out.Items[1].Current {
		t.Fatalf("items %+v", out.Items)
	}
	// No header: nothing is current, and an empty list is [] not null.
	f.list = nil
	rec = do(h, "GET", "/v1/devices", "", nil)
	if rec.Code != 200 || strings.TrimSpace(rec.Body.String()) != `{"items":[]}` {
		t.Fatalf("status %d body %s", rec.Code, rec.Body)
	}
}

func TestCurrent(t *testing.T) {
	f := &fakeService{}
	h := serve(t, f)
	rec := do(h, "GET", "/v1/devices/current", "", map[string]string{"X-Device-Id": devA})
	if rec.Code != 200 || f.gotCurrent != devA || !strings.Contains(rec.Body.String(), `"current":true`) {
		t.Fatalf("status %d body %s", rec.Code, rec.Body)
	}
	wantProblem(t, do(h, "GET", "/v1/devices/current", "", nil), 400, "bad_request")

	f.err = devices.ErrNotFound
	wantProblem(t, do(h, "GET", "/v1/devices/current", "", map[string]string{"X-Device-Id": devA}), 404, "device_not_found")
	f.err = devices.ErrRemoved
	wantProblem(t, do(h, "GET", "/v1/devices/current", "", map[string]string{"X-Device-Id": devA}), 410, "device_removed")
}

func TestRemove(t *testing.T) {
	f := &fakeService{}
	h := serve(t, f)
	if rec := do(h, "DELETE", "/v1/devices/"+devB, "", nil); rec.Code != 204 || rec.Body.Len() != 0 {
		t.Fatalf("status %d", rec.Code)
	}
	wantProblem(t, do(h, "DELETE", "/v1/devices/not-a-uuid", "", nil), 400, "bad_request")
	f.err = devices.ErrNotFound
	wantProblem(t, do(h, "DELETE", "/v1/devices/"+devB, "", nil), 404, "device_not_found")
}

func TestSignOutOthers(t *testing.T) {
	f := &fakeService{}
	h := serve(t, f)
	hdr := map[string]string{"X-Device-Id": devA}
	if rec := do(h, "POST", "/v1/devices/sign-out-others", "", hdr); rec.Code != 204 || f.gotOthers != devA {
		t.Fatalf("status %d current %q", rec.Code, f.gotOthers)
	}
	wantProblem(t, do(h, "POST", "/v1/devices/sign-out-others", "", nil), 400, "bad_request")
	f.err = devices.ErrNotFound
	wantProblem(t, do(h, "POST", "/v1/devices/sign-out-others", "", hdr), 404, "device_not_found")
	f.err = devices.ErrRemoved
	wantProblem(t, do(h, "POST", "/v1/devices/sign-out-others", "", hdr), 410, "device_removed")
}

func TestDevicesRequireAToken(t *testing.T) {
	h := serve(t, &fakeService{})
	req := httptest.NewRequest("GET", "/v1/devices", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	wantProblem(t, rec, 401, "unauthorized")
}

func TestMeStaysAStub(t *testing.T) {
	h := serve(t, &fakeService{})
	wantProblem(t, do(h, "GET", "/v1/me", "", nil), 501, "not_implemented")
}

func TestNewDoesNotTouchTheDatabase(t *testing.T) {
	if New(module.Deps{}) == nil {
		t.Fatal("nil module")
	}
}
