import {
  groupInbox,
  idsOverLimit,
  sectionOf,
  timeLabel,
  unreadCount,
  type InboxItem,
} from './inbox';

// Wednesday 28 Oct 2026, 10:00 in Bogotá (15:00 UTC).
const NOW = new Date('2026-10-28T15:00:00Z');

const item = (id: string, createdAt: string, readAt: string | null = null): InboxItem => ({
  id,
  kind: 'payment_due',
  title: id,
  body: '',
  deepLink: 'fynk://billetera',
  createdAt,
  readAt,
});

// The rows of the design (Notificaciones), in Bogotá time.
const design = [
  item('servicios', '2026-10-28T14:12:00Z'), // 9:12
  item('salario', '2026-10-28T13:05:00Z'), // 8:05
  item('recomendacion', '2026-10-28T12:30:00Z'), // 7:30
  item('meta', '2026-10-26T20:00:00Z', '2026-10-26T21:00:00Z'), // Lun
  item('sync', '2026-10-25T18:00:00Z', '2026-10-25T19:00:00Z'), // Dom
  item('streaming', '2026-10-24T15:00:00Z', '2026-10-24T16:00:00Z'), // Sáb
];

describe('groupInbox', () => {
  it('groups the design rows into Hoy and Esta semana, newest first', () => {
    const sections = groupInbox([...design].reverse(), NOW);
    expect(sections.map((s) => [s.key, s.items.map((i) => i.id)])).toEqual([
      ['today', ['servicios', 'salario', 'recomendacion']],
      ['thisWeek', ['meta', 'sync', 'streaming']],
    ]);
  });

  it('puts anything older than 6 days before today in Antes', () => {
    const sections = groupInbox([item('old', '2026-10-21T15:00:00Z')], NOW);
    expect(sections).toEqual([{ key: 'earlier', items: [expect.objectContaining({ id: 'old' })] }]);
  });

  it('returns no sections for an empty inbox', () => {
    expect(groupInbox([], NOW)).toEqual([]);
  });
});

describe('sectionOf uses the calendar day in Bogotá, not in UTC', () => {
  it('00:30 today in Bogotá (05:30 UTC) is today', () => {
    expect(sectionOf('2026-10-28T05:30:00Z', NOW)).toBe('today');
  });

  it('23:59 in Bogotá yesterday is this week, although in UTC it is already today', () => {
    expect(sectionOf('2026-10-28T04:59:00Z', NOW)).toBe('thisWeek');
  });

  it('6 days before is this week, 7 days before is earlier', () => {
    expect(sectionOf('2026-10-22T15:00:00Z', NOW)).toBe('thisWeek');
    expect(sectionOf('2026-10-21T15:00:00Z', NOW)).toBe('earlier');
  });

  it('a time slightly in the future (clock skew) is today', () => {
    expect(sectionOf('2026-10-28T15:05:00Z', NOW)).toBe('today');
  });
});

describe('timeLabel', () => {
  it('shows the hour today, like the design', () => {
    expect(design.slice(0, 3).map((i) => timeLabel(i.createdAt, NOW))).toEqual([
      '9:12',
      '8:05',
      '7:30',
    ]);
  });

  it('shows the weekday this week, like the design', () => {
    expect(design.slice(3).map((i) => timeLabel(i.createdAt, NOW))).toEqual(['Lun', 'Dom', 'Sáb']);
  });

  it('shows the day and month before that', () => {
    expect(timeLabel('2026-09-28T15:00:00Z', NOW)).toBe('28 sep');
  });

  it('returns an empty label for a value that is not a date', () => {
    expect(timeLabel('not a date', NOW)).toBe('');
  });
});

describe('unreadCount', () => {
  it('counts the 3 unread rows of the design', () => {
    expect(unreadCount(design)).toBe(3);
  });
});

describe('idsOverLimit', () => {
  it('deletes nothing at or under the limit', () => {
    expect(idsOverLimit(design, 6)).toEqual([]);
  });

  it('deletes the oldest read rows first', () => {
    expect(idsOverLimit(design, 4)).toEqual(['streaming', 'sync']);
  });

  it('deletes the oldest unread rows once no read row is left', () => {
    expect(idsOverLimit(design, 2)).toEqual(['streaming', 'sync', 'meta', 'recomendacion']);
  });
});
