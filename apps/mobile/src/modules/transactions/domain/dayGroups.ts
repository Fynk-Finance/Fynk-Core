// Movimientos groups rows by Bogotá day, newest first, with the day's net on the right of the
// header ("Hoy · 22 sep", "Ayer · 21 sep", "dom 20 sep"). Pure: the caller passes now.
import type { IsoDate, MoneyMinor, Transaction } from '@shared/domain/types';

import { addDays, bogotaDay } from './bogota';

export interface DayGroup {
  day: IsoDate;
  /** 'today' and 'yesterday' get their own words; other days show the weekday. */
  relative: 'today' | 'yesterday' | null;
  /** 0 is Sunday, as Date.getUTCDay. */
  weekday: number;
  netMinor: MoneyMinor;
  items: Transaction[];
}

/** Groups rows that are already newest first. Keeps their order inside each day. */
export function groupByDay(rows: readonly Transaction[], now: Date): DayGroup[] {
  const today = bogotaDay(now);
  const yesterday = addDays(today, -1);
  const groups: DayGroup[] = [];
  for (const tx of rows) {
    const day = bogotaDay(tx.bookedAt);
    let group = groups[groups.length - 1];
    if (!group || group.day !== day) {
      group = {
        day,
        relative: day === today ? 'today' : day === yesterday ? 'yesterday' : null,
        weekday: new Date(`${day}T00:00:00Z`).getUTCDay(),
        netMinor: 0,
        items: [],
      };
      groups.push(group);
    }
    group.items.push(tx);
    group.netMinor += tx.amountMinor;
  }
  return groups;
}
