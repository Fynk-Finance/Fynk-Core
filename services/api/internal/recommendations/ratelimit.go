package recommendations

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

// dailyLimiter allows `limit` requests per user and Bogotá day, counted in Redis.
type dailyLimiter struct {
	rdb   *redis.Client
	limit int64
}

var bogota = time.FixedZone("America/Bogota", -5*60*60)

func limiterKey(userID string, now time.Time) string {
	return "recommendations:rl:" + userID + ":" + now.In(bogota).Format("2006-01-02")
}

// Allow counts this request and reports whether it is within the limit.
func (l dailyLimiter) Allow(ctx context.Context, userID string, now time.Time) (bool, error) {
	key := limiterKey(userID, now)
	pipe := l.rdb.TxPipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, 26*time.Hour)
	if _, err := pipe.Exec(ctx); err != nil {
		return false, err
	}
	return incr.Val() <= l.limit, nil
}
