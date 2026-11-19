// Package ollama is the advisor.Model adapter on a local Ollama server (POST /api/chat). It is
// the demo alternative to Bedrock when the AWS account cannot invoke models (ADR 0009): the
// model runs on the same computer as the API, so the aggregate snapshot never leaves it. The
// answer is constrained with Ollama's structured outputs (`format` set to advisor.OutputSchema),
// and it still goes through the same post checks as a Bedrock answer.
package ollama

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

// DefaultURL is where `ollama serve` listens.
const DefaultURL = "http://localhost:11434"

// Model calls one model of an Ollama server.
type Model struct {
	baseURL string
	model   string
	client  *http.Client
}

// New returns the adapter for model (for example qwen2.5:3b) on the server at baseURL.
func New(baseURL, model string, client *http.Client) *Model {
	if client == nil {
		client = http.DefaultClient
	}
	return &Model{baseURL: strings.TrimRight(baseURL, "/"), model: model, client: client}
}

type message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type options struct {
	Temperature float32 `json:"temperature"`
	NumPredict  int32   `json:"num_predict"`
}

type chatRequest struct {
	Model    string          `json:"model"`
	Messages []message       `json:"messages"`
	Stream   bool            `json:"stream"`
	Format   json.RawMessage `json:"format"`
	Options  options         `json:"options"`
}

type chatResponse struct {
	Message         message `json:"message"`
	PromptEvalCount int     `json:"prompt_eval_count"`
	EvalCount       int     `json:"eval_count"`
	Error           string  `json:"error"`
}

// Body builds the /api/chat request. Exported for tests.
func (m *Model) Body(req advisor.ModelRequest) ([]byte, error) {
	if !json.Valid(req.OutputSchema) {
		return nil, errors.New("output schema is not JSON")
	}
	return json.Marshal(chatRequest{
		Model: m.model,
		Messages: []message{
			{Role: "system", Content: req.System},
			{Role: "user", Content: req.User},
		},
		Format:  req.OutputSchema,
		Options: options{Temperature: req.Temperature, NumPredict: req.MaxTokens},
	})
}

// Generate makes one chat call and returns the model's JSON text.
func (m *Model) Generate(ctx context.Context, req advisor.ModelRequest) (advisor.ModelResponse, error) {
	resp := advisor.ModelResponse{ModelID: m.model}
	body, err := m.Body(req)
	if err != nil {
		return resp, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, m.baseURL+"/api/chat", bytes.NewReader(body))
	if err != nil {
		return resp, fmt.Errorf("ollama request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpResp, err := m.client.Do(httpReq)
	if err != nil {
		return resp, fmt.Errorf("ollama chat: %w", err)
	}
	defer func() { _ = httpResp.Body.Close() }()

	raw, err := io.ReadAll(io.LimitReader(httpResp.Body, 1<<20))
	if err != nil {
		return resp, fmt.Errorf("ollama answer: %w", err)
	}
	var out chatResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return resp, fmt.Errorf("ollama answer is not JSON (status %d)", httpResp.StatusCode)
	}
	if httpResp.StatusCode != http.StatusOK {
		return resp, fmt.Errorf("ollama chat: status %d: %s", httpResp.StatusCode, out.Error)
	}
	resp.InputTokens, resp.OutputTokens = out.PromptEvalCount, out.EvalCount
	resp.Text = strings.TrimSpace(out.Message.Content)
	if resp.Text == "" {
		return resp, errors.New("ollama: empty answer")
	}
	return resp, nil
}
