package identity

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/kcadmin"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
)

const fullEmail = "camila.rojas@correo.com"

type fakeAdmin struct {
	user      kcadmin.User
	pwd       time.Time
	hasPwd    bool
	err       error
	gets      int
	updated   [][2]string
	updateErr error
}

func (f *fakeAdmin) GetUser(context.Context, string) (kcadmin.User, error) {
	f.gets++
	return f.user, f.err
}
func (f *fakeAdmin) PasswordUpdatedAt(context.Context, string) (time.Time, bool, error) {
	return f.pwd, f.hasPwd, f.err
}
func (f *fakeAdmin) UpdateNames(_ context.Context, _, first, last string) error {
	if f.updateErr != nil {
		return f.updateErr
	}
	f.updated = append(f.updated, [2]string{first, last})
	return nil
}

func newAdmin() *fakeAdmin {
	return &fakeAdmin{
		user: kcadmin.User{Email: fullEmail, FirstName: "Camila", LastName: "Rojas", EmailVerified: true, CreatedAt: at},
		pwd:  at.Add(time.Hour), hasPwd: true,
	}
}

// memRedis is a go-redis client whose commands are answered by a hook, with no network.
type memRedis struct {
	mu   sync.Mutex
	data map[string]string
	ttl  map[string]time.Duration
	fail bool
}

func newMemRedis() (*redis.Client, *memRedis) {
	m := &memRedis{data: map[string]string{}, ttl: map[string]time.Duration{}}
	c := redis.NewClient(&redis.Options{Addr: "127.0.0.1:1"})
	c.AddHook(m)
	return c, m
}

func (m *memRedis) DialHook(next redis.DialHook) redis.DialHook { return next }
func (m *memRedis) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return next
}
func (m *memRedis) ProcessHook(redis.ProcessHook) redis.ProcessHook {
	return func(_ context.Context, cmd redis.Cmder) error {
		m.mu.Lock()
		defer m.mu.Unlock()
		if m.fail {
			err := errors.New("redis down")
			cmd.SetErr(err)
			return err
		}
		args := cmd.Args()
		key, _ := args[1].(string)
		switch cmd.Name() {
		case "get":
			v, ok := m.data[key]
			if !ok {
				cmd.SetErr(redis.Nil)
				return redis.Nil
			}
			cmd.(*redis.StringCmd).SetVal(v)
		case "set":
			m.data[key] = string(args[2].([]byte))
			m.ttl[key] = time.Duration(args[4].(int64)) * time.Second
			cmd.(*redis.StatusCmd).SetVal("OK")
		case "del":
			delete(m.data, key)
			cmd.(*redis.IntCmd).SetVal(1)
		}
		return nil
	}
}

func serveProfile(t *testing.T, admin *fakeAdmin, rc *redis.Client) http.Handler {
	t.Helper()
	return serveWith(t, &fakeService{}, func(m *mod) {
		if admin != nil {
			m.admin = admin
		}
		m.deps.Redis = rc
	})
}

func TestGetProfileMasksTheEmail(t *testing.T) {
	h := serveProfile(t, newAdmin(), nil)
	rec := do(h, "GET", "/v1/me", "", nil)
	if rec.Code != 200 {
		t.Fatalf("status %d: %s", rec.Code, rec.Body)
	}
	if strings.Contains(rec.Body.String(), fullEmail) {
		t.Fatalf("full email in the response: %s", rec.Body)
	}
	var out map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	if out["id"] != "dev-user" || out["email"] != "ca•••@correo.com" || out["firstName"] != "Camila" ||
		out["emailVerified"] != true || out["createdAt"] != "2026-10-27T14:00:00Z" || out["passwordUpdatedAt"] != "2026-10-27T15:00:00Z" {
		t.Fatalf("body %v", out)
	}
}

func TestGetProfileOmitsEmptyNamesAndUnknownPasswordDate(t *testing.T) {
	a := newAdmin()
	a.user.FirstName, a.user.LastName, a.hasPwd = "", "", false
	rec := do(serveProfile(t, a, nil), "GET", "/v1/me", "", nil)
	for _, k := range []string{"firstName", "lastName", "passwordUpdatedAt"} {
		if strings.Contains(rec.Body.String(), k) {
			t.Fatalf("%s should be absent: %s", k, rec.Body)
		}
	}
}

func TestGetProfileErrors(t *testing.T) {
	a := newAdmin()
	h := serveProfile(t, a, nil)
	a.err = kcadmin.ErrUnavailable
	wantProblem(t, do(h, "GET", "/v1/me", "", nil), 503, "identity_admin_unavailable")
	a.err = errors.New("kcadmin: get user: status 500")
	wantProblem(t, do(h, "GET", "/v1/me", "", nil), 503, "identity_admin_unavailable")
	a.err = kcadmin.ErrNotFound
	wantProblem(t, do(h, "GET", "/v1/me", "", nil), 404, "profile_not_found")

	// A module built without the admin client (no secret) answers 503 and makes no call.
	m := New(module.Deps{}).(mod)
	if m.admin == nil {
		t.Fatal("New must wire the admin client")
	}
	wantProblem(t, do(serve(t, &fakeService{}), "GET", "/v1/me", "", nil), 503, "identity_admin_unavailable")
}

func TestGetProfileCachesTheMaskedProfileForFiveMinutes(t *testing.T) {
	rc, mem := newMemRedis()
	a := newAdmin()
	h := serveProfile(t, a, rc)
	first := do(h, "GET", "/v1/me", "", nil)
	second := do(h, "GET", "/v1/me", "", nil)
	if first.Code != 200 || first.Body.String() != second.Body.String() || a.gets != 1 {
		t.Fatalf("gets = %d, bodies %q / %q", a.gets, first.Body, second.Body)
	}
	cached := mem.data["identity:me:dev-user"]
	if cached == "" || mem.ttl["identity:me:dev-user"] != 5*time.Minute {
		t.Fatalf("cache entry %q ttl %v", cached, mem.ttl["identity:me:dev-user"])
	}
	for _, v := range mem.data {
		if strings.Contains(v, fullEmail) {
			t.Fatal("the full email reached Redis")
		}
	}
}

func TestProfileWorksWhenRedisFails(t *testing.T) {
	rc, mem := newMemRedis()
	mem.fail = true
	a := newAdmin()
	h := serveProfile(t, a, rc)
	if rec := do(h, "GET", "/v1/me", "", nil); rec.Code != 200 {
		t.Fatalf("GET status %d: %s", rec.Code, rec.Body)
	}
	if rec := do(h, "PATCH", "/v1/me", `{"firstName":"Ana"}`, nil); rec.Code != 200 {
		t.Fatalf("PATCH status %d: %s", rec.Code, rec.Body)
	}
}

func TestUpdateProfile(t *testing.T) {
	rc, mem := newMemRedis()
	a := newAdmin()
	h := serveProfile(t, a, rc)
	do(h, "GET", "/v1/me", "", nil)
	if len(mem.data) != 1 {
		t.Fatal("GET did not fill the cache")
	}

	rec := do(h, "PATCH", "/v1/me", `{"firstName":"  María José "}`, nil)
	if rec.Code != 200 {
		t.Fatalf("status %d: %s", rec.Code, rec.Body)
	}
	if len(a.updated) != 1 || a.updated[0] != [2]string{"María José", "Rojas"} {
		t.Fatalf("updated %v (the other name must be kept)", a.updated)
	}
	if len(mem.data) != 0 {
		t.Fatal("PATCH must drop the cached profile")
	}
	if !strings.Contains(rec.Body.String(), `"firstName":"María José"`) || strings.Contains(rec.Body.String(), fullEmail) {
		t.Fatalf("body %s", rec.Body)
	}

	rec = do(h, "PATCH", "/v1/me", `{"firstName":"Ana","lastName":"O'Brien-Pérez"}`, nil)
	if rec.Code != 200 || a.updated[1] != [2]string{"Ana", "O'Brien-Pérez"} {
		t.Fatalf("status %d updated %v", rec.Code, a.updated)
	}
}

func TestUpdateProfileValidation(t *testing.T) {
	a := newAdmin()
	h := serveProfile(t, a, nil)
	long := strings.Repeat("a", 51)
	for name, tc := range map[string]struct{ body, field string }{
		"empty body":          {`{}`, "body"},
		"null body":           {`null`, "body"},
		"empty first name":    {`{"firstName":"   "}`, "firstName"},
		"digits":              {`{"firstName":"Ana2"}`, "firstName"},
		"symbols":             {`{"lastName":"Rojas<script>"}`, "lastName"},
		"leading hyphen":      {`{"firstName":"-Ana"}`, "firstName"},
		"trailing period":     {`{"lastName":"Rojas."}`, "lastName"},
		"too long":            {`{"firstName":"` + long + `"}`, "firstName"},
		"second name invalid": {`{"firstName":"Ana","lastName":"R0jas"}`, "lastName"},
	} {
		t.Run(name, func(t *testing.T) {
			rec := do(h, "PATCH", "/v1/me", tc.body, nil)
			p := wantProblem(t, rec, 400, "invalid_profile")
			if tc.field != "body" && !strings.Contains(p.Detail, tc.field) {
				t.Fatalf("detail %q does not name %s", p.Detail, tc.field)
			}
			if strings.Contains(rec.Body.String(), "R0jas") || strings.Contains(rec.Body.String(), "Ana2") {
				t.Fatalf("detail echoes the value: %s", rec.Body)
			}
		})
	}
	if len(a.updated) != 0 {
		t.Fatal("an invalid request reached Keycloak")
	}
	// 50 runes of a non Latin script are fine: runes, not bytes.
	if rec := do(h, "PATCH", "/v1/me", `{"firstName":"`+strings.Repeat("李", 50)+`"}`, nil); rec.Code != 200 {
		t.Fatalf("50 runes: status %d", rec.Code)
	}
}

func TestUpdateProfileAdminErrors(t *testing.T) {
	a := newAdmin()
	h := serveProfile(t, a, nil)
	a.updateErr = kcadmin.ErrUnavailable
	wantProblem(t, do(h, "PATCH", "/v1/me", `{"firstName":"Ana"}`, nil), 503, "identity_admin_unavailable")
	a.updateErr = kcadmin.ErrNotFound
	wantProblem(t, do(h, "PATCH", "/v1/me", `{"firstName":"Ana"}`, nil), 404, "profile_not_found")
}

func TestValidName(t *testing.T) {
	for in, ok := range map[string]bool{
		"Ana": true, "José Luis": true, "O'Brien": true, "Ana-María": true, "Dr. Pérez": true,
		"élan": true, "Zoë": true, "Zoë": true, "李雷": true,
		"": false, " ": false, "A.": false, ".A": false, "Ana_": false, "Ana1": false, "Ana\n": true,
	} {
		_, got := validName(in)
		if got != ok {
			t.Errorf("validName(%q) = %v, want %v", in, got, ok)
		}
	}
}
