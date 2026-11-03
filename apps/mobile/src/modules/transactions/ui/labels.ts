// Words the rows show for a movement: its title, its account and its day header.
import { categoryLabel } from '@shared/domain/categories';
import { formatCop, formatCopSigned } from '@shared/domain/money';
import type { Account, Id, MoneyMinor, Transaction } from '@shared/domain/types';

import { bogotaDay } from '../domain/bogota';
import type { DayGroup } from '../domain/dayGroups';
import { shortDate, transactionsStrings as s } from './strings.es-CO';

const TYPOGRAPHIC_MINUS = '−';

/** The merchant when the bank gives one, else the description. */
export function titleOf(tx: Pick<Transaction, 'merchantRaw' | 'description'>): string {
  return tx.merchantRaw?.trim() || tx.description;
}

/** "Banco Demo" from "Banco Demo · Ahorros"; "Efectivo" for cash. */
export function entityOf(account: Pick<Account, 'kind' | 'displayName'>): string {
  if (account.kind === 'cash') return s.kinds.cash;
  return account.displayName.split(' · ')[0]?.trim() || account.displayName;
}

/** Account ids to their entity, for the "Mercado · Efectivo" subtitles. */
export function entityNames(accounts: readonly Account[]): ReadonlyMap<Id, string> {
  return new Map(accounts.map((a) => [a.id, entityOf(a)]));
}

/** Subtitle of a Movimientos row: "Mercado · Bancolombia". */
export function listSubtitle(tx: Transaction, entities: ReadonlyMap<Id, string>): string {
  const entity = entities.get(tx.accountId);
  const category = categoryLabel(tx.categoryId);
  return entity ? `${category} · ${entity}` : category;
}

/** "Hoy · 22 sep", "Ayer · 21 sep" or "dom 20 sep". */
export function dayHeader(group: Pick<DayGroup, 'day' | 'relative' | 'weekday'>): string {
  const date = shortDate(group.day);
  if (group.relative === 'today') return `${s.list.today} · ${date}`;
  if (group.relative === 'yesterday') return `${s.list.yesterday} · ${date}`;
  return `${s.weekdays[group.weekday]} ${date}`;
}

/** "+$5.200.000" or "−$184.300" with the typographic minus the design draws. */
export function signedText(minor: MoneyMinor): string {
  return formatCopSigned(minor).replace(/^-/, TYPOGRAPHIC_MINUS);
}

/** "Mostrando 20 de 94 · +$16.545.000 · −$9.903.300". */
export function summaryLine(
  shown: number,
  summary: { count: number; incomeMinor: MoneyMinor; spendMinor: MoneyMinor },
): string {
  return [
    s.list.showing(shown, summary.count),
    `+${formatCop(summary.incomeMinor)}`,
    `${TYPOGRAPHIC_MINUS}${formatCop(-summary.spendMinor)}`,
  ].join(' · ');
}

/** Subtitle of a Dashboard row: "Cuenta de ahorros · 22 sep". */
export function previewSubtitle(tx: Transaction, kinds: ReadonlyMap<Id, Account['kind']>): string {
  const kind = kinds.get(tx.accountId);
  const date = shortDate(bogotaDay(tx.bookedAt));
  return kind ? `${s.kinds[kind]} · ${date}` : date;
}

/** Subtitle of a Detalle de cuenta row: "24 oct · Mercado". */
export function accountSubtitle(tx: Transaction): string {
  return `${shortDate(bogotaDay(tx.bookedAt))} · ${categoryLabel(tx.categoryId)}`;
}
