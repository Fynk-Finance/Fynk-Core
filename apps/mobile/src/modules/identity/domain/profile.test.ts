import { displayNameOf, initialsOf, memberSince } from './profile';

describe('initialsOf', () => {
  it('takes the first name and the last name', () => {
    expect(initialsOf('Laura', 'Gómez')).toBe('LG');
  });

  it('uses the first word of the first name and the last word of the last name', () => {
    expect(initialsOf('María José', 'Gómez Pérez')).toBe('MP');
  });

  it('works with one name only', () => {
    expect(initialsOf('Laura', undefined)).toBe('L');
    expect(initialsOf(undefined, 'Gómez')).toBe('G');
    expect(initialsOf('Laura', '   ')).toBe('L');
  });

  it('uppercases accented and lowercase letters', () => {
    expect(initialsOf('érika', 'ñáñez')).toBe('ÉÑ');
  });

  it('never splits an emoji and skips words that are not letters', () => {
    expect(initialsOf('😀 Ana', '🎉')).toBe('A');
    expect(initialsOf('😀', '🎉')).toBe('');
  });

  it('is empty without a name', () => {
    expect(initialsOf()).toBe('');
    expect(initialsOf('', '')).toBe('');
  });
});

describe('displayNameOf', () => {
  it('joins first and last name with single spaces', () => {
    expect(displayNameOf('  Laura ', 'Gómez  ')).toBe('Laura Gómez');
  });

  it('is empty when there is no name', () => {
    expect(displayNameOf(undefined, undefined)).toBe('');
    expect(displayNameOf(' ', '')).toBe('');
  });
});

describe('memberSince', () => {
  it('formats the month and year in Spanish', () => {
    expect(memberSince('2026-10-20T15:30:00Z')).toBe('octubre de 2026');
  });

  it('uses Bogota time near midnight UTC', () => {
    // 03:00 UTC on 1 November is 22:00 on 31 October in Bogota.
    expect(memberSince('2026-11-01T03:00:00Z')).toBe('octubre de 2026');
    expect(memberSince('2026-11-01T05:00:00Z')).toBe('noviembre de 2026');
    expect(memberSince('2026-01-01T02:00:00Z')).toBe('diciembre de 2025');
  });

  it('is empty for an invalid date', () => {
    expect(memberSince('not a date')).toBe('');
  });
});
