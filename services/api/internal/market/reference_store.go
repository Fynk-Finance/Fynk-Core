package market

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/market/reference"
)

// pgReferenceStore is reference.Store on market.cdt_reference.
type pgReferenceStore struct{ db *pgxpool.Pool }

func (s pgReferenceStore) Latest(ctx context.Context, termDays int) (reference.Rate, bool, error) {
	var r reference.Rate
	err := s.db.QueryRow(ctx, `
		SELECT week, term_days, rate_ea_bps, source_url, fetched_at
		FROM market.cdt_reference WHERE term_days = $1
		ORDER BY week DESC, fetched_at DESC LIMIT 1`, termDays).
		Scan(&r.Week, &r.TermDays, &r.RateEaBps, &r.SourceURL, &r.FetchedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return reference.Rate{}, false, nil
	}
	if err != nil {
		return reference.Rate{}, false, err
	}
	return r, true, nil
}

func (s pgReferenceStore) Save(ctx context.Context, r reference.Rate) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO market.cdt_reference (week, term_days, rate_ea_bps, source_url, fetched_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (week, term_days) DO UPDATE SET
			rate_ea_bps = EXCLUDED.rate_ea_bps,
			source_url = EXCLUDED.source_url,
			fetched_at = EXCLUDED.fetched_at`,
		r.Week, r.TermDays, r.RateEaBps, r.SourceURL, r.FetchedAt)
	return err
}
