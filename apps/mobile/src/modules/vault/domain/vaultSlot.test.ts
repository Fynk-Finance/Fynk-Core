import { vaultSlot } from './vaultSlot';

describe('vaultSlot', () => {
  it('is 32 lowercase hex characters and deterministic', () => {
    const slot = vaultSlot('7f3c1d2e-aaaa-bbbb-cccc-0123456789ab');
    expect(slot).toMatch(/^[0-9a-f]{32}$/);
    expect(vaultSlot('7f3c1d2e-aaaa-bbbb-cccc-0123456789ab')).toBe(slot);
  });

  it('is the first 16 bytes of SHA-256 of the sub', () => {
    // SHA-256("abc") = ba7816bf 8f01cfea 414140de 5dae2223 b00361a3 96177a9c b410ff61 f20015ad
    expect(vaultSlot('abc')).toBe('ba7816bf8f01cfea414140de5dae2223');
  });

  it('differs between accounts', () => {
    expect(vaultSlot('user-a')).not.toBe(vaultSlot('user-b'));
  });
});
