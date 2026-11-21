CREATE TABLE identity.devices (
    id              uuid PRIMARY KEY,
    user_id         text NOT NULL,
    name            text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 64),
    platform        text NOT NULL CHECK (platform IN ('ios', 'android')),
    public_key      bytea NOT NULL CHECK (octet_length(public_key) = 32), -- X25519, used by M2 device approval
    status          text NOT NULL CHECK (status IN ('pending', 'active', 'removed')),
    session_id      text,            -- Keycloak sid of the device's session, revoked when removed
    idempotency_key text,            -- Idempotency-Key of the POST that created it
    created_at      timestamptz NOT NULL,
    last_seen_at    timestamptz NOT NULL,
    UNIQUE (user_id, public_key),
    UNIQUE (user_id, idempotency_key)
);

CREATE INDEX devices_user_id_idx ON identity.devices (user_id);
