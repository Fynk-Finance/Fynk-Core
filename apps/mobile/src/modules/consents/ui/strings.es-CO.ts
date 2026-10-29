// Copy of the consents module (Spanish, Colombia).
import type { ConsentErrorKind, ConsentScope, ConsentStatus } from '../domain/consent';

export const consentsStrings = {
  // ConectarBanco.html, the consent part (M4). The header and the entity selector are M5's.
  scopeCard: {
    shares: (entity: string) => `${entity} compartirá con Fynk`,
    scopes: {
      balances: { title: 'Saldos', detail: 'Saldo disponible de tus cuentas y tarjetas' },
      transactions: { title: 'Movimientos', detail: 'Ingresos y gastos de los últimos 12 meses' },
      account_details: {
        title: 'Datos de la cuenta',
        detail: 'Tipo de cuenta, nombre del titular y últimos 4 dígitos',
      },
    } satisfies Record<ConsentScope, { title: string; detail: string }>,
    never: 'Fynk nunca podrá',
    neverItems: [
      'Ver ni guardar tu clave del banco',
      'Mover tu dinero, hacer pagos o transferencias',
    ],
    // Decided copy (M04 prompt, HU-011) instead of the design's "Los datos se actualizan cada día."
    footer:
      'Puedes revocar el acceso cuando quieras desde Mi cuenta. Se actualizan cada vez que abres Fynk o deslizas para actualizar.',
  },
  checkbox: {
    before: 'Autorizo a Fynk a consultar y tratar estos datos según la ',
    policy: 'Política de privacidad',
    after: '.',
    label: 'Autorizo a Fynk a consultar y tratar estos datos',
    policyHint: 'Abre la Política de privacidad',
  },
  goToPortal: (entity: string) => `Ir al portal de ${entity}`,
  goToPortalHint: 'Registra tu autorización y te lleva al portal de la entidad',
  // Not in the design: new, needs design review.
  errors: {
    text_changed: 'La autorización cambió. Revísala y vuelve a aceptarla.',
    device:
      'Este teléfono aún no está registrado en Fynk. Cierra y abre la app e intenta de nuevo.',
    provider: 'Esta entidad no está disponible por ahora. Intenta más tarde.',
    network: 'No pudimos conectarnos. Revisa tu internet e intenta de nuevo.',
    unknown: 'No pudimos registrar tu autorización. Intenta de nuevo.',
  } satisfies Record<ConsentErrorKind, string>,
  // Consentimientos: new screens built from "Cuentas conectadas" of CfgPrivacidad.html and the
  // cards of ConectarBanco.html. Needs design review.
  list: {
    title: 'Consentimientos',
    subtitle: 'Las entidades que comparten datos con Fynk y por cuánto tiempo.',
    back: 'Volver',
    section: 'Tus consentimientos',
    sectionMeta: 'Acceso de solo lectura',
    empty: 'Aún no has conectado ninguna entidad',
    emptyMessage: 'Cuando conectes un banco o billetera, verás aquí su autorización.',
    connect: 'Conectar banco',
    error: 'No pudimos cargar tus consentimientos. Intenta de nuevo.',
    openHint: 'Abre el detalle del consentimiento',
  },
  status: {
    active: 'Activo',
    pending: 'Pendiente',
    revoked: 'Revocado',
    expired: 'Vencido',
    failed: 'Fallido',
  } satisfies Record<ConsentStatus, string>,
  dates: {
    granted: (date: string) => `Otorgado el ${date}`,
    requested: (date: string) => `Solicitado el ${date}`,
    expires: (date: string) => `Vence el ${date}`,
    expired: (date: string) => `Venció el ${date}`,
    revoked: (date: string) => `Revocado el ${date}`,
  },
  revoke: { chip: 'Revocar' },
  // A row for Mi cuenta (M1), offered until Privacidad y datos (M13) exists.
  miCuentaRow: { title: 'Consentimientos', subtitle: 'Entidades conectadas y sus permisos' },
} as const;
