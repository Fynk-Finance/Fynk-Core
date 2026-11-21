CREATE TABLE events (
  id bigint generated always as identity primary key,
  type text not null,
  user_id text,
  device_id uuid,
  at timestamptz not null,
  meta jsonb not null default '{}'::jsonb,
  prev_hash bytea not null,
  hash bytea not null
);

CREATE INDEX events_user_id_idx ON events (user_id);
CREATE INDEX events_at_idx ON events (at);

CREATE OR REPLACE FUNCTION prevent_event_modification()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit.events is append-only: updates and deletes are prohibited';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_event_modification
BEFORE UPDATE OR DELETE ON events
FOR EACH ROW
EXECUTE FUNCTION prevent_event_modification();

CREATE TRIGGER trg_prevent_event_truncate
BEFORE TRUNCATE ON events
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_event_modification();
