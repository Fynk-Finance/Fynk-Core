package identity

import (
	"context"
	"encoding/base64"
	"errors"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/devices"
	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

// errNoUser means a handler ran without auth.Require in front of it. It is a wiring bug (500).
var errNoUser = errors.New("identity: no authenticated user in the request context")

// deviceService is what the HTTP handlers need from devices.Service.
type deviceService interface {
	Register(ctx context.Context, user auth.User, in devices.RegisterInput, idempotencyKey string) (devices.Device, bool, error)
	List(ctx context.Context, userID string) ([]devices.Device, error)
	Current(ctx context.Context, user auth.User, deviceID string) (devices.Device, error)
	Remove(ctx context.Context, userID, deviceID string) (string, error)
	RemoveOthers(ctx context.Context, userID, currentDeviceID string) ([]string, error)
}

// server implements the generated httpapi.StrictServerInterface.
// Revoking the Keycloak sessions that Remove and RemoveOthers return comes with the session
// revoker wiring; for now the ids are dropped.
type server struct{ devices deviceService }

var _ httpapi.StrictServerInterface = server{}

var invalidFields = map[string]bool{"name": true, "platform": true, "publicKey": true}

func prob(status int, code, title, detail string) httpapi.Problem {
	v := problem.New(status, code, title, detail)
	out := httpapi.Problem{Type: v.Type, Title: v.Title, Status: int32(v.Status), Code: v.Code}
	if detail != "" {
		out.Detail = &detail
	}
	return out
}

func notFound() httpapi.Problem {
	return prob(http.StatusNotFound, "device_not_found", "Device not found", "")
}

func removed() httpapi.Problem {
	return prob(http.StatusGone, "device_removed", "Device removed", "")
}

// invalidDetail names the failing field, never its value.
func invalidDetail(err error) string {
	if f, ok := strings.CutPrefix(err.Error(), devices.ErrInvalid.Error()+": "); ok && invalidFields[f] {
		return "The field " + f + " is invalid."
	}
	return "The device data is invalid."
}

func toAPI(d devices.Device, currentID string) httpapi.IdentityDevice {
	id, _ := uuid.Parse(d.ID)
	return httpapi.IdentityDevice{
		Id: id, Name: d.Name,
		Platform:   httpapi.IdentityDevicePlatform(d.Platform),
		Status:     httpapi.IdentityDeviceStatus(d.Status),
		Current:    currentID != "" && strings.EqualFold(currentID, d.ID),
		CreatedAt:  d.CreatedAt,
		LastSeenAt: d.LastSeenAt,
	}
}

// decodeKey accepts only standard base64 with padding of exactly 32 bytes.
func decodeKey(s string) ([]byte, bool) {
	if len(s) != base64.StdEncoding.EncodedLen(devices.PublicKeySize) {
		return nil, false
	}
	b, err := base64.StdEncoding.Strict().DecodeString(s)
	if err != nil || len(b) != devices.PublicKeySize {
		return nil, false
	}
	return b, true
}

func (s server) RegisterDevice(ctx context.Context, req httpapi.RegisterDeviceRequestObject) (httpapi.RegisterDeviceResponseObject, error) {
	user, ok := auth.UserFrom(ctx)
	if !ok {
		return nil, errNoUser
	}
	invalid := func(field string) httpapi.RegisterDeviceResponseObject {
		return httpapi.RegisterDevice400ApplicationProblemPlusJSONResponse(
			prob(http.StatusBadRequest, "invalid_device", "Invalid device", "The field "+field+" is invalid."))
	}
	if req.Body == nil {
		return invalid("body"), nil
	}
	key, ok := decodeKey(req.Body.PublicKey)
	if !ok {
		return invalid("publicKey"), nil
	}
	idem := ""
	if req.Params.IdempotencyKey != nil {
		idem = *req.Params.IdempotencyKey
	}
	dev, created, err := s.devices.Register(ctx, user, devices.RegisterInput{
		Name: req.Body.Name, Platform: devices.Platform(req.Body.Platform), PublicKey: key,
	}, idem)
	switch {
	case errors.Is(err, devices.ErrInvalid):
		return httpapi.RegisterDevice400ApplicationProblemPlusJSONResponse(
			prob(http.StatusBadRequest, "invalid_device", "Invalid device", invalidDetail(err))), nil
	case errors.Is(err, devices.ErrKeyRemoved):
		return httpapi.RegisterDevice409ApplicationProblemPlusJSONResponse(
			prob(http.StatusConflict, "device_key_removed", "Device key removed",
				"This device was removed. Create a new key pair and register again.")), nil
	case err != nil:
		return nil, err
	}
	if created {
		return httpapi.RegisterDevice201JSONResponse(toAPI(dev, "")), nil
	}
	return httpapi.RegisterDevice200JSONResponse(toAPI(dev, "")), nil
}

func (s server) ListDevices(ctx context.Context, req httpapi.ListDevicesRequestObject) (httpapi.ListDevicesResponseObject, error) {
	user, ok := auth.UserFrom(ctx)
	if !ok {
		return nil, errNoUser
	}
	list, err := s.devices.List(ctx, user.ID)
	if err != nil {
		return nil, err
	}
	cur := ""
	if req.Params.XDeviceId != nil {
		cur = *req.Params.XDeviceId
	}
	items := make([]httpapi.IdentityDevice, 0, len(list))
	for _, d := range list {
		items = append(items, toAPI(d, cur))
	}
	return httpapi.ListDevices200JSONResponse{Items: items}, nil
}

func (s server) GetCurrentDevice(ctx context.Context, req httpapi.GetCurrentDeviceRequestObject) (httpapi.GetCurrentDeviceResponseObject, error) {
	user, ok := auth.UserFrom(ctx)
	if !ok {
		return nil, errNoUser
	}
	dev, err := s.devices.Current(ctx, user, req.Params.XDeviceId)
	switch {
	case errors.Is(err, devices.ErrNotFound):
		return httpapi.GetCurrentDevice404ApplicationProblemPlusJSONResponse(notFound()), nil
	case errors.Is(err, devices.ErrRemoved):
		return httpapi.GetCurrentDevice410ApplicationProblemPlusJSONResponse(removed()), nil
	case err != nil:
		return nil, err
	}
	return httpapi.GetCurrentDevice200JSONResponse(toAPI(dev, req.Params.XDeviceId)), nil
}

func (s server) RemoveDevice(ctx context.Context, req httpapi.RemoveDeviceRequestObject) (httpapi.RemoveDeviceResponseObject, error) {
	user, ok := auth.UserFrom(ctx)
	if !ok {
		return nil, errNoUser
	}
	_, err := s.devices.Remove(ctx, user.ID, req.DeviceId.String())
	switch {
	case errors.Is(err, devices.ErrNotFound):
		return httpapi.RemoveDevice404ApplicationProblemPlusJSONResponse(notFound()), nil
	case err != nil:
		return nil, err
	}
	return httpapi.RemoveDevice204Response{}, nil
}

func (s server) SignOutOtherDevices(ctx context.Context, req httpapi.SignOutOtherDevicesRequestObject) (httpapi.SignOutOtherDevicesResponseObject, error) {
	user, ok := auth.UserFrom(ctx)
	if !ok {
		return nil, errNoUser
	}
	_, err := s.devices.RemoveOthers(ctx, user.ID, req.Params.XDeviceId)
	switch {
	case errors.Is(err, devices.ErrNotFound):
		return httpapi.SignOutOtherDevices404ApplicationProblemPlusJSONResponse(notFound()), nil
	case errors.Is(err, devices.ErrRemoved):
		return httpapi.SignOutOtherDevices410ApplicationProblemPlusJSONResponse(removed()), nil
	case err != nil:
		return nil, err
	}
	return httpapi.SignOutOtherDevices204Response{}, nil
}
