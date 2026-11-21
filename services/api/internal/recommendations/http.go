package recommendations

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/recommendations/advisor"
	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/recommendations/http"
)

// generator is what the handler needs from advisor.Service.
type generator interface {
	Generate(ctx context.Context, userID string, req advisor.Request) (advisor.Result, error)
}

type snapshotKey struct{}

// strictSnapshot validates the raw body before the generated server parses it: at most 16 KB,
// no field outside the contract, a valid snapshot. The generated types would silently drop
// unknown fields, so this is where raw movements are kept out. The valid request travels in
// the context to the handler.
func strictSnapshot(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The group of this middleware has only POST /recommendations.
		if r.Method != http.MethodPost {
			next.ServeHTTP(w, r)
			return
		}
		req, raw, err := advisor.Decode(r.Body)
		if err != nil {
			problem.Write(w, problem.New(http.StatusBadRequest, "invalid_snapshot", "Invalid snapshot",
				"The body must be an aggregate snapshot of at most 16 KB with only the fields of the contract."))
			return
		}
		r = r.WithContext(context.WithValue(r.Context(), snapshotKey{}, req))
		r.Body = newBody(raw)
		next.ServeHTTP(w, r)
	})
}

type server struct {
	gen generator
}

func prob(status int, code, title string) httpapi.Problem {
	v := problem.New(status, code, title, "")
	return httpapi.Problem{Type: v.Type, Title: v.Title, Status: int32(v.Status), Code: v.Code}
}

// CreateRecommendations implements httpapi.StrictServerInterface.
func (s server) CreateRecommendations(ctx context.Context, _ httpapi.CreateRecommendationsRequestObject) (httpapi.CreateRecommendationsResponseObject, error) {
	req, ok := ctx.Value(snapshotKey{}).(advisor.Request)
	if !ok {
		return httpapi.CreateRecommendations400ApplicationProblemPlusJSONResponse(
			prob(http.StatusBadRequest, "invalid_snapshot", "Invalid snapshot")), nil
	}
	user, _ := auth.UserFrom(ctx)
	res, err := s.gen.Generate(ctx, user.ID, req)
	if errors.Is(err, advisor.ErrRateLimited) {
		return httpapi.CreateRecommendations429ApplicationProblemPlusJSONResponse(
			prob(http.StatusTooManyRequests, "rate_limited", "Too many requests")), nil
	}
	if err != nil {
		return nil, err
	}
	steps := make([]httpapi.RecommendationsStep, 0, len(res.Steps))
	for _, st := range res.Steps {
		steps = append(steps, httpapi.RecommendationsStep{FactKey: st.FactKey, Title: st.Title, Text: st.Text})
	}
	return httpapi.CreateRecommendations200JSONResponse{
		Summary:       res.Summary,
		Steps:         steps,
		Fallback:      res.Fallback,
		ModelId:       res.ModelID,
		PromptVersion: res.PromptVersion,
		SnapshotHash:  res.SnapshotHash,
		GeneratedAt:   res.GeneratedAt.UTC().Truncate(time.Second),
	}, nil
}
