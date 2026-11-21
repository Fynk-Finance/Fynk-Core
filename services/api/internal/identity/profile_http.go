package identity

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/kcadmin"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
)

const (
	profileCacheTTL = 5 * time.Minute
	maxNameRunes    = 50
)

// profileAdmin is what the profile handlers need from the Keycloak admin client.
type profileAdmin interface {
	GetUser(ctx context.Context, id string) (kcadmin.User, error)
	PasswordUpdatedAt(ctx context.Context, id string) (time.Time, bool, error)
	UpdateNames(ctx context.Context, id, first, last string) error
}

func profileKey(sub string) string { return "identity:me:" + sub }

func adminUnavailable() httpapi.Problem {
	return prob(http.StatusServiceUnavailable, "identity_admin_unavailable", "Profile service unavailable", "")
}

func profileNotFound() httpapi.Problem {
	return prob(http.StatusNotFound, "profile_not_found", "Profile not found", "")
}

// validName trims the name and checks it: 1 to 50 letters (any script), combining marks,
// spaces, apostrophes, hyphens and periods, starting with a letter and ending with a letter or a combining mark.
func validName(s string) (string, bool) {
	s = strings.TrimSpace(s)
	n := utf8.RuneCountInString(s)
	if n == 0 || n > maxNameRunes {
		return "", false
	}
	runes := []rune(s)
	if last := runes[len(runes)-1]; !unicode.IsLetter(runes[0]) || (!unicode.IsLetter(last) && !unicode.IsMark(last)) {
		return "", false
	}
	for _, r := range runes {
		switch {
		case unicode.IsLetter(r), unicode.IsMark(r), r == ' ', r == '\'', r == '’', r == '-', r == '.':
		default:
			return "", false
		}
	}
	return s, true
}

// cacheGet returns the cached profile, if Redis is there and has it. Any failure is a miss.
func (s server) cacheGet(ctx context.Context, sub string) (httpapi.IdentityProfile, bool) {
	if s.cache == nil {
		return httpapi.IdentityProfile{}, false
	}
	raw, err := s.cache.Get(ctx, profileKey(sub)).Bytes()
	if err != nil {
		return httpapi.IdentityProfile{}, false
	}
	var p httpapi.IdentityProfile
	if json.Unmarshal(raw, &p) != nil {
		return httpapi.IdentityProfile{}, false
	}
	return p, true
}

// cachePut stores the masked profile. The full email never goes to Redis.
func (s server) cachePut(ctx context.Context, sub string, p httpapi.IdentityProfile) {
	if s.cache == nil {
		return
	}
	if raw, err := json.Marshal(p); err == nil {
		_ = s.cache.Set(ctx, profileKey(sub), raw, profileCacheTTL).Err()
	}
}

func (s server) cacheDrop(ctx context.Context, sub string) {
	if s.cache != nil {
		_ = s.cache.Del(ctx, profileKey(sub)).Err()
	}
}

func orNil(v string) *string {
	if v == "" {
		return nil
	}
	return &v
}

func toProfile(sub string, u kcadmin.User, pwd time.Time, hasPwd bool) httpapi.IdentityProfile {
	p := httpapi.IdentityProfile{
		Id: sub, Email: maskEmail(u.Email), FirstName: orNil(u.FirstName), LastName: orNil(u.LastName),
		EmailVerified: u.EmailVerified, CreatedAt: u.CreatedAt,
	}
	if hasPwd {
		p.PasswordUpdatedAt = &pwd
	}
	return p
}

func (s server) GetProfile(ctx context.Context, _ httpapi.GetProfileRequestObject) (httpapi.GetProfileResponseObject, error) {
	user, ok := auth.UserFrom(ctx)
	if !ok {
		return nil, errNoUser
	}
	if p, hit := s.cacheGet(ctx, user.ID); hit {
		return httpapi.GetProfile200JSONResponse(p), nil
	}
	if s.admin == nil {
		return httpapi.GetProfile503ApplicationProblemPlusJSONResponse(adminUnavailable()), nil
	}
	u, err := s.admin.GetUser(ctx, user.ID)
	var pwd time.Time
	var hasPwd bool
	if err == nil {
		pwd, hasPwd, err = s.admin.PasswordUpdatedAt(ctx, user.ID)
	}
	switch {
	case errors.Is(err, kcadmin.ErrNotFound):
		return httpapi.GetProfile404ApplicationProblemPlusJSONResponse(profileNotFound()), nil
	case err != nil:
		return httpapi.GetProfile503ApplicationProblemPlusJSONResponse(adminUnavailable()), nil
	}
	p := toProfile(user.ID, u, pwd, hasPwd)
	s.cachePut(ctx, user.ID, p)
	return httpapi.GetProfile200JSONResponse(p), nil
}

func (s server) UpdateProfile(ctx context.Context, req httpapi.UpdateProfileRequestObject) (httpapi.UpdateProfileResponseObject, error) {
	user, ok := auth.UserFrom(ctx)
	if !ok {
		return nil, errNoUser
	}
	invalid := func(field string) httpapi.UpdateProfileResponseObject {
		return httpapi.UpdateProfile400ApplicationProblemPlusJSONResponse(
			prob(http.StatusBadRequest, "invalid_profile", "Invalid profile", "The field "+field+" is invalid."))
	}
	if req.Body == nil || (req.Body.FirstName == nil && req.Body.LastName == nil) {
		return invalid("body"), nil
	}
	var first, last *string
	if req.Body.FirstName != nil {
		v, ok := validName(*req.Body.FirstName)
		if !ok {
			return invalid("firstName"), nil
		}
		first = &v
	}
	if req.Body.LastName != nil {
		v, ok := validName(*req.Body.LastName)
		if !ok {
			return invalid("lastName"), nil
		}
		last = &v
	}
	if s.admin == nil {
		return httpapi.UpdateProfile503ApplicationProblemPlusJSONResponse(adminUnavailable()), nil
	}
	u, err := s.admin.GetUser(ctx, user.ID)
	if err == nil {
		if first != nil {
			u.FirstName = *first
		}
		if last != nil {
			u.LastName = *last
		}
		err = s.admin.UpdateNames(ctx, user.ID, u.FirstName, u.LastName)
	}
	var pwd time.Time
	var hasPwd bool
	if err == nil {
		s.cacheDrop(ctx, user.ID)
		pwd, hasPwd, err = s.admin.PasswordUpdatedAt(ctx, user.ID)
	}
	switch {
	case errors.Is(err, kcadmin.ErrNotFound):
		return httpapi.UpdateProfile404ApplicationProblemPlusJSONResponse(profileNotFound()), nil
	case err != nil:
		return httpapi.UpdateProfile503ApplicationProblemPlusJSONResponse(adminUnavailable()), nil
	}
	return httpapi.UpdateProfile200JSONResponse(toProfile(user.ID, u, pwd, hasPwd)), nil
}
