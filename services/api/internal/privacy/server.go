package privacy

import (
	"context"
	"net/http"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/privacy/http"
)

type dataExporter interface {
	Export(ctx context.Context, userID string) (httpapi.PrivacyDataExport, error)
}

type server struct {
	collector dataExporter
}

func (s server) PrivacyHealth(context.Context, httpapi.PrivacyHealthRequestObject) (httpapi.PrivacyHealthResponseObject, error) {
	return httpapi.PrivacyHealth200JSONResponse{Module: "privacy", Status: httpapi.Stub}, nil
}

func (s server) GetPrivacyPolicy(context.Context, httpapi.GetPrivacyPolicyRequestObject) (httpapi.GetPrivacyPolicyResponseObject, error) {
	policy := CurrentPolicy()
	return httpapi.GetPrivacyPolicy200JSONResponse(policy), nil
}

func (s server) GetMyData(ctx context.Context, req httpapi.GetMyDataRequestObject) (httpapi.GetMyDataResponseObject, error) {
	user, ok := auth.UserFrom(ctx)
	if !ok || user.ID == "" {
		detail := "Authentication required to export your personal data"
		return httpapi.GetMyData401ApplicationProblemPlusJSONResponse{
			ProblemApplicationProblemPlusJSONResponse: httpapi.ProblemApplicationProblemPlusJSONResponse{
				Body: httpapi.Problem{
					Code:   "unauthorized",
					Detail: &detail,
					Status: http.StatusUnauthorized,
					Title:  "Unauthorized",
					Type:   "/problems/unauthorized",
				},
			},
		}, nil
	}

	export, err := s.collector.Export(ctx, user.ID)
	if err != nil {
		return nil, err
	}
	return httpapi.GetMyData200JSONResponse(export), nil
}
