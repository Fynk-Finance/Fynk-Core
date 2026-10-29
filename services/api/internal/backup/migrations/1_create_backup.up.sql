-- Everything here is ciphertext or wrapped keys: the server cannot decrypt any of it.
CREATE TABLE backup.records (
    user_id    text NOT NULL,
    collection text NOT NULL,
    record_id  uuid NOT NULL,
    version    bigint NOT NULL,
    deleted    boolean NOT NULL,
    nonce      bytea NOT NULL,
    ciphertext bytea NOT NULL,
    updated_at timestamptz NOT NULL,
    PRIMARY KEY (user_id, collection, record_id)
);

CREATE TABLE backup.recovery_keys (
    user_id           text PRIMARY KEY,
    wrapped_dek       bytea NOT NULL CHECK (octet_length(wrapped_dek) = 48),
    nonce             bytea NOT NULL CHECK (octet_length(nonce) = 12),
    salt              bytea NOT NULL CHECK (octet_length(salt) = 16),
    kdf               text NOT NULL,
    kdf_params        jsonb NOT NULL,
    device_proof_hash bytea NOT NULL CHECK (octet_length(device_proof_hash) = 32), -- SHA-256 of the proof, never returned
    created_at        timestamptz NOT NULL
);

CREATE TABLE backup.device_approvals (
    id                    uuid PRIMARY KEY,
    user_id               text NOT NULL,
    new_device_id         uuid NOT NULL,
    new_device_public_key bytea NOT NULL,
    status                text NOT NULL,
    ephemeral_public_key  bytea,
    wrapped_dek           bytea,
    nonce                 bytea,
    created_at            timestamptz NOT NULL,
    expires_at            timestamptz NOT NULL,
    decided_at            timestamptz
);

CREATE INDEX records_paging_idx ON backup.records (user_id, updated_at, record_id);
CREATE INDEX device_approvals_user_status_idx ON backup.device_approvals (user_id, status, expires_at);
CREATE INDEX device_approvals_new_device_idx ON backup.device_approvals (new_device_id);
