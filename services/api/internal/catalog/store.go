package catalog

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// pgStore is Store on catalog.merchants.
type pgStore struct{ db *pgxpool.Pool }

func (s pgStore) List(ctx context.Context) ([]Merchant, error) {
	rows, err := s.db.Query(ctx, `
		SELECT key, display_name, category, is_subscription, match_patterns, cancel_url,
		       cancel_steps, updated_at
		FROM catalog.merchants ORDER BY key`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Merchant{}
	for rows.Next() {
		var m Merchant
		if err := rows.Scan(&m.Key, &m.DisplayName, &m.Category, &m.IsSubscription,
			&m.MatchPatterns, &m.CancelURL, &m.CancelSteps, &m.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}
