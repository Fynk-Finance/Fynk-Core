import { deriveDeviceProof, deviceProofHash } from '../domain/crypto';
import { encodeRecoveryCode, parseRecoveryCode } from '../domain/recoveryCode';
import { unwrapDek } from '../domain/recoveryKey';
import {
  RecoveryError,
  type RecoveryKdf,
  type RecoveryKeyApi,
  type RecoveryKeyUpload,
} from './ports';
import { confirmRecoveryCode, createRecoveryCodeService } from './recoveryCode';

const DEK = Uint8Array.from({ length: 32 }, (_, i) => i + 50);

/** Hands out 0,1,2... so every call to random() differs and tests stay fixed. */
function sequentialRandom() {
  let next = 0;
  return jest.fn((n: number) => Uint8Array.from({ length: n }, () => next++ % 256));
}

/** A cheap fake KDF: mixes the code and the salt into 32 bytes, so the key depends on both. */
const fakeKdf = (): jest.MockedFunction<RecoveryKdf> =>
  jest.fn(async (code, salt) =>
    Uint8Array.from(
      { length: 32 },
      (_, i) => (code.charCodeAt(i % code.length) + (salt[i % 16] ?? 0)) & 255,
    ),
  );

function setup() {
  const uploads: RecoveryKeyUpload[] = [];
  const api: RecoveryKeyApi = {
    get: jest.fn(async () => null),
    activate: jest.fn(async () => undefined),
    put: jest.fn(async (u) => {
      uploads.push(u);
    }),
  };
  const random = sequentialRandom();
  const kdf = fakeKdf();
  return { service: createRecoveryCodeService({ random, kdf, api }), api, kdf, random, uploads };
}

it('makes the code from 16 random bytes and shows it in 5 groups', async () => {
  const { service } = setup();
  const prepared = await service.prepare(DEK);
  const expected = encodeRecoveryCode(Uint8Array.from({ length: 16 }, (_, i) => i));
  expect(prepared.groups).toHaveLength(5);
  expect(prepared.groups.map((g) => g.length)).toEqual([5, 5, 5, 5, 6]);
  expect(prepared.groups.join('')).toBe(expected);
  expect(prepared.lastGroup).toBe(prepared.groups[4]);
  expect(parseRecoveryCode(prepared.groups.join(' '))).toBe(expected);
});

it('derives the key from the canonical code and a 16 byte salt', async () => {
  const { service, kdf } = setup();
  const prepared = await service.prepare(DEK);
  expect(kdf).toHaveBeenCalledTimes(1);
  const [code, salt] = kdf.mock.calls[0]!;
  expect(code).toBe(prepared.groups.join(''));
  expect(code).toHaveLength(26);
  expect(salt).toEqual(Uint8Array.from({ length: 16 }, (_, i) => 16 + i));
});

it('uploads nothing until commit', async () => {
  const { service, api } = setup();
  await service.prepare(DEK);
  expect(api.put).not.toHaveBeenCalled();
});

it('commit uploads the DEK wrapped under the key of the code, plus the proof hash', async () => {
  const { service, api, kdf, uploads } = setup();
  const prepared = await service.prepare(DEK);
  await prepared.commit();
  expect(api.put).toHaveBeenCalledTimes(1);
  const upload = uploads[0]!;
  expect(upload.wrappedDek).toHaveLength(48);
  expect(upload.nonce).toEqual(Uint8Array.from({ length: 12 }, (_, i) => 32 + i));
  expect(upload.kdfParams).toEqual({ memoryKiB: 65536, iterations: 3, parallelism: 1 });
  expect(upload.deviceProofHash).toEqual(deviceProofHash(deriveDeviceProof(DEK)));
  // Whoever types the code derives the same key and opens the DEK.
  const rk = await kdf(prepared.groups.join(''), upload.salt);
  expect(unwrapDek(rk, upload.nonce, upload.wrappedDek)).toEqual(DEK);
});

it('never puts the code in the upload', async () => {
  const { service, uploads } = setup();
  const prepared = await service.prepare(DEK);
  await prepared.commit();
  const code = prepared.groups.join('');
  const sent = JSON.stringify(uploads[0], (_k, v: unknown) =>
    v instanceof Uint8Array ? Array.from(v) : v,
  );
  expect(sent).not.toContain(code);
  // Nor its 16 bytes, which are the first random call.
  expect(sent).not.toContain(JSON.stringify(Array.from({ length: 16 }, (_, i) => i)));
});

it('lets commit fail and be retried', async () => {
  const { service, api } = setup();
  (api.put as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  const prepared = await service.prepare(DEK);
  await expect(prepared.commit()).rejects.toThrow('offline');
  await expect(prepared.commit()).resolves.toBeUndefined();
});

it('makes a different code on every prepare', async () => {
  const { service } = setup();
  const a = await service.prepare(DEK);
  const b = await service.prepare(DEK);
  expect(a.groups.join('')).not.toBe(b.groups.join(''));
});

describe('confirmRecoveryCode', () => {
  it('commits when the typed last group matches, forgiving slips', async () => {
    const { service, api } = setup();
    const prepared = await service.prepare(DEK);
    expect(await confirmRecoveryCode(prepared, ` ${prepared.lastGroup.toLowerCase()} `)).toBe('ok');
    expect(api.put).toHaveBeenCalledTimes(1);
  });

  it('answers mismatch and uploads nothing for another group', async () => {
    const { service, api } = setup();
    const prepared = await service.prepare(DEK);
    expect(await confirmRecoveryCode(prepared, prepared.groups[0]!)).toBe('mismatch');
    expect(await confirmRecoveryCode(prepared, '')).toBe('mismatch');
    expect(api.put).not.toHaveBeenCalled();
  });

  it('answers offline or failed when the upload fails, and a retry can succeed', async () => {
    const { service, api } = setup();
    const prepared = await service.prepare(DEK);
    (api.put as jest.Mock).mockRejectedValueOnce(new RecoveryError('offline'));
    expect(await confirmRecoveryCode(prepared, prepared.lastGroup)).toBe('offline');
    (api.put as jest.Mock).mockRejectedValueOnce(new RecoveryError('notActive'));
    expect(await confirmRecoveryCode(prepared, prepared.lastGroup)).toBe('failed');
    (api.put as jest.Mock).mockRejectedValueOnce(new Error('x'));
    expect(await confirmRecoveryCode(prepared, prepared.lastGroup)).toBe('failed');
    expect(await confirmRecoveryCode(prepared, prepared.lastGroup)).toBe('ok');
  });
});
