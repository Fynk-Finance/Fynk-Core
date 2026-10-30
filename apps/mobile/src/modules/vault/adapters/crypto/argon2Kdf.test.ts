import Argon2 from 'react-native-argon2';

import { argon2Kdf } from './argon2Kdf';

jest.mock('react-native-argon2', () => ({ __esModule: true, default: jest.fn() }));

const argon2 = Argon2 as jest.MockedFunction<typeof Argon2>;
const SALT = Uint8Array.from({ length: 16 }, (_, i) => i);
const CODE = '0123456789ABCDEFGHJKMNPQRS';

beforeEach(() => argon2.mockReset());

it('calls Argon2id with the exact recovery parameters and a hex salt', async () => {
  argon2.mockResolvedValue({ rawHash: '00'.repeat(32), encodedHash: 'x' });
  await argon2Kdf(CODE, SALT);
  expect(argon2).toHaveBeenCalledWith(CODE, '000102030405060708090a0b0c0d0e0f', {
    mode: 'argon2id',
    memory: 65536,
    iterations: 3,
    parallelism: 1,
    hashLength: 32,
    saltEncoding: 'hex',
  });
});

it('turns the hex raw hash into 32 bytes', async () => {
  const bytes = Uint8Array.from({ length: 32 }, (_, i) => i * 8);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  argon2.mockResolvedValue({ rawHash: hex, encodedHash: 'x' });
  expect(await argon2Kdf(CODE, SALT)).toEqual(bytes);
});

it.each([
  ['too short', '00'.repeat(31)],
  ['too long', '00'.repeat(33)],
  ['not hex', 'zz'.repeat(32)],
  ['odd length', '0'.repeat(63)],
])('throws when the raw hash is %s', async (_name, rawHash) => {
  argon2.mockResolvedValue({ rawHash, encodedHash: 'x' });
  await expect(argon2Kdf(CODE, SALT)).rejects.toThrow('unexpected hash');
});

it('passes the library error on without adding the code', async () => {
  argon2.mockRejectedValue(new Error('native failure'));
  await expect(argon2Kdf(CODE, SALT)).rejects.toThrow('native failure');
});
