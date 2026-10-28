-- Consent metadata is stored in clear on purpose, because it must be auditable.
-- It never holds financial data or tokens.
CREATE TABLE consent_texts (
  version      text PRIMARY KEY,
  body_md      text NOT NULL,
  sha256       bytea NOT NULL CHECK (length(sha256) = 32),
  published_at timestamptz NOT NULL
);

CREATE TABLE consents (
  id                  uuid PRIMARY KEY,
  user_id             text NOT NULL,
  device_id           uuid NOT NULL,
  provider            text NOT NULL,
  scopes              text[] NOT NULL CHECK (cardinality(scopes) > 0),
  purpose             text NOT NULL,
  term_days           int NOT NULL CHECK (term_days > 0),
  status              text NOT NULL CHECK (status IN ('pending', 'active', 'revoked', 'expired', 'failed')),
  text_version        text NOT NULL REFERENCES consent_texts (version),
  evidence            jsonb NOT NULL CHECK (evidence ?& ARRAY['text_sha256', 'accepted_at', 'device_id', 'app_version', 'locale']),
  provider_consent_id text,
  idempotency_key     text,
  created_at          timestamptz NOT NULL,
  granted_at          timestamptz,
  expires_at          timestamptz,
  revoked_at          timestamptz,
  revoked_reason      text,
  -- An active consent always has its grant, its term and the bank's consent id.
  CHECK (status <> 'active' OR (granted_at IS NOT NULL AND expires_at IS NOT NULL AND provider_consent_id IS NOT NULL))
);

CREATE INDEX consents_user_created_idx ON consents (user_id, created_at DESC);
CREATE INDEX consents_active_expiry_idx ON consents (expires_at) WHERE status = 'active';
CREATE UNIQUE INDEX consents_idempotency_idx ON consents (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
