package recommendations

import (
	"context"
	"log/slog"
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
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/recommendations/prompt"
)

// Settings of the module, read from the environment (Secrets Manager or task definition in AWS,
// .env locally). None of them is a secret: Bedrock uses the task role.
type settings struct {
	ModelID    string // RECOMMENDATIONS_MODEL_ID, default amazon.nova-lite-v1:0
	Region     string // RECOMMENDATIONS_AWS_REGION, default AWS_REGION, default us-east-1
	DailyLimit int64  // RECOMMENDATIONS_DAILY_LIMIT, default 10
}

func loadSettings(getenv func(string) string) settings {
	s := settings{ModelID: getenv("RECOMMENDATIONS_MODEL_ID"), Region: getenv("RECOMMENDATIONS_AWS_REGION"), DailyLimit: 10}
	if s.ModelID == "" {
		s.ModelID = "amazon.nova-lite-v1:0"
	}
	if s.Region == "" {
		s.Region = getenv("AWS_REGION")
	}
	if s.Region == "" {
		s.Region = "us-east-1"
	}
	if n, err := strconv.ParseInt(getenv("RECOMMENDATIONS_DAILY_LIMIT"), 10, 64); err == nil && n > 0 {
		s.DailyLimit = n
	}
	return s
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

	var model advisor.Model
	awsCfg, err := awsconfig.LoadDefaultConfig(context.Background(), awsconfig.WithRegion(cfg.Region))
	if err != nil {
		log.Warn("recommendations: Bedrock is not configured, answers will use the phone templates", "error", err)
		model = unavailable{err: err}
	} else {
		model = bedrock.New(bedrockruntime.NewFromConfig(awsCfg), cfg.ModelID)
	}

	var limiter advisor.RateLimiter
	if d.Redis != nil {
		limiter = dailyLimiter{rdb: d.Redis, limit: cfg.DailyLimit}
	}
	now := time.Now
	if d.Clock != nil {
		now = d.Clock.Now
	}
	svc := advisor.NewService(model, limiter, advisor.Prompt{Version: prompt.Version(), System: prompt.SystemES()},
		advisor.DefaultConfig(cfg.ModelID), now, log)

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
