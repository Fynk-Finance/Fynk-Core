package backup

import (
	"context"
	"errors"
	"net/http"

	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/reset"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
)

// resetService is what the HTTP handler needs from reset.Service.
type resetService interface {
	Reset(ctx context.Context, user auth.User) error
}

func resetNotAllowed() httpapi.Problem {
	return prob(http.StatusForbidden, "reset_not_allowed", "Reset not allowed",
		"The password was not reset with the email code in the last 10 minutes.")
}

func (s server) ResetBackup(ctx context.Context, _ httpapi.ResetBackupRequestObject) (httpapi.ResetBackupResponseObject, error) {
	user, ok := auth.UserFrom(ctx)
	if !ok {
		return nil, errNoUser
	}
	err := s.reset.Reset(ctx, user)
	switch {
	case errors.Is(err, reset.ErrNotActive):
		return httpapi.ResetBackupdefaultApplicationProblemPlusJSONResponse{Body: notActive(), StatusCode: http.StatusForbidden}, nil
	case errors.Is(err, reset.ErrNotAllowed):
		return httpapi.ResetBackup403ApplicationProblemPlusJSONResponse(resetNotAllowed()), nil
	case err != nil:
		return nil, err
	}
	return httpapi.ResetBackup204Response{}, nil
}
