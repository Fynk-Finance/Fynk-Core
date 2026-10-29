-- Weekly average CDT rates published by Banco de la República. Public market data, no user data.
CREATE TABLE market.cdt_reference (
    week        date        NOT NULL,
    term_days   integer     NOT NULL CHECK (term_days > 0),
    rate_ea_bps integer     NOT NULL CHECK (rate_ea_bps > 0 AND rate_ea_bps <= 10000),
    source_url  text        NOT NULL,
    fetched_at  timestamptz NOT NULL,
    PRIMARY KEY (week, term_days)
);
