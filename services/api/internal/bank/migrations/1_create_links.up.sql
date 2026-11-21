-- One row per bank link (M5 prompt). Never the bank token: only an HMAC fingerprint of the
-- refresh token, so the API can check that a refresh comes from the phone that holds it.
CREATE TABLE links (
  id                uuid PRIMARY KEY,
  user_id           text NOT NULL,
  device_id         uuid NOT NULL,
  provider          text NOT NULL,
  consent_id        uuid NOT NULL UNIQUE,
  token_fingerprint bytea NOT NULL CHECK (length(token_fingerprint) = 32),
  status            text NOT NULL CHECK (status IN ('active', 'revoked')),
  created_at        timestamptz NOT NULL,
  last_refreshed_at timestamptz,
  revoked_at        timestamptz,
  CHECK ((status = 'revoked') = (revoked_at IS NOT NULL))
);

CREATE INDEX links_user_id_idx ON links (user_id);
