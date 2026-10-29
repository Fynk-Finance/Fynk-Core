// Copy of the bank module (Spanish, Colombia).
import type { ProviderKind } from '../domain/provider';

export const bankStrings = {
  // ConectarBanco.html, the entity selector (M5).
  selector: {
    label: 'Banco o billetera digital',
    kind: { bank: 'Banco', wallet: 'Billetera digital' } satisfies Record<ProviderKind, string>,
    // Not in the design: new, needs design review.
    openHint: 'Muestra las entidades que puedes conectar',
    selected: 'Seleccionada',
  },
} as const;
