package recommendations

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"time"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/go-chi/chi/v5"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/recommendations/advisor"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/recommendations/bedrock"
	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/recommendations/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/recommendations/openaicompat"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/recommendations/prompt"
)

// Providers of the model. Bedrock is the default; Gemini and any OpenAI compatible API are the
// alternative while the AWS account cannot invoke Bedrock (ADR 0009).
const (
	providerBedrock = "bedrock"
	providerGemini  = "gemini" // OpenAI compatible endpoint of the Gemini API (Google AI Studio)
	providerOpenAI  = "openai" // any OpenAI compatible API: Groq, OpenRouter, Ollama…
)

// Settings of the module, read from the environment (Secrets Manager or task definition in AWS,
// .env locally). Bedrock uses the task role; the API key of Gemini or another provider is the
// only secret and is never logged.
type settings struct {
	Provider        string // RECOMMENDATIONS_PROVIDER: bedrock (default), gemini or openai
	ModelID         string // RECOMMENDATIONS_MODEL_ID, default amazon.nova-lite-v1:0, or gemini-4-hydrogen on Gemini
	Region          string // RECOMMENDATIONS_AWS_REGION, default AWS_REGION, default us-east-2
	BaseURL         string // RECOMMENDATIONS_API_BASE_URL, the Gemini endpoint by default on Gemini
	APIKey          string // RECOMMENDATIONS_API_KEY, or GEMINI_API_KEY on Gemini. Secret
	ResponseFormat  string // RECOMMENDATIONS_RESPONSE_FORMAT: json_schema (default) or json_object
	ReasoningEffort string // RECOMMENDATIONS_REASONING_EFFORT: low by default on Gemini; off leaves it out
	MaxTokens       int32  // RECOMMENDATIONS_MAX_TOKENS: 800 on Bedrock, 4096 on the others (thinking models spend tokens before they answer)
	DailyLimit      int64  // RECOMMENDATIONS_DAILY_LIMIT, default 10
}

func loadSettings(getenv func(string) string) settings {
	s := settings{
		Provider:        getenv("RECOMMENDATIONS_PROVIDER"),
		ModelID:         getenv("RECOMMENDATIONS_MODEL_ID"),
		Region:          getenv("RECOMMENDATIONS_AWS_REGION"),
		BaseURL:         getenv("RECOMMENDATIONS_API_BASE_URL"),
		APIKey:          getenv("RECOMMENDATIONS_API_KEY"),
		ResponseFormat:  getenv("RECOMMENDATIONS_RESPONSE_FORMAT"),
		ReasoningEffort: getenv("RECOMMENDATIONS_REASONING_EFFORT"),
		DailyLimit:      10,
	}
	switch s.Provider {
	case providerGemini:
		if s.BaseURL == "" {
			s.BaseURL = openaicompat.GeminiBaseURL
		}
		if s.APIKey == "" {
			s.APIKey = getenv("GEMINI_API_KEY")
		}
		if s.ModelID == "" {
			s.ModelID = "gemini-4-hydrogen"
		}
		if s.ReasoningEffort == "" {
			s.ReasoningEffort = "low" // short answers, well inside the 12 s of an attempt
		}
	case providerOpenAI:
	default:
		s.Provider = providerBedrock
	}
	if s.ReasoningEffort == "off" {
		s.ReasoningEffort = ""
	}
	if s.ModelID == "" {
		s.ModelID = "amazon.nova-lite-v1:0"
	}
	if s.Region == "" {
		s.Region = getenv("AWS_REGION")
	}
	if s.Region == "" {
		s.Region = "us-east-2"
	}
	if n, err := strconv.ParseInt(getenv("RECOMMENDATIONS_DAILY_LIMIT"), 10, 64); err == nil && n > 0 {
		s.DailyLimit = n
	}
	s.MaxTokens = 800
	if s.Provider != providerBedrock {
		s.MaxTokens = 4096
	}
	if n, err := strconv.ParseInt(getenv("RECOMMENDATIONS_MAX_TOKENS"), 10, 32); err == nil && n > 0 {
		s.MaxTokens = int32(n)
	}
	return s
}

// advisorConfig is the advisor configuration of cfg: the defaults with the model and the token
// budget of the provider.
func advisorConfig(cfg settings) advisor.Config {
	c := advisor.DefaultConfig(cfg.ModelID)
	c.MaxTokens = cfg.MaxTokens
	return c
}

// newModel picks the model of cfg.Provider. Every provider gets the same prompt, post checks and
// fallback; only who writes the text changes.
func newModel(cfg settings, log *slog.Logger) advisor.Model {
	if cfg.Provider != providerBedrock {
		if cfg.APIKey == "" || cfg.BaseURL == "" {
			log.Warn("recommendations: the model provider has no API key or base URL, answers will use the phone templates",
				"provider", cfg.Provider)
		} else {
			log.Info("recommendations: using an OpenAI compatible model", "provider", cfg.Provider, "model", cfg.ModelID)
		}
		return openaicompat.New(openaicompat.Config{
			BaseURL:         cfg.BaseURL,
			APIKey:          cfg.APIKey,
			Model:           cfg.ModelID,
			ResponseFormat:  cfg.ResponseFormat,
			ReasoningEffort: cfg.ReasoningEffort,
		}, &http.Client{})
	}
	awsCfg, err := awsconfig.LoadDefaultConfig(context.Background(), awsconfig.WithRegion(cfg.Region))
	if err != nil {
		log.Warn("recommendations: Bedrock is not configured, answers will use the phone templates", "error", err)
		return unavailable{err: err}
	}
	return bedrock.New(bedrockruntime.NewFromConfig(awsCfg), cfg.ModelID)
}

// unavailable is the model when Bedrock cannot be configured: every answer is fallback.
type unavailable struct{ err error }

func (u unavailable) Generate(context.Context, advisor.ModelRequest) (advisor.ModelResponse, error) {
	return advisor.ModelResponse{}, u.err
}

// New returns the recommendations module (M11): POST /recommendations behind auth.Require.
func New(d module.Deps) module.Module {
	log := d.Log
	if log == nil {
		log = slog.Default()
	}
	cfg := loadSettings(os.Getenv)

	model := newModel(cfg, log)

	var limiter advisor.RateLimiter
	if d.Redis != nil {
		limiter = dailyLimiter{rdb: d.Redis, limit: cfg.DailyLimit}
	}
	now := time.Now
	if d.Clock != nil {
		now = d.Clock.Now
	}
	svc := advisor.NewService(model, limiter, advisor.Prompt{Version: prompt.Version(), System: prompt.SystemES()},
		advisorConfig(cfg), now, log)

	return mod{Stub: module.Stub{ModuleName: "recommendations"}, deps: d, gen: svc}
}

type mod struct {
	module.Stub
	deps module.Deps
	gen  generator
}

// Routes mounts the server generated from the contract behind auth.Require and the snapshot
// guard.
func (m mod) Routes(r chi.Router) {
	strict := httpapi.NewStrictHandlerWithOptions(server{gen: m.gen}, nil, httpapi.StrictHTTPServerOptions{
		RequestErrorHandlerFunc:  problem.RequestError,
		ResponseErrorHandlerFunc: problem.ResponseErrorHandler(m.deps.Log),
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Use(strictSnapshot)
		httpapi.HandlerWithOptions(strict, httpapi.ChiServerOptions{
			BaseRouter:       g,
			ErrorHandlerFunc: problem.RequestError,
		})
	})
}
