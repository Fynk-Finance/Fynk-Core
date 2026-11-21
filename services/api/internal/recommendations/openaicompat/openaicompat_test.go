package openaicompat

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

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

func TestBodyForcesTheOutputSchemaAndSendsTheSnapshotOnly(t *testing.T) {
	body, err := New(Config{Model: "gemini-4-hydrogen"}, nil).Body(request())
	if err != nil {
		t.Fatal(err)
	}
	var got map[string]any
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatal(err)
	}
	if got["model"] != "gemini-4-hydrogen" || got["max_tokens"] != float64(800) {
		t.Fatalf("model or max_tokens: %v", got)
	}
	if _, ok := got["reasoning_effort"]; ok {
		t.Fatal("reasoning_effort must be left out when it is not configured")
	}
	format := got["response_format"].(map[string]any)
	schema := format["json_schema"].(map[string]any)
	if format["type"] != "json_schema" || schema["name"] != "write_recommendations" {
		t.Fatalf("response_format: %v", format)
	}
	msgs := got["messages"].([]any)
	if len(msgs) != 2 || msgs[1].(map[string]any)["content"] != `{"snapshot":{}}` {
		t.Fatalf("messages: %v", msgs)
	}
}

func TestBodyWithAJSONObjectAndAReasoningEffort(t *testing.T) {
	body, _ := New(Config{Model: "m", ResponseFormat: FormatJSONObject, ReasoningEffort: "low"}, nil).Body(request())
	if !strings.Contains(string(body), `"response_format":{"type":"json_object"}`) ||
		!strings.Contains(string(body), `"reasoning_effort":"low"`) {
		t.Fatalf("body: %s", body)
	}
}

func TestGenerateSendsTheKeyInTheHeaderAndReturnsTheText(t *testing.T) {
	var path, auth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path, auth = r.URL.Path, r.Header.Get("Authorization")
		_, _ = io.Copy(io.Discard, r.Body)
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":" {\"summary\":\"Vas bien.\",\"steps\":[]} "},"finish_reason":"stop"}],"usage":{"prompt_tokens":900,"completion_tokens":40}}`))
	}))
	defer srv.Close()

	m := New(Config{BaseURL: srv.URL + "/v1beta/openai/", APIKey: "test-key", Model: "gemini-4-hydrogen"}, srv.Client())
	resp, err := m.Generate(context.Background(), request())
	if err != nil {
		t.Fatal(err)
	}
	if path != "/v1beta/openai/chat/completions" || auth != "Bearer test-key" {
		t.Fatalf("path %q auth %q", path, auth)
	}
	if resp.Text != `{"summary":"Vas bien.","steps":[]}` || resp.InputTokens != 900 || resp.OutputTokens != 40 ||
		resp.ModelID != "gemini-4-hydrogen" {
		t.Fatalf("got %+v", resp)
	}
}

func TestGenerateReportsTheProviderErrorWithoutTheKey(t *testing.T) {
	for name, body := range map[string]string{
		"object": `{"error":{"code":429,"message":"Resource has been exhausted","status":"RESOURCE_EXHAUSTED"}}`,
		"array":  `[{"error":{"code":429,"message":"Resource has been exhausted","status":"RESOURCE_EXHAUSTED"}}]`,
	} {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte(body))
		}))
		_, err := New(Config{BaseURL: srv.URL, APIKey: "secret-key", Model: "m"}, srv.Client()).
			Generate(context.Background(), request())
		srv.Close()
		if err == nil || !strings.Contains(err.Error(), "429") || !strings.Contains(err.Error(), "exhausted") {
			t.Fatalf("%s: want the 429 message, got %v", name, err)
		}
		if strings.Contains(err.Error(), "secret-key") {
			t.Fatalf("%s: the error must never carry the key: %v", name, err)
		}
	}
}

func TestGenerateFailsWithoutKeyEmptyAnswerOrNoChoices(t *testing.T) {
	if _, err := New(Config{BaseURL: GeminiBaseURL, Model: "m"}, nil).Generate(context.Background(), request()); err == nil {
		t.Fatal("want an error without an API key")
	}
	for _, body := range []string{
		`{"choices":[{"message":{"content":"  "},"finish_reason":"length"}]}`,
		`{"choices":[]}`,
		`not json`,
	} {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte(body))
		}))
		_, err := New(Config{BaseURL: srv.URL, APIKey: "k", Model: "m"}, srv.Client()).
			Generate(context.Background(), request())
		srv.Close()
		if err == nil {
			t.Fatalf("want an error for %s", body)
		}
	}
}
