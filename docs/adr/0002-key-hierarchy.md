# ADR 0002: Key hierarchy of the vault, the backup and new devices

* Status: accepted
* Date: 2026-10-30
* Owner: M2 Vault and backup (Daniel Palacios / `@Komi-yes`)
* Jira: SCRUM-8 (HU-004), SCRUM-7 (HU-003), SCRUM-62 (HU-045), SCRUM-63 (HU-046)

## Context

Fynk is zero knowledge (architecture rules 2 and 3 in `CLAUDE.md`). Movements, balances, goals and caps live only in an encrypted vault on the phone. The backend may store a backup, but only as ciphertext it cannot open. Logging in with Keycloak must never decrypt anything, so the vault key cannot be the password or come from it.

Four stories depend on one key design:

* HU-004: a vault that is encrypted on the phone, with a key that never leaves it in clear.
* HU-003: biometrics that unlock the vault but are not the key.
* HU-045: a cloud backup of the data the bank does not return (manual expenses, cash, goals, contributions, caps, category changes, usage marks) and a recovery code.
* HU-046: moving the key to a new phone, approved from the old one.

This ADR explains the whole hierarchy for the jury, including its honest limits.

## Decision

One random key, the DEK, protects everything. Every other key is derived from it or protects a copy of it.

```
DEK   32 random bytes made on the first phone (expo-crypto). It is the SQLCipher raw key x'<64 hex>'.
 |    The vault refuses to open if SQLCipher is not active.
 |
 +-- Copy A  Keychain / Keystore, WHEN_UNLOCKED_THIS_DEVICE_ONLY, no cloud sync.
 |           Read only after a fresh Keycloak login (5 minutes) or the password again.
 +-- Copy B  Keychain / Keystore with BIOMETRY_CURRENT_SET. Only exists if the person turned biometrics on.
 |           A new fingerprint or face invalidates it. It only unlocks; it is never the key.
 |
 +-- BK = HKDF-SHA256(DEK, info "fynk/backup/v1")
 |        AES-256-GCM per backup record. Never stored.
 |
 +-- proof = HKDF-SHA256(DEK, info "fynk/device-proof/v1")
 |        The server keeps SHA-256(proof) only. A new phone sends the proof once to be activated.
 |
 +-- Recovery code: 128 random bits, shown once, never stored or sent.
 |     RK = Argon2id(code, salt 16 bytes, m 64 MiB, t 3, p 1) -> 32 bytes
 |     wrappedDek = AES-256-GCM(RK, DEK)           stored in the cloud with salt and parameters
 |
 +-- Device approval: X25519 between the old phone (ephemeral key) and the new phone (key from M1)
       HKDF-SHA256(shared, info "fynk/device-approval/v1") -> 32 bytes
       grant = AES-256-GCM(that key, DEK)            goes through the server once
```

### The DEK and its two copies

* The DEK is 32 random bytes made on the phone with `expo-crypto`. The password is not involved.
* SQLCipher gets it as a raw key (`x'<hex>'`), so SQLCipher does not derive anything from a passphrase. The vault checks `PRAGMA cipher_version` after opening and throws if SQLCipher is not there. It never falls back to a plain SQLite file.
* **Copy A** lives in the Keychain (iOS) or Keystore (Android) with `WHEN_UNLOCKED_THIS_DEVICE_ONLY` and no cloud sync. So it is not in iCloud or Google backups and never moves to another phone. The app reads it only after a Keycloak login in the last 5 minutes, or after the password is asked again.
* **Copy B** is a second copy with biometric access control `BIOMETRY_CURRENT_SET` (a biometric-bound key on Android). If a fingerprint or face is added or removed, the system makes it unreadable, and the app deletes it and asks for the password. Copy B only opens the vault. The DEK stays the key.

**Limitation: copy A is only as strong as the phone's own screen lock.** The operating system decides when copy A is readable, and it is readable whenever the phone is unlocked. On a phone with no passcode, anyone who holds the phone can open the app, log in and open the vault. Fynk cannot fix that, because the protection comes from the operating system. What Fynk adds:

* the vault locks after 5 minutes in the background and on sign out;
* a Keycloak login alone opens nothing on a new phone, because copy A does not exist there until the person restores with the code or with an approval;
* if the person removes the phone from their devices, the phone ends the session and wipes the vault and both copies.

### The backup

* **BK** is `HKDF-SHA256(DEK, info "fynk/backup/v1")`. It is derived on demand and never stored.
* Each record is encrypted on the phone with AES-256-GCM, a random 12-byte nonce, and the associated data `userId|collection|recordId|version`. The plaintext is `{id, data}`. The AAD ties the ciphertext to its owner, collection, id and version, so the server cannot move a record to another place or replay an old version.
* The server sees collection names, record ids, versions, a deleted flag, nonces and sizes. It never sees field names or values.
* The API needs a UUID as `recordId`. A module id that is not a UUID is mapped to a deterministic UUID (version 8 layout) taken from SHA-256 of `collection|id`. The real id travels inside the ciphertext and is the one the module gets back.
* Limits: 200 records per upload, 64 KiB per record, 5 MB per user. A lower version than the stored one is refused with `409 stale_version`.
* Only data the bank does not return goes in. Bank tokens and bank movements are never backed up.

### The recovery code

* 128 random bits, shown as 26 Crockford base32 characters in 5 groups. It is shown once at sign up. It is never stored in clear on the phone and never sent to the server.
* **RK** is `Argon2id(code as text, salt 16 random bytes, m 64 MiB, t 3, p 1)` with a 32-byte output. The text is the canonical 26 characters, so spaces, lowercase and `I`, `L`, `O` typos are normalized before it.
* **wrappedDek** is `AES-256-GCM(RK, DEK)` with a random 12-byte nonce and the associated data `fynk/recovery/v1`.
* The server stores the wrapped DEK, the nonce, the salt, the parameters and `SHA-256(proof)`. The contract fixes the parameters, so the server rejects any other value. It never returns the hash.
* The upload happens only after the person types the last group back. If the app dies before that, nothing was uploaded, and the next unlock makes a new code.
* A new code replaces the old one, which stops working.

### A new phone with the code

1. After login the phone is `pending`. It calls `GET /backup/recovery-key` and gets the wrapped DEK, nonce, salt and parameters. This is allowed for a pending device because the wrapped key is useless without the code.
2. The person types the code. The phone derives RK and opens the DEK. A wrong code fails here, on the phone, and the server hears nothing.
3. The phone derives the proof from the DEK and sends it to `POST /backup/recovery-key/activate`. The server compares `SHA-256(proof)` in constant time. It allows 5 failures per hour for each user, then answers `429 too_many_attempts` without comparing.
4. The server activates the device. The phone keeps the DEK as copy A, downloads the records page by page, decrypts them and imports them. When two copies of a record exist, the highest version wins.

### A new phone with approval from the old one

1. The new phone has an X25519 key pair from M1 and asks `POST /device-approvals`. It shows a 6-digit code: the first 4 bytes of SHA-256 of its public key, read as an unsigned integer, modulo 1,000,000. The old phone shows the same code with the device name. The person compares the two. If the server had swapped the public key, the codes would differ.
2. The old phone asks for biometrics or the password. Then it makes an ephemeral X25519 key pair, computes the shared secret with the new phone's public key and derives a 32-byte key with `HKDF-SHA256(shared, info "fynk/device-approval/v1")`.
3. It sends `AES-256-GCM(DEK)` with a random 12-byte nonce and the approval id as associated data, plus the ephemeral public key, to `POST /device-approvals/{id}/approve`. The server stores them and activates the new device. It cannot open the grant.
4. A request expires after 10 minutes. The new phone polls it and can read the grant only once: the server clears it in the same transaction. Then the new phone derives the same key, opens the DEK and restores the records as above.
5. The old phone can also reject the request. The new phone stays pending.

The HKDF info string `fynk/device-approval/v1` and the recovery associated data `fynk/recovery/v1` are fixed by this ADR. They are decided values, and the implementations on the mobile side follow them.

### Lost phone and lost code

If the person has neither the old phone nor the code, nobody can open the backup, by design. The option "No tengo ninguno de los dos" calls `POST /backup/reset`. The server allows it only when:

* the password was reset with the email code in the last 10 minutes (the stamp from ADR 0007), and
* the calling session began after that reset, so it is a new sign-in.

Then the server deletes every backup record and the recovery key, removes the other devices and revokes their sessions, and activates the calling device. The phone makes a new DEK and a new recovery code and starts an empty vault. Bank data comes back from the bank's 12 months. Goals, manual expenses, caps and usage marks are lost.

### What never leaves the phone

* The DEK in clear.
* The recovery code and RK.
* Bank tokens.
* Bank movements, balances and every field value of the vault.

### Audit events

Each event carries ids and counts, never content or key material.

| Event | When |
| --- | --- |
| `backup.uploaded` | A batch of records is stored (count only) |
| `backup.restored` | A new phone is activated with the code, or reads an approval grant |
| `recovery_key.set` | A recovery key is stored or replaced |
| `device.approved` | An approval is granted, or a device is activated with the code |
| `device.rejected` | An approval is rejected |
| `backup.reset` | The backup is deleted after an email-code reset |

## Security rules

* **Randomness:** the DEK, the recovery code, nonces, salts and ephemeral keys come from the OS random source. The `domain/` code is pure and receives them as parameters.
* **AES-256-GCM everywhere.** Every ciphertext has a fresh random 12-byte nonce and associated data that binds it to its purpose. Any change to the ciphertext, tag, nonce or associated data makes opening fail.
* **The server never holds a key that opens anything.** It stores the wrapped DEK, which opens only with the code, and the approval grant, which opens only with the new phone's private key. The proof hash cannot give the DEK. No endpoint may return a decryptable key (this is a rule of the module prompt).
* **Guessing the code online is limited** to 5 failures per hour per user. Guessing it offline from a stolen wrapped DEK is slowed by Argon2id (64 MiB, 3 passes) and bounded by 128 bits of entropy.
* **Approval needs the old phone:** an active device, biometrics or the password, and a matching 6-digit code. The server rejects an approval from a device that is not active, and one older than 10 minutes.
* **Nothing sensitive is logged.** No key, code, proof, nonce, ciphertext, id or device name reaches a log, an audit event or an error message. Error classes carry only a kind.
* **Biometrics never replace the password.** If copy B is invalid, the person logs in with the password.
* **Binary fields** in the API are standard base64 with padding.

## Consequences

* **Zero knowledge holds.** A database dump of the backend gives ciphertext, wrapped keys and hashes. Without the phone, the code or an approval, none of it opens.
* **Copy A depends on the phone's own lock.** See the limitation above. It is a finding for the jury, not a hidden gap. A phone without a screen lock gets weaker protection than the design assumes.
* **Argon2id runs natively** through the legacy bridge `react-native-argon2` (the dependency in `apps/mobile/package.json`). It has to be tested on a real iOS and Android phone for time and memory before Gate B. The parameters cannot change without a team decision and a new `kdf` version.
* **Losing both the phone and the code loses the manual data.** That is the price of zero knowledge. The app says so clearly at sign up and in the restore screen. Bank data is rebuilt from the bank.
* **The server learns some metadata:** collection names, record ids, versions, counts, sizes and times. It does not learn field names or values. This is why the audit of an upload carries only a count.
* **Replacing the recovery code** invalidates the old one at once, but it does not re-encrypt the backup. The records stay under BK, which comes from the DEK, and the DEK does not change.
* **"Copiar" puts the recovery code on the system clipboard,** where other apps on the phone may read it. The button exists because people save the code in a password manager or a note. The screen still asks them to type the last group back, and the app never reads the clipboard. Clearing the clipboard after a while is not reliable on iOS or Android, so it is not promised.
* **A DEK rotation is not designed in the MVP.** If the DEK leaked, the fix would be a backup reset with a new DEK.
* **The hierarchy is versioned** through the info strings (`/v1`). A change of algorithm adds a new string and a migration. It does not edit the old one.
