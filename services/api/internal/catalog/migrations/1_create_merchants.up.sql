-- The shared merchant catalog (M9 prompt, "Catalog backend"). Content only: no user data.
-- key is the merchant as the phone normalizes it (shared normalizeMerchant()); match_patterns are
-- normalized words that recognise it inside a movement description.
CREATE TABLE catalog.merchants (
    key             text        PRIMARY KEY CHECK (key <> ''),
    display_name    text        NOT NULL CHECK (display_name <> ''),
    category        text        NOT NULL,
    is_subscription boolean     NOT NULL,
    match_patterns  text[]      NOT NULL DEFAULT '{}',
    cancel_url      text        CHECK (cancel_url IS NULL OR cancel_url LIKE 'https://%'),
    cancel_steps    text[]      NOT NULL DEFAULT '{}',
    updated_at      timestamptz NOT NULL DEFAULT now()
);
