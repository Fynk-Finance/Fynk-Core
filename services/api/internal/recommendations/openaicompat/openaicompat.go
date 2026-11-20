// Package openaicompat is the advisor.Model adapter on any chat completions API compatible with
// OpenAI's (POST <base>/chat/completions). Google's Gemini API offers one, and so do Groq,
// OpenRouter and Ollama, so one adapter covers them all (ADR 0009). It is the alternative to
// Bedrock while the project's AWS account cannot invoke models.
//
// The answer is constrained to advisor.OutputSchema with response_format json_schema, or only
// to a JSON object with json_object for a provider that does not take the schema. Either way it
// goes through the same post checks as a Bedrock answer. The API key travels only in the
// Authorization header and is never logged.
package openaicompat

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/recommendations/advisor"
)

// GeminiBaseURL is the OpenAI compatible endpoint of the Gemini API (Google AI Studio keys).
const GeminiBaseURL = "https://generativelanguage.googleapis.com/v1beta/openai"

// Response formats.
const (
	FormatJSONSchema = "json_schema" // the output schema itself (default)
	FormatJSONObject = "json_object" // any JSON object; the prompt and the post checks do the rest
)

// Config of one provider.
type Config struct {
	BaseURL         string // for example GeminiBaseURL
	APIKey          string // secret, from the environment
	Model           string // for example gemini-3.5-flash-lite
	ResponseFormat  string // FormatJSONSchema (default) or FormatJSONObject
	ReasoningEffort string // optional: none, low, medium or high on models that think
}

// Model calls one model of the provider.
type Model struct {
	cfg    Config
	client *http.Client
}

// New returns the adapter. A nil client uses http.DefaultClient.
func New(cfg Config, client *http.Client) *Model {
	if client == nil {
		client = http.DefaultClient
	}
	cfg.BaseURL = strings.TrimRight(cfg.BaseURL, "/")
	if cfg.ResponseFormat != FormatJSONObject {
		cfg.ResponseFormat = FormatJSONSchema
	}
	return &Model{cfg: cfg, client: client}
}

type message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type jsonSchema struct {
	Name   string          `json:"name"`
	Schema json.RawMessage `json:"schema"`
}

type responseFormat struct {
	Type       string      `json:"type"`
	JSONSchema *jsonSchema `json:"json_schema,omitempty"`
}

type chatRequest struct {
	Model           string         `json:"model"`
	Messages        []message      `json:"messages"`
	MaxTokens       int32          `json:"max_tokens"`
	Temperature     float32        `json:"temperature"`
	ResponseFormat  responseFormat `json:"response_format"`
	ReasoningEffort string         `json:"reasoning_effort,omitempty"`
}

type chatResponse struct {
	Choices []struct {
		Message      message `json:"message"`
		FinishReason string  `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
	} `json:"usage"`
}

// apiError is the error body; Gemini sometimes wraps it in an array.
type apiError struct {
	Error struct {
		Message string `json:"message"`
		Status  string `json:"status"`
	} `json:"error"`
}

// Body builds the chat completions request. Exported for tests.
func (m *Model) Body(req advisor.ModelRequest) ([]byte, error) {
	if !json.Valid(req.OutputSchema) {
		return nil, errors.New("output schema is not JSON")
	}
	format := responseFormat{Type: m.cfg.ResponseFormat}
	if format.Type == FormatJSONSchema {
		format.JSONSchema = &jsonSchema{Name: "write_recommendations", Schema: req.OutputSchema}
	}
	return json.Marshal(chatRequest{
		Model: m.cfg.Model,
		Messages: []message{
			{Role: "system", Content: req.System},
			{Role: "user", Content: req.User},
		},
		MaxTokens:       req.MaxTokens,
		Temperature:     req.Temperature,
		ResponseFormat:  format,
		ReasoningEffort: m.cfg.ReasoningEffort,
	})
}

// Generate makes one chat completion and returns the model's JSON text.
func (m *Model) Generate(ctx context.Context, req advisor.ModelRequest) (advisor.ModelResponse, error) {
	resp := advisor.ModelResponse{ModelID: m.cfg.Model}
	if m.cfg.APIKey == "" || m.cfg.BaseURL == "" {
		return resp, errors.New("openai compatible provider: no base URL or API key configured")
	}
	body, err := m.Body(req)
	if err != nil {
		return resp, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, m.cfg.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return resp, fmt.Errorf("chat request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+m.cfg.APIKey)
	httpResp, err := m.client.Do(httpReq)
	if err != nil {
		// The URL holds no secret; the key is only in the header.
		return resp, fmt.Errorf("chat completions: %w", err)
	}
	defer func() { _ = httpResp.Body.Close() }()

	raw, err := io.ReadAll(io.LimitReader(httpResp.Body, 1<<20))
	if err != nil {
		return resp, fmt.Errorf("chat answer: %w", err)
	}
	if httpResp.StatusCode != http.StatusOK {
		return resp, fmt.Errorf("chat completions: status %d: %s", httpResp.StatusCode, errorMessage(raw))
	}
	var out chatResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return resp, errors.New("chat answer is not JSON")
	}
	resp.InputTokens, resp.OutputTokens = out.Usage.PromptTokens, out.Usage.CompletionTokens
	if len(out.Choices) == 0 {
		return resp, errors.New("chat answer has no choices")
	}
	resp.Text = strings.TrimSpace(out.Choices[0].Message.Content)
	if resp.Text == "" {
		return resp, fmt.Errorf("empty answer (finish reason %q)", out.Choices[0].FinishReason)
	}
	return resp, nil
}

// errorMessage reads the provider's error message (long enough to name the quota), from an object or an array.
func errorMessage(raw []byte) string {
	var one apiError
	if json.Unmarshal(raw, &one) == nil && one.Error.Message != "" {
		return truncate(one.Error.Status + " " + one.Error.Message)
	}
	var many []apiError
	if json.Unmarshal(raw, &many) == nil && len(many) > 0 && many[0].Error.Message != "" {
		return truncate(many[0].Error.Status + " " + many[0].Error.Message)
	}
	return "no error message"
}

func truncate(s string) string {
	s = strings.TrimSpace(s)
	if len(s) > 600 {
		return s[:600] + "…"
	}
	return s
}
