package bancolombia

import (
	"context"
	"fmt"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
)

// PushAuthorization implements ports.Provider. The consent and the PAR come in the next layer.
func (a *Adapter) PushAuthorization(context.Context, ports.PARRequest) (ports.PARResult, error) {
	return ports.PARResult{}, fmt.Errorf("bancolombia: par: %w", ports.ErrProviderUnavailable)
}
