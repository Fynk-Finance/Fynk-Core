package bancolombia

import (
	"context"
	"fmt"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
)

// Accounts implements ports.Provider.
func (a *Adapter) Accounts(context.Context, string) ([]ports.Account, error) {
	return nil, fmt.Errorf("bancolombia: accounts: %w", ports.ErrProviderUnavailable)
}

// Transactions implements ports.Provider.
func (a *Adapter) Transactions(context.Context, string, string, time.Time, string) (ports.TxPage, error) {
	return ports.TxPage{}, fmt.Errorf("bancolombia: transactions: %w", ports.ErrProviderUnavailable)
}
