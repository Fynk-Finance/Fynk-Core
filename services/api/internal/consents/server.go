package consents

import (
	"context"
	"encoding/hex"
	"errors"
	"net/http"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/domain"
	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/service"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

// server implements the generated httpapi.StrictServerInterface.
type server struct {
	svc *service.Service
}

func (server) ConsentsHealth(context.Context, httpapi.ConsentsHealthRequestObject) (httpapi.ConsentsHealthResponseObject, error) {
	return httpapi.ConsentsHealth200JSONResponse{Module: "consents", Status: httpapi.Stub}, nil
}

func (s server) GetCurrentConsentText(ctx context.Context, _ httpapi.GetCurrentConsentTextRequestObject) (httpapi.GetCurrentConsentTextResponseObject, error) {
	t, err := s.svc.CurrentText(ctx)
	if err != nil {
		return nil, err
	}
	return httpapi.GetCurrentConsentText200JSONResponse{
		Version:     t.Version,
		BodyMd:      t.BodyMD,
		Sha256:      hex.EncodeToString(t.SHA256),
		PublishedAt: t.PublishedAt.UTC(),
		Purpose:     domain.Purpose,
		TermDays:    domain.TermDays,
	}, nil
}

func (s server) CreateConsent(ctx context.Context, req httpapi.CreateConsentRequestObject) (httpapi.CreateConsentResponseObject, error) {
	user, _ := auth.UserFrom(ctx)
	b := req.Body
	scopes := make([]domain.Scope, len(b.Scopes))
	for i, sc := range b.Scopes {
		scopes[i] = domain.Scope(sc)
	}
	key := ""
	if req.Params.IdempotencyKey != nil {
		key = *req.Params.IdempotencyKey
	}
	c, err := s.svc.Create(ctx, domain.Request{
		UserID:      user.ID,
		DeviceID:    user.DeviceID,
		Provider:    b.Provider,
		Scopes:      scopes,
		Purpose:     b.Purpose,
		TermDays:    int(b.TermDays),
		TextVersion: b.TextVersion,
		TextSHA256:  b.TextSha256,
		AppVersion:  b.AppVersion,
		Locale:      b.Locale,
	}, key)
	if err != nil {
		return nil, err
	}
	out, err := toAPI(c)
	return httpapi.CreateConsent201JSONResponse(out), err
}

func (s server) ListConsents(ctx context.Context, _ httpapi.ListConsentsRequestObject) (httpapi.ListConsentsResponseObject, error) {
	user, _ := auth.UserFrom(ctx)
	list, err := s.svc.List(ctx, user.ID)
	if err != nil {
		return nil, err
	}
	items := make([]httpapi.ConsentsConsent, 0, len(list))
	for _, c := range list {
		out, err := toAPI(c)
		if err != nil {
			return nil, err
		}
		items = append(items, out)
	}
	return httpapi.ListConsents200JSONResponse{Items: items}, nil
}

func (s server) GetConsent(ctx context.Context, req httpapi.GetConsentRequestObject) (httpapi.GetConsentResponseObject, error) {
	user, _ := auth.UserFrom(ctx)
	c, err := s.svc.Get(ctx, user.ID, req.Id.String())
	if err != nil {
		return nil, err
	}
	out, err := toAPI(c)
	return httpapi.GetConsent200JSONResponse(out), err
}

func (s server) RevokeConsent(ctx context.Context, req httpapi.RevokeConsentRequestObject) (httpapi.RevokeConsentResponseObject, error) {
	user, _ := auth.UserFrom(ctx)
	c, err := s.svc.Revoke(ctx, user.ID, req.Id.String())
	if err != nil {
		return nil, err
	}
	out, err := toAPI(c)
	return httpapi.RevokeConsent200JSONResponse(out), err
}

func toAPI(c domain.Consent) (httpapi.ConsentsConsent, error) {
	out := httpapi.ConsentsConsent{
		Provider:    c.Provider,
		Purpose:     c.Purpose,
		TermDays:    int32(c.TermDays),
		Status:      httpapi.ConsentsStatus(c.Status),
		TextVersion: c.TextVersion,
		CreatedAt:   c.CreatedAt.UTC(),
		AcceptedAt:  c.Evidence.AcceptedAt.UTC(),
		GrantedAt:   utc(c.GrantedAt),
		ExpiresAt:   utc(c.ExpiresAt),
		RevokedAt:   utc(c.RevokedAt),

		ProviderNotifiedAt: utc(c.ProviderNotifiedAt),
	}
	if err := out.Id.UnmarshalText([]byte(c.ID)); err != nil {
		return httpapi.ConsentsConsent{}, err
	}
	for _, sc := range c.Scopes {
		out.Scopes = append(out.Scopes, httpapi.ConsentsScope(sc))
	}
	return out, nil
}

func utc(t *time.Time) *time.Time {
	if t == nil {
		return nil
	}
	u := t.UTC()
	return &u
}

// errorHandler answers a broken consent rule with its own problem code, and anything else
// through fallback (500 without details).
func errorHandler(fallback func(http.ResponseWriter, *http.Request, error)) func(http.ResponseWriter, *http.Request, error) {
	return func(w http.ResponseWriter, r *http.Request, err error) {
		var rule *domain.Error
		if !errors.As(err, &rule) {
			fallback(w, r, err)
			return
		}
		status := http.StatusUnprocessableEntity
		switch rule {
		case domain.ErrNotFound:
			status = http.StatusNotFound
		case domain.ErrNotPending, domain.ErrNotRevocable:
			status = http.StatusConflict
		}
		problem.Write(w, problem.New(status, rule.Code, http.StatusText(status), rule.Detail))
	}
}
