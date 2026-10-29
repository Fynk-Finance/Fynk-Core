import { newDek } from './newDek';

jest.mock('expo-crypto', () => ({
  getRandomBytes: jest.fn((n: number) => new Uint8Array(n).fill(9)),
}));

it('asks the random source for 32 bytes', () => {
  expect(newDek()).toEqual(new Uint8Array(32).fill(9));
  const random = jest.fn((n: number) => new Uint8Array(n).fill(1));
  expect(newDek(random)).toEqual(new Uint8Array(32).fill(1));
  expect(random).toHaveBeenCalledWith(32);
});

it('rejects a source that returns the wrong length', () => {
  expect(() => newDek(() => new Uint8Array(16))).toThrow('wrong length');
});
