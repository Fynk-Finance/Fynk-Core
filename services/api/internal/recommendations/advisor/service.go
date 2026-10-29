package advisor

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"time"
)

// ModelRequest is one call to the LLM: the versioned system prompt, the user message with the
// snapshot, and the JSON schema the answer must follow.
type ModelRequest struct {
	System       string
	User         string
	OutputSchema json.RawMessage
	MaxTokens    int32
	Temperature  float32
}

// ModelResponse is the model's answer and what the logs keep about it.
type ModelResponse struct {
	Text         string
	ModelID      string
	InputTokens  int
	OutputTokens int
}

// Model writes text. Bedrock in staging and production, a fake in tests.
type Model interface {
	Generate(ctx context.Context, req ModelRequest) (ModelResponse, error)
}

// RateLimiter allows a number of requests per user and day.
type RateLimiter interface {
	Allow(ctx context.Context, userID string, now time.Time) (bool, error)
}

// ErrRateLimited is returned when the user already asked too many times today.
var ErrRateLimited = errors.New("rate limited")

// Prompt is the versioned system prompt.
type Prompt struct {
	Version string
	System  string
}

// Result is the answer of POST /recommendations.
type Result struct {
	Summary       string
	Steps         []Step
	Fallback      bool // true: the phone shows its fixed templates
	ModelID       string
	PromptVersion string
	SnapshotHash  string
	GeneratedAt   time.Time
}

// Config of the service.
type Config struct {
	ModelID     string
	MaxTokens   int32   // 800
	Temperature float32 // 0.2
	Attempts    int     // 2: the first call and one retry
}

// DefaultConfig is the configuration of docs/modules/M11-recommendations.md.
func DefaultConfig(modelID string) Config {
	return Config{ModelID: modelID, MaxTokens: 800, Temperature: 0.2, Attempts: 2}
}

// Service generates recommendations. It stores nothing: the snapshot is in transit only.
type Service struct {
	model   Model
	limiter RateLimiter
	prompt  Prompt
	cfg     Config
	now     func() time.Time
	log     *slog.Logger
}

// NewService builds the service. limiter may be nil (no limit, local only).
func NewService(model Model, limiter RateLimiter, prompt Prompt, cfg Config, now func() time.Time, log *slog.Logger) *Service {
	if log == nil {
		log = slog.Default()
	}
	if cfg.Attempts < 1 {
		cfg.Attempts = 1
	}
	return &Service{model: model, limiter: limiter, prompt: prompt, cfg: cfg, now: now, log: log}
}

// userMessage is what the model sees: only the snapshot and the keys to write about.
func userMessage(req Request) string {
	b, _ := json.Marshal(struct {
		Snapshot Snapshot `json:"snapshot"`
		FactKeys []string `json:"factKeys"`
	}{req.Snapshot, req.FactKeys})
	return "Datos agregados del usuario (JSON). Escribe el resumen y un paso por cada factKey:\n" + string(b)
}

// Generate makes one model call, checks it, retries once on a bad answer, and otherwise returns
// fallback so the phone shows its templates. Every number on screen still comes from the phone.
func (s *Service) Generate(ctx context.Context, userID string, req Request) (Result, error) {
	now := s.now()
	if s.limiter != nil {
		ok, err := s.limiter.Allow(ctx, userID, now)
		if err != nil {
			// Redis down must not block the feature: log and continue.
			s.log.WarnContext(ctx, "recommendations rate limiter unavailable", "error", err)
		} else if !ok {
			return Result{}, ErrRateLimited
		}
	}

	hash := req.Snapshot.Hash()
	base := Result{
		ModelID:       s.cfg.ModelID,
		PromptVersion: s.prompt.Version,
		SnapshotHash:  hash,
		GeneratedAt:   now,
	}
	mreq := ModelRequest{
		System:       s.prompt.System,
		User:         userMessage(req),
		OutputSchema: OutputSchema,
		MaxTokens:    s.cfg.MaxTokens,
		Temperature:  s.cfg.Temperature,
	}

	for attempt := 1; attempt <= s.cfg.Attempts; attempt++ {
		started := time.Now()
		resp, err := s.model.Generate(ctx, mreq)
		latency := time.Since(started)
		outcome := "ok"
		var out Output
		if err == nil {
			out, err = ParseOutput(resp.Text)
		}
		if err == nil {
			err = Check(out, req)
		}
		if err != nil {
			outcome = "rejected"
			if !errors.Is(err, ErrUnsafeOutput) {
				outcome = "model_error"
			}
		}
		// Only the hash, the model and the counts reach the logs: never the snapshot or the text.
		s.log.InfoContext(ctx, "recommendations generated",
			"snapshot_hash", hash, "model_id", resp.ModelID, "attempt", attempt, "outcome", outcome,
			"input_tokens", resp.InputTokens, "output_tokens", resp.OutputTokens,
			"latency_ms", latency.Milliseconds())
		if err == nil {
			res := base
			if resp.ModelID != "" {
				res.ModelID = resp.ModelID
			}
			res.Summary = out.Summary
			res.Steps = out.Steps
			return res, nil
		}
		if ctx.Err() != nil {
			break
		}
	}
	res := base
	res.Fallback = true
	res.Steps = []Step{}
	return res, nil
}

// OutputSchema is the JSON schema of Output, sent to the model as the only tool it may call.
var OutputSchema = json.RawMessage(`{
  "type": "object",
  "additionalProperties": false,
  "required": ["summary", "steps"],
  "properties": {
    "summary": { "type": "string", "maxLength": 400 },
    "steps": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["factKey", "title", "text"],
        "properties": {
          "factKey": { "type": "string" },
          "title": { "type": "string", "maxLength": 40 },
          "text": { "type": "string", "maxLength": 160 }
        }
      }
    }
  }
}`)
