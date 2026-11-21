// How a subscription names its account or card: "Tarjeta de crédito" in Billetera and
// "Tarjeta de crédito •• 4821" in Detalle (only the last 4 digits, Security rules).
import type { Account } from '@shared/domain/types';

import { recurringStrings } from './strings.es-CO';

export const accountKind = (account: Account | null): string | null =>
  account ? recurringStrings.accountKinds[account.kind] : null;

export function accountWithNumber(account: Account | null): string | null {
  if (!account) return null;
  const digits = account.last4?.replace(/\D/g, '').slice(-4);
  return digits ? `${accountKind(account)} •• ${digits}` : accountKind(account);
}
