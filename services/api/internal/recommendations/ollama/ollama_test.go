package ollama

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/recommendations/advisor"
)

func request() advisor.ModelRequest {
	return advisor.ModelRequest{
		System:       "Eres el asistente de Fynk.",
		User:         `{"snapshot":{}}`,
		OutputSchema: advisor.OutputSchema,
		MaxTokens:    800,
		Temperature:  0.2,
	}
}

func TestBodyForcesTheOutputSchemaWithoutStreaming(t *testing.T) {
	body, err := New(DefaultURL, "qwen2.5:3b", nil).Body(request())
	if err != nil {
		t.Fatal(err)
	}
	var got map[string]any
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatal(err)
	}
	if got["model"] != "qwen2.5:3b" || got["stream"] != false {
		t.Fatalf("model or stream: %v", got)
	}
	if _, ok := got["format"].(map[string]any); !ok {
		t.Fatalf("format must be the output schema, got %v", got["format"])
	}
	msgs := got["messages"].([]any)
	if len(msgs) != 2 || msgs[0].(map[string]any)["role"] != "system" || msgs[1].(map[string]any)["role"] != "user" {
		t.Fatalf("messages: %v", msgs)
	}
	opts := got["options"].(map[string]any)
	if opts["num_predict"] != float64(800) {
		t.Fatalf("options: %v", opts)
	}
}

func TestGenerateReturnsTheJSONTextAndTokens(t *testing.T) {
	var path string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path = r.URL.Path
		_, _ = io.Copy(io.Discard, r.Body)
		_, _ = w.Write([]byte(`{"message":{"role":"assistant","content":" {\"summary\":\"Vas bien.\",\"steps\":[]} "},"prompt_eval_count":900,"eval_count":40,"done":true}`))
	}))
	defer srv.Close()

	resp, err := New(srv.URL+"/", "qwen2.5:3b", srv.Client()).Generate(context.Background(), request())
	if err != nil {
		t.Fatal(err)
	}
	if path != "/api/chat" || resp.Text != `{"summary":"Vas bien.","steps":[]}` ||
		resp.InputTokens != 900 || resp.OutputTokens != 40 || resp.ModelID != "qwen2.5:3b" {
		t.Fatalf("got %+v from %s", resp, path)
	}
}

func TestGenerateFailsOnAnErrorAnEmptyAnswerOrNoServer(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"error":"model \"qwen2.5:3b\" not found, try pulling it first"}`))
	}))
	defer srv.Close()

	_, err := New(srv.URL, "qwen2.5:3b", srv.Client()).Generate(context.Background(), request())
	if err == nil || !strings.Contains(err.Error(), "not found") {
		t.Fatalf("want the model error, got %v", err)
	}
	empty := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"message":{"content":"  "}}`))
	}))
	defer empty.Close()
	if _, err := New(empty.URL, "m", empty.Client()).Generate(context.Background(), request()); err == nil {
		t.Fatal("want an error for an empty answer")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if _, err := New("http://127.0.0.1:1", "m", nil).Generate(ctx, request()); err == nil {
		t.Fatal("want an error without a server")
	}
}
