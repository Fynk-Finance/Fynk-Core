import { JUST_NOW, relativeTime } from './relativeTime';

const NOW = new Date('2026-10-27T15:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('relativeTime', () => {
  it('is "now" under 2 minutes, in the future too', () => {
    expect(relativeTime(ago(0), NOW)).toBe(JUST_NOW);
    expect(relativeTime(ago(2 * MIN - 1), NOW)).toBe(JUST_NOW);
    expect(relativeTime(ago(-5 * MIN), NOW)).toBe(JUST_NOW);
  });

  it('counts minutes and hours', () => {
    expect(relativeTime(ago(2 * MIN), NOW)).toBe('hace 2 minutos');
    expect(relativeTime(ago(59 * MIN), NOW)).toBe('hace 59 minutos');
    expect(relativeTime(ago(HOUR), NOW)).toBe('hace 1 hora');
    expect(relativeTime(ago(23 * HOUR + 59 * MIN), NOW)).toBe('hace 23 horas');
  });

  it('counts days, weeks, months and years with singular and plural', () => {
    expect(relativeTime(ago(DAY), NOW)).toBe('hace 1 día');
    expect(relativeTime(ago(2 * DAY), NOW)).toBe('hace 2 días');
    expect(relativeTime(ago(6 * DAY), NOW)).toBe('hace 6 días');
    expect(relativeTime(ago(7 * DAY), NOW)).toBe('hace 1 semana');
    expect(relativeTime(ago(21 * DAY), NOW)).toBe('hace 3 semanas');
    expect(relativeTime(ago(29 * DAY), NOW)).toBe('hace 4 semanas');
    expect(relativeTime(ago(30 * DAY), NOW)).toBe('hace 1 mes');
    expect(relativeTime(ago(90 * DAY), NOW)).toBe('hace 3 meses');
    expect(relativeTime(ago(364 * DAY), NOW)).toBe('hace 12 meses');
    expect(relativeTime(ago(365 * DAY), NOW)).toBe('hace 1 año');
    expect(relativeTime(ago(800 * DAY), NOW)).toBe('hace 2 años');
  });

  it('is empty when the text is not a date', () => {
    expect(relativeTime('not a date', NOW)).toBe('');
    expect(relativeTime('', NOW)).toBe('');
  });
});
