// User facing copy of the accounts module (Spanish, Colombia).
import type { AccountKind } from '@shared/domain/types';

const kinds: Record<AccountKind, string> = {
  savings: 'Cuenta de ahorros',
  checking: 'Cuenta corriente',
  wallet: 'Billetera digital',
  credit_card: 'Tarjeta de crédito',
  cdt: 'CDT',
  cash: 'Efectivo',
};

export const accountsStrings = {
  cash: {
    // OnbCuentas, section Efectivo.
    label: '¿Cuánto tienes en efectivo?',
    placeholder: '0',
  },
  kinds,
  dashboard: {
    // Shown until M3 keeps the name the person typed in onboarding.
    guest: 'Invitado',
    balanceTotal: 'Balance total',
    connected: (n: number) => `COP · ${n} ${n === 1 ? 'cuenta conectada' : 'cuentas conectadas'}`,
    income: 'Ingresos',
    spending: 'Gastos',
    howTitle: 'Cómo se calcula',
    howMessage:
      'Sumamos el saldo de tus cuentas, billeteras y efectivo, y restamos lo que debes en tus ' +
      'tarjetas de crédito. Los CDT no se suman: los ves en Inversión.',
    ok: 'Entendido',
    showDetails: 'Ver detalle de cuentas',
    hideDetails: 'Ocultar detalle de cuentas',
    cashDetail: 'Registrado manualmente',
    noAccounts: 'Aún no tienes cuentas conectadas.',
    loadError: 'No pudimos cargar tus cuentas.',
  },
} as const;
