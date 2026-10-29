package advisor

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// fakeModel answers with the texts it is given, one per call, and records the requests.
type fakeModel struct {
	answers []string
	errs    []error
	calls   []ModelRequest
}

func (f *fakeModel) Generate(_ context.Context, req ModelRequest) (ModelResponse, error) {
	i := len(f.calls)
	f.calls = append(f.calls, req)
	if i < len(f.errs) && f.errs[i] != nil {
		return ModelResponse{}, f.errs[i]
	}
	text := ""
	if i < len(f.answers) {
		text = f.answers[i]
	} else if len(f.answers) > 0 {
		text = f.answers[len(f.answers)-1]
	}
	return ModelResponse{Text: text, ModelID: "fake", InputTokens: 900, OutputTokens: 300}, nil
}

type limiter struct{ allow bool }

func (l limiter) Allow(context.Context, string, time.Time) (bool, error) { return l.allow, nil }

var testNow = time.Date(2026, 10, 28, 17, 0, 0, 0, time.UTC)

func newService(m Model, l RateLimiter, logs io.Writer) *Service {
	if logs == nil {
		logs = io.Discard
	}
	return NewService(m, l, Prompt{Version: "test", System: "system"}, DefaultConfig("amazon.nova-lite-v1:0"),
		func() time.Time { return testNow }, slog.New(slog.NewJSONHandler(logs, nil)))
}

func loadFixture(t *testing.T, name string) Request {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join("testdata", name+".json"))
	if err != nil {
		t.Fatal(err)
	}
	req, _, err := Decode(bytes.NewReader(raw))
	if err != nil {
		t.Fatalf("%s: %v", name, err)
	}
	return req
}

func answer(t *testing.T, o Output) string {
	t.Helper()
	b, err := json.Marshal(o)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

// goodOutput is a valid answer for the design fixture.
func goodOutput() Output {
	return Output{
		Summary: "Este mes recibiste $5.580.000. Tus gastos fijos son $1.930.600 y tienes 4 suscripciones por $112.600 al mes.",
		Steps: []Step{
			{FactKey: "subscriptions.low_use", Title: "Suscripciones", Text: "Tienes 2 suscripciones que casi no usas. Revisa cuáles cancelar y ahorra hasta $56.800 al mes."},
			{FactKey: "category_increase.restaurants", Title: "Restaurantes", Text: "Este mes llevas un 30 % más que el anterior. Fija un tope semanal."},
			{FactKey: "payday_contribution", Title: "Aporte automático", Text: "Programa un recordatorio de $300.000 para tu meta el día de tu salario."},
		},
	}
}

func TestDesignFixtureGoodAnswerPasses(t *testing.T) {
	req := loadFixture(t, "design")
	m := &fakeModel{answers: []string{answer(t, goodOutput())}}
	res, err := newService(m, nil, nil).Generate(context.Background(), "user-1", req)
	if err != nil {
		t.Fatal(err)
	}
	if res.Fallback || len(res.Steps) != 3 || len(m.calls) != 1 {
		t.Fatalf("want 3 steps from one call, got fallback=%v steps=%d calls=%d", res.Fallback, len(res.Steps), len(m.calls))
	}
	if res.ModelID != "fake" || res.PromptVersion != "test" || len(res.SnapshotHash) != 64 {
		t.Fatalf("traceability fields missing: %+v", res)
	}
	if got := m.calls[0]; got.Temperature != 0.2 || got.MaxTokens != 800 || got.System != "system" {
		t.Fatalf("model settings: %+v", got)
	}
}

func TestCodeFencedAnswerIsAccepted(t *testing.T) {
	req := loadFixture(t, "design")
	m := &fakeModel{answers: []string{"```json\n" + answer(t, goodOutput()) + "\n```"}}
	res, _ := newService(m, nil, nil).Generate(context.Background(), "u", req)
	if res.Fallback {
		t.Fatal("a fenced JSON answer must be accepted")
	}
}

// Golden: for every fixture, the post checks catch each kind of bad output, the service retries
// once and then answers fallback so the phone uses its templates.
func TestGoldenBadOutputsFallBack(t *testing.T) {
	fixtures := []string{"design", "no_opportunities", "many_categories", "goals_and_caps", "payday_only"}
	bad := map[string]func(req Request) Output{
		"invented amount": func(req Request) Output {
			return Output{Summary: "Podrías ahorrar $999.999 este mes.", Steps: stepsFor(req, "Revisa tus gastos.")}
		},
		"invented percent": func(req Request) Output {
			return Output{Summary: "Gastaste un 47 % más.", Steps: stepsFor(req, "Revisa tus gastos.")}
		},
		"decimal percent": func(req Request) Output {
			return Output{Summary: "Rentabilidad de 4,6 %.", Steps: stepsFor(req, "Revisa tus gastos.")}
		},
		"product": func(req Request) Output {
			return Output{Summary: "Te recomiendo invertir en un fondo de inversión.", Steps: stepsFor(req, "Ahorra.")}
		},
		"issuer": func(req Request) Output {
			return Output{Summary: "Abre un CDT de Bancolombia.", Steps: stepsFor(req, "Ahorra.")}
		},
		"ticker": func(req Request) Output {
			return Output{Summary: "Compra AAPL y $TSLA.", Steps: stepsFor(req, "Ahorra.")}
		},
		"promise": func(req Request) Output {
			return Output{Summary: "Tu ahorro tiene rentabilidad garantizada.", Steps: stepsFor(req, "Ahorra.")}
		},
		"unknown factKey": func(req Request) Output {
			return Output{Summary: "Vas bien este mes.", Steps: append(stepsFor(req, "Ahorra."), Step{FactKey: "transport.plan", Title: "Transporte", Text: "Compra un plan."})}
		},
		"repeated factKey": func(req Request) Output {
			s := stepsFor(req, "Ahorra.")
			if len(s) == 0 {
				s = []Step{{FactKey: "x", Title: "X", Text: "Y"}}
			}
			return Output{Summary: "Vas bien este mes.", Steps: append(s, s[0])}
		},
		"text too long": func(req Request) Output {
			return Output{Summary: strings.Repeat("a", 401), Steps: stepsFor(req, "Ahorra.")}
		},
		"empty summary": func(req Request) Output {
			return Output{Summary: " ", Steps: stepsFor(req, "Ahorra.")}
		},
	}
	for _, name := range fixtures {
		req := loadFixture(t, name)
		for kind, make := range bad {
			t.Run(name+"/"+kind, func(t *testing.T) {
				out := make(req)
				if err := Check(out, req); !errors.Is(err, ErrUnsafeOutput) {
					t.Fatalf("Check must reject %s, got %v", kind, err)
				}
				m := &fakeModel{answers: []string{answer(t, out)}}
				res, err := newService(m, nil, nil).Generate(context.Background(), "u", req)
				if err != nil {
					t.Fatal(err)
				}
				if !res.Fallback || len(res.Steps) != 0 || len(m.calls) != 2 {
					t.Fatalf("want fallback after one retry, got fallback=%v calls=%d", res.Fallback, len(m.calls))
				}
			})
		}
	}
}

func stepsFor(req Request, text string) []Step {
	steps := []Step{}
	for _, k := range req.FactKeys {
		steps = append(steps, Step{FactKey: k, Title: "Paso", Text: text})
	}
	return steps
}

func TestNotJSONAndModelErrorsFallBack(t *testing.T) {
	req := loadFixture(t, "design")
	for name, m := range map[string]*fakeModel{
		"not json":    {answers: []string{"Hola, aquí van tus recomendaciones"}},
		"extra field": {answers: []string{`{"summary":"Vas bien.","steps":[],"product":"x"}`}},
		"model error": {errs: []error{errors.New("throttled"), errors.New("throttled")}},
	} {
		t.Run(name, func(t *testing.T) {
			res, err := newService(m, nil, nil).Generate(context.Background(), "u", req)
			if err != nil || !res.Fallback {
				t.Fatalf("want fallback, got %v %v", res.Fallback, err)
			}
		})
	}
}

func TestRetriesOnceThenSucceeds(t *testing.T) {
	req := loadFixture(t, "design")
	m := &fakeModel{answers: []string{`{"summary":"Ganaste $1.000.000.000.","steps":[]}`, answer(t, goodOutput())}}
	res, _ := newService(m, nil, nil).Generate(context.Background(), "u", req)
	if res.Fallback || len(m.calls) != 2 {
		t.Fatalf("want success on the retry, got fallback=%v calls=%d", res.Fallback, len(m.calls))
	}
}

func TestRateLimit(t *testing.T) {
	req := loadFixture(t, "design")
	m := &fakeModel{answers: []string{answer(t, goodOutput())}}
	_, err := newService(m, limiter{allow: false}, nil).Generate(context.Background(), "u", req)
	if !errors.Is(err, ErrRateLimited) || len(m.calls) != 0 {
		t.Fatalf("want rate limited without a model call, got %v calls=%d", err, len(m.calls))
	}
}

func TestLogsKeepOnlyHashModelAndCounts(t *testing.T) {
	req := loadFixture(t, "design")
	var logs bytes.Buffer
	m := &fakeModel{answers: []string{answer(t, goodOutput())}}
	if _, err := newService(m, nil, &logs).Generate(context.Background(), "user-1", req); err != nil {
		t.Fatal(err)
	}
	line := logs.String()
	for _, want := range []string{"snapshot_hash", "model_id", "input_tokens", "output_tokens", "latency_ms"} {
		if !strings.Contains(line, want) {
			t.Errorf("log is missing %s: %s", want, line)
		}
	}
	for _, leak := range []string{"558000000", "5680000", "Suscripciones", "user-1", "restaurants"} {
		if strings.Contains(line, leak) {
			t.Errorf("log leaks %q: %s", leak, line)
		}
	}
}

func TestUserMessageCarriesOnlyTheSnapshot(t *testing.T) {
	req := loadFixture(t, "design")
	m := &fakeModel{answers: []string{answer(t, goodOutput())}}
	_, _ = newService(m, nil, nil).Generate(context.Background(), "user-1", req)
	if strings.Contains(m.calls[0].User, "user-1") {
		t.Fatal("the user id must never reach the model")
	}
	if !strings.Contains(m.calls[0].User, `"factKeys":["subscriptions.low_use"`) {
		t.Fatalf("user message: %s", m.calls[0].User)
	}
}

func TestDecodeRejectsWhatIsNotASnapshot(t *testing.T) {
	raw, _ := os.ReadFile(filepath.Join("testdata", "design.json"))
	var generic map[string]any
	_ = json.Unmarshal(raw, &generic)

	mutate := func(f func(m map[string]any)) []byte {
		var m map[string]any
		_ = json.Unmarshal(raw, &m)
		f(m)
		b, _ := json.Marshal(m)
		return b
	}
	snap := func(m map[string]any) map[string]any { return m["snapshot"].(map[string]any) }

	cases := map[string][]byte{
		"over 16 KB": append(raw[:len(raw)-1], []byte(`,"pad":"`+strings.Repeat("x", MaxRequestBytes)+`"}`)...),
		"raw movements": mutate(func(m map[string]any) {
			snap(m)["transactions"] = []any{map[string]any{"description": "NETFLIX", "amountMinor": -3890000}}
		}),
		"merchant name in a category": mutate(func(m map[string]any) {
			snap(m)["spendByCategory"].([]any)[0].(map[string]any)["merchant"] = "PIZZERIA DEMO"
		}),
		"unknown category": mutate(func(m map[string]any) {
			snap(m)["spendByCategory"].([]any)[0].(map[string]any)["categoryId"] = "netflix"
		}),
		"goal name as ref": mutate(func(m map[string]any) {
			snap(m)["goals"].([]any)[0].(map[string]any)["ref"] = "Viaje a Cartagena"
		}),
		"float amount":    mutate(func(m map[string]any) { snap(m)["fixedExpensesMonthlyMinor"] = 1.5 }),
		"negative amount": mutate(func(m map[string]any) { snap(m)["fixedExpensesMonthlyMinor"] = -1 }),
		"11 months": mutate(func(m map[string]any) {
			snap(m)["monthlyIncomeMinor"] = snap(m)["monthlyIncomeMinor"].([]any)[1:]
		}),
		"schema version":           mutate(func(m map[string]any) { snap(m)["schemaVersion"] = 2 }),
		"fact key not in snapshot": mutate(func(m map[string]any) { m["factKeys"] = []any{"transport.plan"} }),
		"fact key with spaces": mutate(func(m map[string]any) {
			snap(m)["opportunities"].([]any)[0].(map[string]any)["factKey"] = "netflix y spotify"
			m["factKeys"] = []any{}
		}),
		"two documents": append(append([]byte{}, raw...), raw...),
	}
	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			if _, _, err := Decode(bytes.NewReader(body)); !errors.Is(err, ErrInvalidSnapshot) {
				t.Fatalf("want ErrInvalidSnapshot, got %v", err)
			}
		})
	}
	if _, _, err := Decode(bytes.NewReader(raw)); err != nil {
		t.Fatalf("the design fixture must be valid: %v", err)
	}
}

func TestHashIsStable(t *testing.T) {
	a := loadFixture(t, "design").Snapshot.Hash()
	b := loadFixture(t, "design").Snapshot.Hash()
	c := loadFixture(t, "payday_only").Snapshot.Hash()
	if a != b || a == c {
		t.Fatal("same snapshot, same hash; another snapshot, another hash")
	}
}

func TestAllowedPercentsFollowFromTheSnapshot(t *testing.T) {
	req := loadFixture(t, "goals_and_caps")
	_, percents := allowedNumbers(req.Snapshot)
	// goal_1: 3.200.000 of 5.000.000 = 64 %; the treats cap: 125 %; restaurants: +30 %.
	for _, p := range []int64{64, 125, 30} {
		if !percents[p] {
			t.Errorf("percent %d should be allowed", p)
		}
	}
}
