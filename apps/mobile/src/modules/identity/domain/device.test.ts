import {
  DEVICE_NAME_MAX,
  deviceDisplayName,
  fromBase64,
  parseDeviceRecord,
  toBase64,
} from './device';

describe('deviceDisplayName', () => {
  it('uses the trimmed model name', () => {
    expect(deviceDisplayName('  Pixel 8  ', 'android')).toBe('Pixel 8');
  });

  it('falls back by platform when the model is missing or blank', () => {
    expect(deviceDisplayName(null, 'ios')).toBe('iPhone');
    expect(deviceDisplayName(undefined, 'android')).toBe('Android');
    expect(deviceDisplayName('   ', 'ios')).toBe('iPhone');
  });

  it('truncates to the contract limit', () => {
    expect(deviceDisplayName('x'.repeat(100), 'android')).toHaveLength(DEVICE_NAME_MAX);
  });

  it('does not cut a character in half', () => {
    const name = deviceDisplayName('😀'.repeat(70), 'ios');
    expect(Array.from(name)).toHaveLength(DEVICE_NAME_MAX);
  });
});

describe('base64', () => {
  it('encodes the contract example of 32 bytes', () => {
    const bytes = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
    expect(toBase64(bytes)).toBe('AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=');
  });

  it('encodes with every padding length', () => {
    expect(toBase64(Uint8Array.from([]))).toBe('');
    expect(toBase64(Uint8Array.from([102]))).toBe('Zg==');
    expect(toBase64(Uint8Array.from([102, 111]))).toBe('Zm8=');
    expect(toBase64(Uint8Array.from([102, 111, 111]))).toBe('Zm9v');
  });

  it('decodes what it encodes and rejects bad text', () => {
    const bytes = Uint8Array.from({ length: 32 }, (_, i) => 255 - i);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
    expect(fromBase64('Zg')).toBeNull();
    expect(fromBase64('Z*==')).toBeNull();
  });
});

describe('parseDeviceRecord', () => {
  const key = toBase64(new Uint8Array(32).fill(7));
  const base = { v: 1, privateKey: key, publicKey: key };

  it('reads a record with and without the optional fields', () => {
    expect(parseDeviceRecord(JSON.stringify(base))).toEqual(base);
    const full = { ...base, deviceId: 'd-1', idempotencyKey: 'k-1' };
    expect(parseDeviceRecord(JSON.stringify(full))).toEqual(full);
  });

  it('returns null for corrupt or foreign data', () => {
    expect(parseDeviceRecord('{"v":')).toBeNull();
    expect(parseDeviceRecord('null')).toBeNull();
    expect(parseDeviceRecord(JSON.stringify({ ...base, v: 2 }))).toBeNull();
    expect(parseDeviceRecord(JSON.stringify({ ...base, publicKey: 'AAAA' }))).toBeNull();
    expect(parseDeviceRecord(JSON.stringify({ ...base, deviceId: 5 }))).toBeNull();
  });
});
