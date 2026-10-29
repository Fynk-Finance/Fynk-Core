// Device rules of the identity module. Pure: no I/O, no randomness.

/** Longest device name the API accepts (contract IdentityDeviceRegistration.name). */
export const DEVICE_NAME_MAX = 64;

export type DevicePlatform = 'ios' | 'android';

/** What is kept in the Keychain for this install. All values are standard base64 strings. */
export interface DeviceRecord {
  v: 1;
  /** X25519 private key. Never leaves the Keychain adapter and the key generator. */
  privateKey: string;
  /** X25519 public key, 32 bytes. */
  publicKey: string;
  /** Id the API gave this phone, once registered. */
  deviceId?: string;
  /** Kept while a registration is in flight, so a retry after a crash reuses it. */
  idempotencyKey?: string;
}

/** Name the person sees in the list of devices: trimmed, never empty, at most 64 characters. */
export function deviceDisplayName(
  modelName: string | null | undefined,
  platform: DevicePlatform,
): string {
  const fallback = platform === 'ios' ? 'iPhone' : 'Android';
  const trimmed = (modelName ?? '').trim();
  const name = trimmed.length > 0 ? trimmed : fallback;
  return Array.from(name).slice(0, DEVICE_NAME_MAX).join('').trim() || fallback;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Standard base64 with padding. Hermes has no Buffer, so it is written here. */
export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    const n = (b0 << 16) | (b1 << 8) | b2;
    out += ALPHABET[(n >> 18) & 63];
    out += ALPHABET[(n >> 12) & 63];
    out += i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? ALPHABET[n & 63] : '=';
  }
  return out;
}

/** Decodes standard base64 with padding. Returns null when the text is not valid. */
export function fromBase64(text: string): Uint8Array | null {
  if (text.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) return null;
  const pad = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((text.length / 4) * 3 - pad);
  let o = 0;
  for (let i = 0; i < text.length; i += 4) {
    let n = 0;
    for (let j = 0; j < 4; j++) {
      const c = text[i + j] as string;
      n = (n << 6) | (c === '=' ? 0 : ALPHABET.indexOf(c));
    }
    for (let k = 0; k < 3; k++) {
      if (o < out.length) out[o++] = (n >> (16 - 8 * k)) & 255;
    }
  }
  return out;
}

const isKey = (v: unknown): v is string => typeof v === 'string' && fromBase64(v)?.length === 32;
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Reads a stored record. Returns null when it is corrupt or from another format. */
export function parseDeviceRecord(raw: string): DeviceRecord | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const r = value as Record<string, unknown>;
  if (r.v !== 1 || !isKey(r.privateKey) || !isKey(r.publicKey)) return null;
  if (r.deviceId !== undefined && !isText(r.deviceId)) return null;
  if (r.idempotencyKey !== undefined && !isText(r.idempotencyKey)) return null;
  return {
    v: 1,
    privateKey: r.privateKey,
    publicKey: r.publicKey,
    ...(r.deviceId !== undefined && { deviceId: r.deviceId }),
    ...(r.idempotencyKey !== undefined && { idempotencyKey: r.idempotencyKey }),
  };
}
