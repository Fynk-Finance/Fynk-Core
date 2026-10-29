package backup

import (
	"context"
	"encoding/base64"
	"errors"
	"net/http"

	"github.com/google/uuid"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/approvals"
	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
)

// approvalsService is what the HTTP handlers need from approvals.Service.
type approvalsService interface {
	Create(ctx context.Context, user auth.User, key string) (approvals.Approval, error)
	Pending(ctx context.Context, user auth.User) ([]approvals.Open, error)
	Get(ctx context.Context, user auth.User, id string) (approvals.View, error)
	Approve(ctx context.Context, user auth.User, id string, g approvals.Grant) (approvals.Approval, error)
	Reject(ctx context.Context, user auth.User, id string) (approvals.Approval, error)
}

func approvalNotFound() httpapi.Problem {
	return prob(http.StatusNotFound, "approval_not_found", "Approval not found", "")
}

func approvalNotPending() httpapi.Problem {
	return prob(http.StatusConflict, "approval_not_pending", "Approval not pending", "")
}

func approvalExpired() httpapi.Problem {
	return prob(http.StatusGone, "approval_expired", "Approval expired", "")
}

func alreadyActive() httpapi.Problem {
	return prob(http.StatusConflict, "device_already_active", "Device already active", "")
}

// approvalBody is the BackupDeviceApproval of a request. A stored id that is not a UUID is a bug (500).
func approvalBody(a approvals.Approval) (httpapi.BackupDeviceApproval, error) {
	id, err := uuid.Parse(a.ID)
	if err != nil {
		return httpapi.BackupDeviceApproval{}, errors.New("backup: stored approval id is not a uuid")
	}
	return httpapi.BackupDeviceApproval{Id: id, Status: httpapi.BackupApprovalState(a.Status),
		CreatedAt: a.CreatedAt, ExpiresAt: a.ExpiresAt}, nil
}

func (s server) CreateDeviceApproval(ctx context.Context, req httpapi.CreateDeviceApprovalRequestObject) (httpapi.CreateDeviceApprovalResponseObject, error) {
	user, ok := auth.UserFrom(ctx)
	if !ok {
		return nil, errNoUser
	}
	key := ""
	if req.Params.IdempotencyKey != nil {
		key = *req.Params.IdempotencyKey
	}
	if len(key) > approvals.MaxIdempotency {
		return httpapi.CreateDeviceApprovaldefaultApplicationProblemPlusJSONResponse{Body: invalid("Idempotency-Key"), StatusCode: http.StatusBadRequest}, nil
	}
	a, err := s.approvals.Create(ctx, user, key)
	switch {
	case errors.Is(err, approvals.ErrNotActive):
		return httpapi.CreateDeviceApprovaldefaultApplicationProblemPlusJSONResponse{Body: notActive(), StatusCode: http.StatusForbidden}, nil
	case errors.Is(err, approvals.ErrAlreadyActive):
		return httpapi.CreateDeviceApproval409ApplicationProblemPlusJSONResponse(alreadyActive()), nil
	case err != nil:
		return nil, err
	}
	body, err := approvalBody(a)
	if err != nil {
		return nil, err
	}
	return httpapi.CreateDeviceApproval201JSONResponse(body), nil
}

func (s server) ListPendingDeviceApprovals(ctx context.Context, _ httpapi.ListPendingDeviceApprovalsRequestObject) (httpapi.ListPendingDeviceApprovalsResponseObject, error) {
	user, ok := auth.UserFrom(ctx)
	if !ok {
		return nil, errNoUser
	}
	open, err := s.approvals.Pending(ctx, user)
	switch {
	case errors.Is(err, approvals.ErrNotActive):
		return httpapi.ListPendingDeviceApprovals403ApplicationProblemPlusJSONResponse{BackupDeviceNotActiveApplicationProblemPlusJSONResponse: httpapi.BackupDeviceNotActiveApplicationProblemPlusJSONResponse(notActive())}, nil
	case err != nil:
		return nil, err
	}
	out := httpapi.BackupPendingApprovalList{Approvals: make([]httpapi.BackupPendingApproval, len(open))}
	for i, o := range open {
		id, perr := uuid.Parse(o.ID)
		if perr != nil {
			return nil, errors.New("backup: stored approval id is not a uuid")
		}
		out.Approvals[i] = httpapi.BackupPendingApproval{Id: id, DeviceName: o.DeviceName,
			Platform:           httpapi.BackupPendingApprovalPlatform(o.Platform),
			NewDevicePublicKey: base64.StdEncoding.EncodeToString(o.NewDevicePublicKey),
			CreatedAt:          o.CreatedAt, ExpiresAt: o.ExpiresAt}
	}
	return httpapi.ListPendingDeviceApprovals200JSONResponse(out), nil
}

func (s server) GetDeviceApproval(ctx context.Context, req httpapi.GetDeviceApprovalRequestObject) (httpapi.GetDeviceApprovalResponseObject, error) {
	user, ok := auth.UserFrom(ctx)
	if !ok {
		return nil, errNoUser
	}
	v, err := s.approvals.Get(ctx, user, req.Id.String())
	switch {
	case errors.Is(err, approvals.ErrNotFound):
		return httpapi.GetDeviceApproval404ApplicationProblemPlusJSONResponse{BackupApprovalNotFoundApplicationProblemPlusJSONResponse: httpapi.BackupApprovalNotFoundApplicationProblemPlusJSONResponse(approvalNotFound())}, nil
	case err != nil:
		return nil, err
	}
	out := httpapi.BackupDeviceApprovalStatus{Id: req.Id, Status: httpapi.BackupApprovalState(v.Status), ExpiresAt: v.ExpiresAt}
	if v.Keys != nil {
		enc := base64.StdEncoding.EncodeToString
		e, w, n := enc(v.Keys.EphemeralPublicKey), enc(v.Keys.WrappedDEK), enc(v.Keys.Nonce)
		out.EphemeralPublicKey, out.WrappedDek, out.Nonce = &e, &w, &n
	}
	return httpapi.GetDeviceApproval200JSONResponse(out), nil
}

func (s server) ApproveDeviceApproval(ctx context.Context, req httpapi.ApproveDeviceApprovalRequestObject) (httpapi.ApproveDeviceApprovalResponseObject, error) {
	user, ok := auth.UserFrom(ctx)
	if !ok {
		return nil, errNoUser
	}
	bad := func(field string) (httpapi.ApproveDeviceApprovalResponseObject, error) {
		return httpapi.ApproveDeviceApproval400ApplicationProblemPlusJSONResponse(invalid(field)), nil
	}
	if req.Body == nil {
		return bad("body")
	}
	var g approvals.Grant
	fields := []struct {
		name string
		in   string
		size int
		dst  *[]byte
	}{
		{"ephemeralPublicKey", req.Body.EphemeralPublicKey, approvals.EphemeralKeySize, &g.EphemeralPublicKey},
		{"wrappedDek", req.Body.WrappedDek, approvals.WrappedDEKSize, &g.WrappedDEK},
		{"nonce", req.Body.Nonce, approvals.NonceSize, &g.Nonce},
	}
	for _, f := range fields {
		v, ok := decode(f.in, f.size)
		if !ok {
			return bad(f.name)
		}
		*f.dst = v
	}
	a, err := s.approvals.Approve(ctx, user, req.Id.String(), g)
	switch {
	case errors.Is(err, approvals.ErrNotActive):
		return httpapi.ApproveDeviceApproval403ApplicationProblemPlusJSONResponse{BackupDeviceNotActiveApplicationProblemPlusJSONResponse: httpapi.BackupDeviceNotActiveApplicationProblemPlusJSONResponse(notActive())}, nil
	case errors.Is(err, approvals.ErrNotFound):
		return httpapi.ApproveDeviceApproval404ApplicationProblemPlusJSONResponse{BackupApprovalNotFoundApplicationProblemPlusJSONResponse: httpapi.BackupApprovalNotFoundApplicationProblemPlusJSONResponse(approvalNotFound())}, nil
	case errors.Is(err, approvals.ErrNotPending):
		return httpapi.ApproveDeviceApproval409ApplicationProblemPlusJSONResponse{BackupApprovalNotPendingApplicationProblemPlusJSONResponse: httpapi.BackupApprovalNotPendingApplicationProblemPlusJSONResponse(approvalNotPending())}, nil
	case errors.Is(err, approvals.ErrExpired):
		return httpapi.ApproveDeviceApproval410ApplicationProblemPlusJSONResponse{BackupApprovalExpiredApplicationProblemPlusJSONResponse: httpapi.BackupApprovalExpiredApplicationProblemPlusJSONResponse(approvalExpired())}, nil
	case err != nil:
		return nil, err
	}
	body, err := approvalBody(a)
	if err != nil {
		return nil, err
	}
	return httpapi.ApproveDeviceApproval200JSONResponse(body), nil
}

func (s server) RejectDeviceApproval(ctx context.Context, req httpapi.RejectDeviceApprovalRequestObject) (httpapi.RejectDeviceApprovalResponseObject, error) {
	user, ok := auth.UserFrom(ctx)
	if !ok {
		return nil, errNoUser
	}
	a, err := s.approvals.Reject(ctx, user, req.Id.String())
	switch {
	case errors.Is(err, approvals.ErrNotActive):
		return httpapi.RejectDeviceApproval403ApplicationProblemPlusJSONResponse{BackupDeviceNotActiveApplicationProblemPlusJSONResponse: httpapi.BackupDeviceNotActiveApplicationProblemPlusJSONResponse(notActive())}, nil
	case errors.Is(err, approvals.ErrNotFound):
		return httpapi.RejectDeviceApproval404ApplicationProblemPlusJSONResponse{BackupApprovalNotFoundApplicationProblemPlusJSONResponse: httpapi.BackupApprovalNotFoundApplicationProblemPlusJSONResponse(approvalNotFound())}, nil
	case errors.Is(err, approvals.ErrNotPending):
		return httpapi.RejectDeviceApproval409ApplicationProblemPlusJSONResponse{BackupApprovalNotPendingApplicationProblemPlusJSONResponse: httpapi.BackupApprovalNotPendingApplicationProblemPlusJSONResponse(approvalNotPending())}, nil
	case errors.Is(err, approvals.ErrExpired):
		return httpapi.RejectDeviceApproval410ApplicationProblemPlusJSONResponse{BackupApprovalExpiredApplicationProblemPlusJSONResponse: httpapi.BackupApprovalExpiredApplicationProblemPlusJSONResponse(approvalExpired())}, nil
	case err != nil:
		return nil, err
	}
	body, err := approvalBody(a)
	if err != nil {
		return nil, err
	}
	return httpapi.RejectDeviceApproval200JSONResponse(body), nil
}
