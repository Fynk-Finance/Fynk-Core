import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

import {
  VaultCryptoError,
  approvalCode,
  deriveBackupKey,
  deriveDeviceProof,
  deviceProofHash,
  open,
  recordAad,
  seal,
} from './crypto';

const filled = (length: number, start: number) =>
  Uint8Array.from({ length }, (_, i) => (start + i) & 255);
const KEY = filled(32, 0);
const NONCE = filled(12, 100);
const AAD = new TextEncoder().encode('user-1|goals|rec-1|3');
const PLAINTEXT = new TextEncoder().encode('{"name":"Viaje","target":150000000}');
const hex = bytesToHex;

// Node's own crypto is the independent reference. The project has no Node typings, so the few
// calls used are described here.
interface NodeCrypto {
  createCipheriv(
    algorithm: string,
    key: Uint8Array,
    iv: Uint8Array,
  ): {
    setAAD(aad: Uint8Array): void;
    update(data: Uint8Array): Uint8Array;
    final(): Uint8Array;
    getAuthTag(): Uint8Array;
  };
  createHash(algorithm: string): {
    update(data: Uint8Array): { digest(): Uint8Array };
  };
  hkdfSync(
    digest: string,
    ikm: Uint8Array,
    salt: Uint8Array,
    info: string,
    length: number,
  ): ArrayBuffer;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeCrypto: NodeCrypto = require('crypto');
const sha256 = (data: Uint8Array) =>
  Uint8Array.from(nodeCrypto.createHash('sha256').update(data).digest());

function nodeSeal(key: Uint8Array, nonce: Uint8Array, plaintext: Uint8Array, aad: Uint8Array) {
  const cipher = nodeCrypto.createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(aad);
  return Uint8Array.from([...cipher.update(plaintext), ...cipher.final(), ...cipher.getAuthTag()]);
}

describe('seal and open', () => {
  it('matches Node AES-256-GCM (ciphertext followed by the tag)', () => {
    expect(hex(seal(KEY, NONCE, PLAINTEXT, AAD))).toBe(hex(nodeSeal(KEY, NONCE, PLAINTEXT, AAD)));
  });

  it('matches the NIST GCM test case 16 (AES-256, with AAD)', () => {
    const key = hexToBytes('feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308');
    const nonce = hexToBytes('cafebabefacedbaddecaf888');
    const aad = hexToBytes('feedfacedeadbeeffeedfacedeadbeefabaddad2');
    const plaintext = hexToBytes(
      'd9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b39',
    );
    const expected =
      '522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f662' +
      '76fc6ece0f4e1768cddf8853bb2d551b';
    expect(hex(seal(key, nonce, plaintext, aad))).toBe(expected);
  });

  it('opens what it sealed', () => {
    const sealed = seal(KEY, NONCE, PLAINTEXT, AAD);
    expect(sealed).toHaveLength(PLAINTEXT.length + 16);
    expect(open(KEY, NONCE, sealed, AAD)).toEqual(PLAINTEXT);
  });

  it('seals an empty plaintext to just the tag', () => {
    const sealed = seal(KEY, NONCE, new Uint8Array(0), AAD);
    expect(sealed).toHaveLength(16);
    expect(open(KEY, NONCE, sealed, AAD)).toEqual(new Uint8Array(0));
  });

  it('fails when any byte of the ciphertext or the tag changes', () => {
    const sealed = seal(KEY, NONCE, PLAINTEXT, AAD);
    for (let i = 0; i < sealed.length; i++) {
      const tampered = sealed.slice();
      tampered[i] = (tampered[i] as number) ^ 1;
      expect(() => open(KEY, NONCE, tampered, AAD)).toThrow(VaultCryptoError);
    }
  });

  it('fails when any byte of the nonce, the key or the AAD changes', () => {
    const sealed = seal(KEY, NONCE, PLAINTEXT, AAD);
    for (let i = 0; i < NONCE.length; i++) {
      const nonce = NONCE.slice();
      nonce[i] = (nonce[i] as number) ^ 1;
      expect(() => open(KEY, nonce, sealed, AAD)).toThrow(VaultCryptoError);
    }
    for (let i = 0; i < KEY.length; i++) {
      const key = KEY.slice();
      key[i] = (key[i] as number) ^ 1;
      expect(() => open(key, NONCE, sealed, AAD)).toThrow(VaultCryptoError);
    }
    for (let i = 0; i < AAD.length; i++) {
      const aad = AAD.slice();
      aad[i] = (aad[i] as number) ^ 1;
      expect(() => open(KEY, NONCE, sealed, aad)).toThrow(VaultCryptoError);
    }
  });

  it('fails on truncated or missing data', () => {
    const sealed = seal(KEY, NONCE, PLAINTEXT, AAD);
    expect(() => open(KEY, NONCE, sealed.slice(0, sealed.length - 1), AAD)).toThrow(
      VaultCryptoError,
    );
    expect(() => open(KEY, NONCE, sealed.slice(0, 15), AAD)).toThrow(VaultCryptoError);
  });

  it('rejects keys and nonces of the wrong length', () => {
    expect(() => seal(filled(31, 0), NONCE, PLAINTEXT, AAD)).toThrow(VaultCryptoError);
    expect(() => seal(KEY, filled(16, 0), PLAINTEXT, AAD)).toThrow(VaultCryptoError);
    expect(() => open(filled(33, 0), NONCE, new Uint8Array(16), AAD)).toThrow(VaultCryptoError);
    expect(() => open(KEY, filled(11, 0), new Uint8Array(16), AAD)).toThrow(VaultCryptoError);
  });

  it('does not put the data in the error message', () => {
    const sealed = seal(KEY, NONCE, PLAINTEXT, AAD);
    sealed[0] = (sealed[0] as number) ^ 1;
    expect(() => open(KEY, NONCE, sealed, AAD)).toThrow('decryption failed');
  });
});

describe('key derivation', () => {
  const dek = filled(32, 7);
  const node = (info: string) =>
    hex(new Uint8Array(nodeCrypto.hkdfSync('sha256', dek, new Uint8Array(0), info, 32)));

  it('derives the backup key with HKDF-SHA256 and info fynk/backup/v1', () => {
    expect(hex(deriveBackupKey(dek))).toBe(node('fynk/backup/v1'));
  });

  it('derives the device proof with HKDF-SHA256 and info fynk/device-proof/v1', () => {
    expect(hex(deriveDeviceProof(dek))).toBe(node('fynk/device-proof/v1'));
  });

  it('gives different keys per purpose and per DEK', () => {
    expect(deriveBackupKey(dek)).not.toEqual(deriveDeviceProof(dek));
    expect(deriveBackupKey(dek)).not.toEqual(deriveBackupKey(filled(32, 8)));
  });

  it('hashes the proof with SHA-256', () => {
    const proof = deriveDeviceProof(dek);
    expect(hex(deviceProofHash(proof))).toBe(hex(sha256(proof)));
  });

  it('rejects a DEK that is not 32 bytes', () => {
    expect(() => deriveBackupKey(filled(16, 0))).toThrow(VaultCryptoError);
    expect(() => deriveDeviceProof(filled(33, 0))).toThrow(VaultCryptoError);
  });
});

describe('recordAad', () => {
  it('joins owner, collection, record and version with pipes', () => {
    expect(new TextDecoder().decode(recordAad('u-1', 'savings_goals', 'r-9', 4))).toBe(
      'u-1|savings_goals|r-9|4',
    );
  });

  it('seals a record so it only opens with the same coordinates', () => {
    const sealed = seal(KEY, NONCE, PLAINTEXT, recordAad('u-1', 'goals', 'r-1', 1));
    expect(() => open(KEY, NONCE, sealed, recordAad('u-1', 'goals', 'r-1', 2))).toThrow(
      VaultCryptoError,
    );
    expect(() => open(KEY, NONCE, sealed, recordAad('u-2', 'goals', 'r-1', 1))).toThrow(
      VaultCryptoError,
    );
  });
});

describe('approvalCode', () => {
  it('reads the first 4 bytes of SHA-256 as a big-endian integer modulo 1.000.000', () => {
    // SHA-256 of 32 zero bytes starts with 66 68 7a ad.
    const publicKey = new Uint8Array(32);
    const digest = sha256(publicKey);
    expect(hex(digest.subarray(0, 4))).toBe('66687aad');
    // 0x66687aad = 1718123181, and 1718123181 mod 1000000 = 123181.
    expect(approvalCode(publicKey)).toBe('123181');
  });

  it('pads with zeros to 6 digits', () => {
    // Search a fixed sequence of keys for one whose code starts with 0, then check it by hand.
    for (let i = 0; i < 200; i++) {
      const publicKey = filled(32, i);
      const digest = sha256(publicKey);
      const value = new DataView(digest.buffer).getUint32(0) % 1_000_000;
      if (value < 100_000) {
        expect(approvalCode(publicKey)).toBe(String(value).padStart(6, '0'));
        expect(approvalCode(publicKey)).toHaveLength(6);
        return;
      }
    }
    throw new Error('no key with a leading zero in the fixed range');
  });

  it('rejects a key that is not 32 bytes', () => {
    expect(() => approvalCode(new Uint8Array(31))).toThrow(VaultCryptoError);
  });
});
