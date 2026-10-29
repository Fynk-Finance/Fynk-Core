package domain

// Error is a rule the request broke. Code is the stable code of the problem response.
type Error struct {
	Code   string
	Detail string
}

func (e *Error) Error() string { return e.Code + ": " + e.Detail }

// Errors of the consent rules. Details never hold personal data.
var (
	ErrUnsupportedProvider    = &Error{"unsupported_provider", "The provider is not supported."}
	ErrInvalidScopes          = &Error{"invalid_scopes", "The scopes must be a non-empty subset of what the provider supports."}
	ErrPurposeMismatch        = &Error{"purpose_mismatch", "The purpose is not the one shown to the user."}
	ErrTermMismatch           = &Error{"term_mismatch", "The term is not the one shown to the user."}
	ErrUnknownTextVersion     = &Error{"unknown_text_version", "The consent text version is not known."}
	ErrTextMismatch           = &Error{"text_mismatch", "The accepted text does not match the published version."}
	ErrDeviceRequired         = &Error{"device_required", "The X-Device-Id header with the device id is required."}
	ErrMissingEvidence        = &Error{"missing_evidence", "The acceptance evidence is incomplete."}
	ErrMissingProviderConsent = &Error{"missing_provider_consent", "The provider consent id is required."}
	ErrNotPending             = &Error{"consent_not_pending", "Only a pending consent can be granted."}
	ErrNotFound               = &Error{"consent_not_found", "The consent does not exist."}
	ErrIdempotencyConflict    = &Error{"idempotency_conflict", "The Idempotency-Key was used for a different consent."}
	ErrNotRevocable           = &Error{"consent_not_revocable", "Only an active or pending consent can be revoked."}
	ErrAlreadyRevoked         = &Error{"consent_already_revoked", "The consent is already revoked."}
)
