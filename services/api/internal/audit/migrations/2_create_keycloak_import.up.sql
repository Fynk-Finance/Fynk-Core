CREATE TABLE keycloak_events_cursor (
  id int PRIMARY KEY DEFAULT 1,
  last_event_time timestamptz NOT NULL DEFAULT '1970-01-01 00:00:00+00',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_cursor_row CHECK (id = 1)
);

INSERT INTO keycloak_events_cursor (id, last_event_time)
VALUES (1, '1970-01-01 00:00:00+00');

CREATE TABLE keycloak_processed_events (
  event_id text PRIMARY KEY,
  event_time timestamptz NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX keycloak_processed_events_time_idx ON keycloak_processed_events (event_time);
