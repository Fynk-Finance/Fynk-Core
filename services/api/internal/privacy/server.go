package privacy

import (
	"context"
	"errors"
	"net/http"

	"github.com/google/uuid"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/privacy/http"
)

type dataExporter interface {
	Export(ctx context.Context, userID string) (httpapi.PrivacyDataExport, error)
}

type accountDeleter interface {
	DeleteAccount(ctx context.Context, user auth.User, req httpapi.PrivacyDeletionRequestCreate) (httpapi.PrivacyDeletionRequest, error)
	GetRequest(ctx context.Context, id uuid.UUID) (httpapi.PrivacyDeletionRequest, error)
}

type server struct {
	collector dataExporter
	deleter   accountDeleter
}

func (s server) PrivacyHealth(context.Context, httpapi.PrivacyHealthRequestObject) (httpapi.PrivacyHealthResponseObject, error) {
	return httpapi.PrivacyHealth200JSONResponse{Module: "privacy", Status: httpapi.Stub}, nil
}

func (s server) GetPrivacyPolicy(context.Context, httpapi.GetPrivacyPolicyRequestObject) (httpapi.GetPrivacyPolicyResponseObject, error) {
	policy := CurrentPolicy()
	return httpapi.GetPrivacyPolicy200JSONResponse(policy), nil
}

func (s server) GetMyData(ctx context.Context, _ httpapi.GetMyDataRequestObject) (httpapi.GetMyDataResponseObject, error) {
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

func (s server) CreateDeletionRequest(ctx context.Context, req httpapi.CreateDeletionRequestRequestObject) (httpapi.CreateDeletionRequestResponseObject, error) {
	user, ok := auth.UserFrom(ctx)
	if !ok || user.ID == "" {
		detail := "Authentication required to request account deletion"
		return httpapi.CreateDeletionRequest401ApplicationProblemPlusJSONResponse{
			Body: httpapi.Problem{
				Code:   "unauthorized",
				Detail: &detail,
				Status: http.StatusUnauthorized,
				Title:  "Unauthorized",
				Type:   "/problems/unauthorized",
			},
		}, nil
	}

	var body httpapi.PrivacyDeletionRequestCreate
	if req.Body != nil {
		body = *req.Body
	}

	res, err := s.deleter.DeleteAccount(ctx, user, body)
	if errors.Is(err, ErrFreshLoginRequired) {
		detail := "Account deletion requires re-authentication in the last 5 minutes"
		return httpapi.CreateDeletionRequest403ApplicationProblemPlusJSONResponse{
			Body: httpapi.Problem{
				Code:   "fresh_login_required",
				Detail: &detail,
				Status: http.StatusForbidden,
				Title:  "Fresh login required",
				Type:   "/problems/fresh-login-required",
			},
		}, nil
	}
	if errors.Is(err, ErrInvalidConfirmation) {
		detail := "Confirmation must be ELIMINAR"
		return httpapi.CreateDeletionRequest400ApplicationProblemPlusJSONResponse{
			Body: httpapi.Problem{
				Code:   "invalid_confirmation",
				Detail: &detail,
				Status: http.StatusBadRequest,
				Title:  "Invalid confirmation",
				Type:   "/problems/invalid-confirmation",
			},
		}, nil
	}
	if err != nil {
		return nil, err
	}

	return httpapi.CreateDeletionRequest202JSONResponse(res), nil
}

func (s server) GetDeletionRequest(ctx context.Context, req httpapi.GetDeletionRequestRequestObject) (httpapi.GetDeletionRequestResponseObject, error) {
	res, err := s.deleter.GetRequest(ctx, req.Id)
	if errors.Is(err, ErrDeletionNotFound) {
		detail := "Deletion request not found"
		return httpapi.GetDeletionRequest404ApplicationProblemPlusJSONResponse{
			Body: httpapi.Problem{
				Code:   "not_found",
				Detail: &detail,
				Status: http.StatusNotFound,
				Title:  "Not found",
				Type:   "/problems/not-found",
			},
		}, nil
	}
	if err != nil {
		return nil, err
	}

	return httpapi.GetDeletionRequest200JSONResponse(res), nil
}
