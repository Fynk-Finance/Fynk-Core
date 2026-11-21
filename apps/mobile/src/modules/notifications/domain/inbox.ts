// Inbox rules of the Notificaciones screen (SCRUM-70). Pure: the caller passes the current time.
import type { Id, IsoDateTime } from '@shared/domain/types';
import type { NotificationKind } from '@shared/ports';

export interface InboxItem {
  id: Id;
  kind: NotificationKind;
  title: string;
  body: string;
  deepLink: string;
  createdAt: IsoDateTime;
  readAt: IsoDateTime | null;
}

export type InboxSectionKey = 'today' | 'thisWeek' | 'earlier';

export interface InboxSection {
  key: InboxSectionKey;
  items: InboxItem[];
}

/** Most rows the inbox keeps. Older ones are deleted, read ones first. */
export const INBOX_LIMIT = 200;

// America/Bogota is UTC-5 all year (Colombia has no daylight saving time).
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Days since 1970-01-01 of the calendar day in Bogotá. */
function bogotaDay(time: number): number {
  return Math.floor((time + BOGOTA_OFFSET_MS) / DAY_MS);
}

/** Newest first. Rows with the same time keep a stable order by id. */
export function sortNewestFirst(items: readonly InboxItem[]): InboxItem[] {
  return [...items].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id),
  );
}

/**
 * Which section a notification goes to, by calendar day in Bogotá:
 * today, the 6 days before today (this week), or earlier.
 */
export function sectionOf(createdAt: IsoDateTime, now: Date): InboxSectionKey {
  const days = bogotaDay(now.getTime()) - bogotaDay(Date.parse(createdAt));
  if (days <= 0) return 'today';
  if (days < 7) return 'thisWeek';
  return 'earlier';
}

/** Hoy, Esta semana, Antes. Empty sections are left out. Newest first inside each one. */
export function groupInbox(items: readonly InboxItem[], now: Date): InboxSection[] {
  const sections: Record<InboxSectionKey, InboxItem[]> = { today: [], thisWeek: [], earlier: [] };
  for (const item of sortNewestFirst(items)) sections[sectionOf(item.createdAt, now)].push(item);
  return (['today', 'thisWeek', 'earlier'] as const)
    .filter((key) => sections[key].length > 0)
    .map((key) => ({ key, items: sections[key] }));
}

/** Right side of a row: "9:12" today, "Lun" this week, "28 sep" before. Bogotá time. */
export function timeLabel(createdAt: IsoDateTime, now: Date): string {
  const time = Date.parse(createdAt);
  if (Number.isNaN(time)) return '';
  const local = new Date(time + BOGOTA_OFFSET_MS);
  switch (sectionOf(createdAt, now)) {
    case 'today':
      return `${local.getUTCHours()}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
    case 'thisWeek':
      return WEEKDAYS[local.getUTCDay()] ?? '';
    case 'earlier':
      return `${local.getUTCDate()} ${MONTHS[local.getUTCMonth()] ?? ''}`;
  }
}

export function unreadCount(items: readonly InboxItem[]): number {
  return items.filter((item) => item.readAt === null).length;
}

/**
 * Ids to delete so the inbox keeps at most `limit` rows: the oldest read ones first, then the
 * oldest unread ones if there are still too many.
 */
export function idsOverLimit(items: readonly InboxItem[], limit = INBOX_LIMIT): Id[] {
  const extra = items.length - limit;
  if (extra <= 0) return [];
  const oldestFirst = sortNewestFirst(items).reverse();
  const read = oldestFirst.filter((item) => item.readAt !== null);
  const unread = oldestFirst.filter((item) => item.readAt === null);
  return [...read, ...unread].slice(0, extra).map((item) => item.id);
}
