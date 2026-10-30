import { ResetError } from './ports';
import { createResetBackup } from './resetBackup';

const resultFor = (reset: () => Promise<void>) => createResetBackup({ api: { reset } }).reset();

describe('resetBackup', () => {
  it('is ok when the server accepts', async () => {
    const reset = jest.fn(async () => undefined);
    expect(await resultFor(reset)).toBe('ok');
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['notAllowed', 'notAllowed'],
    ['notActive', 'notActive'],
    ['offline', 'offline'],
    ['unknown', 'failed'],
  ] as const)('maps the %s error to %s', async (kind, result) => {
    expect(await resultFor(async () => Promise.reject(new ResetError(kind)))).toBe(result);
  });

  it('is failed for an unexpected error', async () => {
    expect(await resultFor(async () => Promise.reject(new Error('boom')))).toBe('failed');
  });
});
