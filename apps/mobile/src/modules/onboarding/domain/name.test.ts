// The single name field of the Nombre step: how it is split and which names PATCH /me accepts.
import { greetingName, joinName, nameProblem, splitFullName } from './name';

describe('splitFullName', () => {
  it.each([
    ['Laura', { firstName: 'Laura' }],
    ['Laura Gómez', { firstName: 'Laura', lastName: 'Gómez' }],
    ['Laura Gómez Ruiz', { firstName: 'Laura', lastName: 'Gómez Ruiz' }],
    ['  laura   de la   Hoz ', { firstName: 'laura', lastName: 'de la Hoz' }],
  ])('"%s" → %j', (text, name) => {
    expect(splitFullName(text)).toEqual(name);
  });

  it('is null when nothing was typed', () => {
    expect(splitFullName('   ')).toBeNull();
  });
});

describe('nameProblem (same rule as PATCH /me)', () => {
  it.each([
    'Laura',
    'Laura Gómez',
    "María José O'Neill",
    'Ana-María Peña',
    'Zoë Müller',
    'Laura M. Gómez',
    '李 小龍',
  ])('accepts "%s"', (text) => {
    expect(nameProblem(text)).toBeNull();
  });

  it('asks for a name when the field is empty', () => {
    expect(nameProblem(' ')).toBe('empty');
  });

  it.each([
    'Laura2',
    'Laura @Gómez',
    '-Laura',
    'Laura Gómez-',
    'Laura Jr.',
    'J. Gómez',
    'Laura 😊',
  ])('refuses "%s"', (text) => {
    expect(nameProblem(text)).toBe('invalid');
  });

  it('allows 50 letters per part and refuses 51', () => {
    expect(nameProblem('a'.repeat(50))).toBeNull();
    expect(nameProblem('a'.repeat(51))).toBe('tooLong');
    expect(nameProblem(`Laura ${'b'.repeat(51)}`)).toBe('tooLong');
  });

  it('counts letters, not UTF-16 units', () => {
    expect(nameProblem('ñ'.repeat(50))).toBeNull();
  });
});

describe('joinName and greetingName', () => {
  it('puts the saved name back in one field', () => {
    expect(joinName({ firstName: 'Laura', lastName: 'Gómez' })).toBe('Laura Gómez');
    expect(joinName({ firstName: 'Laura' })).toBe('Laura');
    expect(joinName({})).toBe('');
  });

  it('greets with the first word', () => {
    expect(greetingName(' Laura Gómez')).toBe('Laura');
    expect(greetingName('')).toBe('');
  });
});
