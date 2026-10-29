package backup

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"regexp"

	"github.com/google/uuid"

	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/records"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

var collectionRE = regexp.MustCompile(`^[a-z]+\.[a-z_]+$`)

// recordsService is what the HTTP handlers need from records.Service.
type recordsService interface {
	Put(ctx context.Context, user auth.User, batch []records.Envelope) (int, error)
	List(ctx context.Context, user auth.User, cursor string, limit int) (records.Page, error)
}

func quotaExceeded() httpapi.Problem {
	return prob(http.StatusRequestEntityTooLarge, "quota_exceeded", "Backup quota exceeded",
		"The backup of this user would pass 5 MB.")
}

// limitBody caps the upload at records.MaxBodyBytes; a bigger body can never fit the quota.
func limitBody(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, records.MaxBodyBytes)
		next.ServeHTTP(w, r)
	})
}

// requestError answers 413 quota_exceeded for a body over the limit and 400 otherwise.
func requestError(w http.ResponseWriter, r *http.Request, err error) {
	var tooBig *http.MaxBytesError
	if errors.As(err, &tooBig) {
		v := quotaExceeded()
		problem.Write(w, problem.Problem{Type: v.Type, Title: v.Title, Status: int(v.Status), Code: v.Code, Detail: *v.Detail})
		return
	}
	problem.RequestError(w, r, err)
}

// strictB64 decodes standard padded base64 and returns the bytes, or false.
func strictB64(s string) ([]byte, bool) {
	b, err := base64.StdEncoding.Strict().DecodeString(s)
	return b, err == nil
}

// envelopes validates a batch. The error is the name of the offending field, never a value.
func envelopes(in []httpapi.BackupRecordEnvelope) ([]records.Envelope, string) {
	if len(in) < 1 || len(in) > records.MaxBatch {
		return nil, "records"
	}
	out := make([]records.Envelope, len(in))
	seen := make(map[string]bool, len(in))
	for i, e := range in {
		field := func(name string) string { return fmt.Sprintf("records[%d].%s", i, name) }
		id := e.RecordId.String()
		key := e.Collection + "/" + id
		nonce, okN := strictB64(e.Nonce)
		ct, okC := strictB64(e.Ciphertext)
		switch {
		case len(e.Collection) > records.MaxCollection || !collectionRE.MatchString(e.Collection):
			return nil, field("collection")
		case e.Version < 1:
			return nil, field("version")
		case !okN || len(nonce) != records.NonceSize:
			return nil, field("nonce")
		case !okC || len(ct) < records.MinCiphertext || len(ct) > records.MaxCiphertext:
			return nil, field("ciphertext")
		case seen[key]:
			return nil, field("recordId")
		}
		seen[key] = true
		out[i] = records.Envelope{Collection: e.Collection, RecordID: id, Version: e.Version,
			Deleted: e.Deleted, Nonce: nonce, Ciphertext: ct}
	}
	return out, ""
}

func (s server) PutBackupRecords(ctx context.Context, req httpapi.PutBackupRecordsRequestObject) (httpapi.PutBackupRecordsResponseObject, error) {
	user, ok := auth.UserFrom(ctx)
	if !ok {
		return nil, errNoUser
	}
	if req.Body == nil {
		return httpapi.PutBackupRecords400ApplicationProblemPlusJSONResponse(invalid("body")), nil
	}
	batch, bad := envelopes(req.Body.Records)
	if bad != "" {
		return httpapi.PutBackupRecords400ApplicationProblemPlusJSONResponse(invalid(bad)), nil
	}
	n, err := s.records.Put(ctx, user, batch)
	switch {
	case errors.Is(err, records.ErrNotActive):
		return httpapi.PutBackupRecords403ApplicationProblemPlusJSONResponse{BackupDeviceNotActiveApplicationProblemPlusJSONResponse: httpapi.BackupDeviceNotActiveApplicationProblemPlusJSONResponse(notActive())}, nil
	case errors.Is(err, records.ErrStale):
		return httpapi.PutBackupRecords409ApplicationProblemPlusJSONResponse(prob(http.StatusConflict, "stale_version",
			"Stale version", "A record has a lower version than the stored one.")), nil
	case errors.Is(err, records.ErrQuota):
		return httpapi.PutBackupRecords413ApplicationProblemPlusJSONResponse(quotaExceeded()), nil
	case err != nil:
		return nil, err
	}
	return httpapi.PutBackupRecords200JSONResponse{Accepted: n}, nil
}

func (s server) GetBackupRecords(ctx context.Context, req httpapi.GetBackupRecordsRequestObject) (httpapi.GetBackupRecordsResponseObject, error) {
	user, ok := auth.UserFrom(ctx)
	if !ok {
		return nil, errNoUser
	}
	bad := func(field string) (httpapi.GetBackupRecordsResponseObject, error) {
		return httpapi.GetBackupRecordsdefaultApplicationProblemPlusJSONResponse{Body: invalid(field), StatusCode: http.StatusBadRequest}, nil
	}
	limit, cursor := records.DefaultLimit, ""
	if req.Params.Limit != nil {
		limit = *req.Params.Limit
	}
	if limit < 1 || limit > records.MaxLimit {
		return bad("limit")
	}
	if req.Params.UpdatedAfter != nil {
		cursor = *req.Params.UpdatedAfter
	}
	if len(cursor) > records.MaxCursorChars {
		return bad("updatedAfter")
	}
	page, err := s.records.List(ctx, user, cursor, limit)
	switch {
	case errors.Is(err, records.ErrBadCursor):
		return bad("updatedAfter")
	case errors.Is(err, records.ErrNotActive):
		return httpapi.GetBackupRecords403ApplicationProblemPlusJSONResponse{BackupDeviceNotActiveApplicationProblemPlusJSONResponse: httpapi.BackupDeviceNotActiveApplicationProblemPlusJSONResponse(notActive())}, nil
	case err != nil:
		return nil, err
	}
	enc := base64.StdEncoding.EncodeToString
	out := httpapi.BackupRecordsPage{Records: make([]httpapi.BackupStoredRecord, len(page.Records))}
	for i, r := range page.Records {
		id, perr := uuid.Parse(r.RecordID)
		if perr != nil {
			return nil, errors.New("backup: stored record id is not a uuid")
		}
		out.Records[i] = httpapi.BackupStoredRecord{Collection: r.Collection, RecordId: id, Version: r.Version,
			Deleted: r.Deleted, Nonce: enc(r.Nonce), Ciphertext: enc(r.Ciphertext), UpdatedAt: r.UpdatedAt}
	}
	if page.Next != "" {
		out.NextCursor = &page.Next
	}
	return httpapi.GetBackupRecords200JSONResponse(out), nil
}
