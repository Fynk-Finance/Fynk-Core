package backup

import (
	"context"
	"encoding/base64"
	"errors"
	"net/http"

	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/recovery"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

// errNoUser means a handler ran without auth.Require in front of it. It is a wiring bug (500).
var errNoUser = errors.New("backup: no authenticated user in the request context")

// recoveryService is what the HTTP handlers need from recovery.Service.
type recoveryService interface {
	Set(ctx context.Context, user auth.User, k recovery.Key) error
	Get(ctx context.Context, user auth.User) (recovery.Key, error)
	Activate(ctx context.Context, user auth.User, proof []byte) error
}

// server implements the recovery key and record operations of the generated interface. The embedded
// interface is nil on purpose: Routes mounts only the operations implemented here, so the
// others can never be reached through it (they answer 501 through the module stub).
type server struct {
	httpapi.StrictServerInterface
	recovery recoveryService
	records  recordsService
}

func prob(status int, code, title, detail string) httpapi.Problem {
	v := problem.New(status, code, title, detail)
	out := httpapi.Problem{Type: v.Type, Title: v.Title, Status: int32(v.Status), Code: v.Code}
	if detail != "" {
		out.Detail = &detail
	}
	return out
}

func notActive() httpapi.Problem {
	return prob(http.StatusForbidden, "device_not_active", "Device not active",
		"This device is not allowed to do this.")
}

func invalid(field string) httpapi.Problem {
	return prob(http.StatusBadRequest, "invalid_request", "Invalid request", "The field "+field+" is invalid.")
}

func noKey() httpapi.Problem {
	return prob(http.StatusNotFound, "recovery_key_not_found", "Recovery key not found", "")
}

// decode accepts only standard base64 with padding of exactly size bytes.
func decode(s string, size int) ([]byte, bool) {
	if len(s) != base64.StdEncoding.EncodedLen(size) {
		return nil, false
	}
	b, err := base64.StdEncoding.Strict().DecodeString(s)
	return b, err == nil && len(b) == size
}

func (s server) PutBackupRecoveryKey(ctx context.Context, req httpapi.PutBackupRecoveryKeyRequestObject) (httpapi.PutBackupRecoveryKeyResponseObject, error) {
	user, ok := auth.UserFrom(ctx)
	if !ok {
		return nil, errNoUser
	}
	bad := func(field string) (httpapi.PutBackupRecoveryKeyResponseObject, error) {
		return httpapi.PutBackupRecoveryKey400ApplicationProblemPlusJSONResponse(invalid(field)), nil
	}
	b := req.Body
	if b == nil {
		return bad("body")
	}
	k := recovery.Key{KDF: string(b.Kdf), MemoryKiB: int(b.KdfParams.MemoryKiB),
		Iterations: int(b.KdfParams.Iterations), Parallelism: int(b.KdfParams.Parallelism)}
	fields := []struct {
		name string
		in   string
		size int
		dst  *[]byte
	}{
		{"wrappedDek", b.WrappedDek, recovery.WrappedDEKSize, &k.WrappedDEK},
		{"nonce", b.Nonce, recovery.NonceSize, &k.Nonce},
		{"salt", b.Salt, recovery.SaltSize, &k.Salt},
		{"deviceProofHash", b.DeviceProofHash, recovery.ProofSize, &k.ProofHash},
	}
	for _, f := range fields {
		v, ok := decode(f.in, f.size)
		if !ok {
			return bad(f.name)
		}
		*f.dst = v
	}
	if k.KDF != recovery.KDF {
		return bad("kdf")
	}
	if k.MemoryKiB != recovery.MemoryKiB || k.Iterations != recovery.Iterations || k.Parallelism != recovery.Parallelism {
		return bad("kdfParams")
	}
	err := s.recovery.Set(ctx, user, k)
	switch {
	case errors.Is(err, recovery.ErrNotActive):
		return httpapi.PutBackupRecoveryKey403ApplicationProblemPlusJSONResponse{
			BackupDeviceNotActiveApplicationProblemPlusJSONResponse: httpapi.BackupDeviceNotActiveApplicationProblemPlusJSONResponse(notActive())}, nil
	case err != nil:
		return nil, err
	}
	return httpapi.PutBackupRecoveryKey204Response{}, nil
}

func (s server) GetBackupRecoveryKey(ctx context.Context, _ httpapi.GetBackupRecoveryKeyRequestObject) (httpapi.GetBackupRecoveryKeyResponseObject, error) {
	user, ok := auth.UserFrom(ctx)
	if !ok {
		return nil, errNoUser
	}
	k, err := s.recovery.Get(ctx, user)
	switch {
	case errors.Is(err, recovery.ErrNotActive):
		return httpapi.GetBackupRecoveryKey403ApplicationProblemPlusJSONResponse{BackupDeviceNotActiveApplicationProblemPlusJSONResponse: httpapi.BackupDeviceNotActiveApplicationProblemPlusJSONResponse(notActive())}, nil
	case errors.Is(err, recovery.ErrNoKey):
		return httpapi.GetBackupRecoveryKey404ApplicationProblemPlusJSONResponse(noKey()), nil
	case err != nil:
		return nil, err
	}
	enc := base64.StdEncoding.EncodeToString
	return httpapi.GetBackupRecoveryKey200JSONResponse{
		WrappedDek: enc(k.WrappedDEK), Nonce: enc(k.Nonce), Salt: enc(k.Salt),
		Kdf: httpapi.BackupRecoveryKeyKdf(k.KDF),
		KdfParams: httpapi.BackupKdfParams{
			MemoryKiB:   httpapi.BackupKdfParamsMemoryKiB(k.MemoryKiB),
			Iterations:  httpapi.BackupKdfParamsIterations(k.Iterations),
			Parallelism: httpapi.BackupKdfParamsParallelism(k.Parallelism),
		},
		CreatedAt: k.CreatedAt,
	}, nil
}

func (s server) ActivateWithRecoveryKey(ctx context.Context, req httpapi.ActivateWithRecoveryKeyRequestObject) (httpapi.ActivateWithRecoveryKeyResponseObject, error) {
	user, ok := auth.UserFrom(ctx)
	if !ok {
		return nil, errNoUser
	}
	var proof []byte
	if req.Body != nil {
		proof, ok = decode(req.Body.DeviceProof, recovery.ProofSize)
	}
	if !ok || req.Body == nil {
		return httpapi.ActivateWithRecoveryKey400ApplicationProblemPlusJSONResponse(invalid("deviceProof")), nil
	}
	err := s.recovery.Activate(ctx, user, proof)
	switch {
	case errors.Is(err, recovery.ErrNotActive):
		return httpapi.ActivateWithRecoveryKey403ApplicationProblemPlusJSONResponse{BackupDeviceNotActiveApplicationProblemPlusJSONResponse: httpapi.BackupDeviceNotActiveApplicationProblemPlusJSONResponse(notActive())}, nil
	case errors.Is(err, recovery.ErrRemoved):
		return httpapi.ActivateWithRecoveryKey410ApplicationProblemPlusJSONResponse(
			prob(http.StatusGone, "device_removed", "Device removed", "")), nil
	case errors.Is(err, recovery.ErrNoKey):
		return httpapi.ActivateWithRecoveryKey404ApplicationProblemPlusJSONResponse(noKey()), nil
	case errors.Is(err, recovery.ErrTooMany):
		return httpapi.ActivateWithRecoveryKey429ApplicationProblemPlusJSONResponse(
			prob(http.StatusTooManyRequests, "too_many_attempts", "Too many attempts", "Try again later.")), nil
	case errors.Is(err, recovery.ErrMismatch):
		return httpapi.ActivateWithRecoveryKey422ApplicationProblemPlusJSONResponse(
			prob(http.StatusUnprocessableEntity, "proof_mismatch", "Proof mismatch", "")), nil
	case err != nil:
		return nil, err
	}
	return httpapi.ActivateWithRecoveryKey204Response{}, nil
}
