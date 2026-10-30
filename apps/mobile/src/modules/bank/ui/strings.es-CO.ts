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
  },
  // After "Ir al portal de <Entidad>" (HU-009). Not in the design: new, needs design review.
  link: {
    linking: (entity: string) => `Conectando con ${entity}`,
    linkingMessage: (entity: string) => `Termina la autorización en el portal de ${entity}.`,
    linked: (entity: string) => `${entity} conectada`,
    linkedMessage: 'Estas son las cuentas que compartirá con Fynk.',
    noAccounts: (entity: string) => `${entity} no tiene cuentas para compartir con Fynk.`,
    accountsLater: 'Traeremos tus cuentas en la próxima actualización.',
    done: 'Listo',
    retry: 'Intentar de nuevo',
    denied: {
      title: 'No autorizaste la conexión',
      message: (entity: string) => `En el portal de ${entity} no se aprobó el acceso.`,
    },
    failedTitle: 'No pudimos conectar tu cuenta',
    failed: {
      state_mismatch: (entity: string) =>
        `No pudimos confirmar que la respuesta venga de ${entity}. Intenta de nuevo.`,
      bank_error: (entity: string) => `${entity} no pudo completar la autorización.`,
      expired: () => 'La autorización tardó demasiado. Empieza de nuevo.',
      already_linked: () => 'Esta autorización ya se usó. Empieza de nuevo.',
      unavailable: (entity: string) => `${entity} no está disponible en este momento.`,
      offline: () => 'No tienes conexión a internet. Revísala e intenta de nuevo.',
      device_required: () =>
        'Este teléfono no está registrado en tu cuenta. Inicia sesión de nuevo.',
      unknown: () => 'Algo salió mal. Intenta de nuevo.',
    },
  },
  // OnbCuentas.html, the rows of the connected accounts and "Agregar otra cuenta".
  list: {
    connected: 'Conectada',
    addAccount: 'Agregar otra cuenta',
    kind: {
      savings: 'Cuenta de ahorros',
      checking: 'Cuenta corriente',
      wallet: 'Billetera digital',
      credit_card: 'Tarjeta de crédito',
      cdt: 'CDT',
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
