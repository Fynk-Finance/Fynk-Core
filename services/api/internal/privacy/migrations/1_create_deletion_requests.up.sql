CREATE TABLE deletion_requests (
    id           uuid PRIMARY KEY,
    user_id_hash bytea NOT NULL CHECK (octet_length(user_id_hash) = 32),
    status       text NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed')),
    steps_done   text[] NOT NULL DEFAULT '{}',
    created_at   timestamptz NOT NULL,
    completed_at timestamptz
);

CREATE INDEX deletion_requests_user_id_hash_idx ON deletion_requests (user_id_hash);
