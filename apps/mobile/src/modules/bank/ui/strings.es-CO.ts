// Copy of the bank module (Spanish, Colombia).
import type { ProviderKind } from '../domain/provider';

export const bankStrings = {
  // ConectarBanco.html (Conectar banco).
  connect: {
    title: 'Conecta tu banco',
    subtitle: 'Elige tu entidad y autoriza la conexión en su portal.',
    // Not in the design: new, needs design review.
    loading: 'Cargando las entidades',
    error: 'No pudimos cargar las entidades. Intenta de nuevo.',
    empty: 'No hay entidades disponibles',
    emptyMessage: 'Por ahora no puedes conectar ninguna entidad. Intenta más tarde.',
    // Until M5 step 3 opens the entity's portal.
    ready: {
      title: 'Autorización registrada',
      message: (entity: string) => `Pronto podrás continuar en el portal de ${entity}.`,
      ok: 'Entendido',
    },
  },
  // ConectarBanco.html, the entity selector (M5).
  selector: {
    label: 'Banco o billetera digital',
    kind: { bank: 'Banco', wallet: 'Billetera digital' } satisfies Record<ProviderKind, string>,
    // Not in the design: new, needs design review.
    openHint: 'Muestra las entidades que puedes conectar',
    selected: 'Seleccionada',
  },
} as const;
