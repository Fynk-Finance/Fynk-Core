import { otherDevices, sessionsLabel, sortDevices, type LinkedDeviceItem } from './deviceList';

const device = (id: string, lastSeenAt: string, current = false): LinkedDeviceItem => ({
  id,
  name: id,
  platform: 'ios',
  status: 'active',
  current,
  lastSeenAt,
});

describe('sortDevices', () => {
  it('puts this phone first, then the most recently seen', () => {
    const sorted = sortDevices([
      device('old', '2026-10-01T00:00:00Z'),
      device('this', '2026-09-01T00:00:00Z', true),
      device('new', '2026-10-20T00:00:00Z'),
    ]);
    expect(sorted.map((d) => d.id)).toEqual(['this', 'new', 'old']);
  });

  it('puts a date that does not parse last and keeps the input untouched', () => {
    const input = [device('bad', 'nope'), device('ok', '2026-10-01T00:00:00Z')];
    expect(sortDevices(input).map((d) => d.id)).toEqual(['ok', 'bad']);
    expect(input.map((d) => d.id)).toEqual(['bad', 'ok']);
  });
});

describe('otherDevices', () => {
  it('leaves out this phone', () => {
    const list = [
      device('this', '2026-10-01T00:00:00Z', true),
      device('b', '2026-10-01T00:00:00Z'),
    ];
    expect(otherDevices(list).map((d) => d.id)).toEqual(['b']);
    expect(otherDevices([list[0]!])).toEqual([]);
  });
});

describe('sessionsLabel', () => {
  it('uses singular for one and plural otherwise', () => {
    expect(sessionsLabel(1)).toBe('1 sesión');
    expect(sessionsLabel(3)).toBe('3 sesiones');
    expect(sessionsLabel(0)).toBe('0 sesiones');
  });
});
