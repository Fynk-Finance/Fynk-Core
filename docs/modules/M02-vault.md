# M2 Device vault, biometrics, encrypted backup and new devices

| Item | Value |
| --- | --- |
| Phase | 1 |
| Stories | HU-003 SCRUM-7 (3), HU-004 SCRUM-8 (8), HU-045 SCRUM-62 (8), HU-046 SCRUM-63 (5) |
| Points | 24 |
| Owner | Daniel Palacios (`@Komi-yes`) |
| Owns | `apps/mobile/src/modules/vault/`, `services/api/internal/backup/`, `contracts/modules/backup.yaml` |
| Depends on | M0, M1 (session, device key pair, `ActivateDevice`) |
| Used by | every mobile module that stores data (M5 to M12) |

How to use: open Claude Code at the repository root on a fresh branch from `develop` and paste everything below the line.

---

You are building module M2 of Fynk: the encrypted vault on the phone, biometric unlock, the zero knowledge backup of manual data, and moving that data to a new phone. This is the most security sensitive module. When in doubt, choose the safer option and ask.

## Read first

1. `CLAUDE.md` (Architecture rules 2 and 3, Security rules), `docs/modules/00-shared-contracts.md` sections 3.1, 3.2 and 5.
2. Design PNGs: `02-iniciar-sesion.png` (header and biometric button style), `07-mi-cuenta.png` and `07-mi-cuenta-2.png` (Seguridad row), `14-config-correo.png` (code input style), `18-config-listo.png` (summary card style). Read the code of the same screens in `docs/design/source/` first (file map in `docs/design/README.md`) and take exact values, SVGs and animations from it. The PNGs are for checking the result.
3. Jira SCRUM-7, SCRUM-8, SCRUM-62, SCRUM-63 if the Atlassian connector is available.

## Stories and criteria

**HU-004 Bóveda cifrada local (SCRUM-8)**
* La información sensible nunca se almacena sin cifrar. Conocimiento cero. El backend no puede descifrar datos del usuario.
* Llave aleatoria generada en el dispositivo y guardada en Keychain o Keystore. La contraseña de Keycloak no es la llave.
* Información básica de usuario y membresías en la nube, fuera de la bóveda.
* La llave solo sale del dispositivo cifrada, para el respaldo (HU-045) o para un nuevo dispositivo aprobado (HU-046).

**HU-003 Biometría (SCRUM-7)**
* Mecanismos nativos. Opcional. Requiere autenticación previa para activarla. Si falla, se ingresa con credenciales. Solo desbloquea, nunca es la llave.
* El botón "Huella o Face ID" solo aparece si el usuario activó la biometría en ese dispositivo. Siempre hay ingreso con contraseña.
* Si se agrega una huella o rostro nuevo al teléfono, la biometría de Fynk se invalida y se pide la contraseña.

**HU-045 Respaldo cifrado y código de recuperación (SCRUM-62)**
* Al registrarse se genera un código de recuperación que se muestra una sola vez.
* Se respaldan solo datos que el banco no devuelve: gastos manuales, efectivo, metas, aportes, topes, cambios de categoría, marcas de uso. Nunca movimientos bancarios ni token del banco.
* Todo se cifra en el dispositivo antes de subir. Iniciar sesión por sí solo nunca permite descifrar el respaldo.
* En un teléfono nuevo, después de iniciar sesión, se restaura con el código. Si se pierden teléfono y código, se informa con claridad y los datos bancarios se reconstruyen desde los 12 meses del banco.
* Eventos de auditoría de respaldo y restauración, sin contenido.

**HU-046 Aprobar un nuevo dispositivo (SCRUM-63)**
* El teléfono nuevo solicita aprobación y muestra un código de 6 dígitos. El anterior muestra la solicitud con el nombre del dispositivo y el mismo código.
* La aprobación exige biometría o contraseña en el teléfono anterior. La llave viaja cifrada para el teléfono nuevo. La solicitud vence a los 10 minutos.
* Se puede rechazar y ver la lista de dispositivos. Auditoría de solicitud, aprobación y rechazo.

## Key hierarchy

```
DEK   32 random bytes, created on the first device. Encrypts the SQLCipher vault and derives the backup key.
      Copy A: Keychain/Keystore, WHEN_UNLOCKED_THIS_DEVICE_ONLY, read after a valid Keycloak session.
      Copy B: Keychain/Keystore with biometric access control BIOMETRY_CURRENT_SET (iOS) and a key
              invalidated by new enrollment (Android). Only exists if the user enabled biometrics.
BK    backup key = HKDF-SHA256(DEK, info 'fynk/backup/v1'). Encrypts each backup record with AES-256-GCM.
RK    recovery key = Argon2id(recovery code, salt 16 bytes, m 64 MiB, t 3, p 1), 32 bytes.
      wrappedDek = AES-256-GCM(RK, DEK). Stored in the cloud with salt and parameters.
Device approval: new phone X25519 key pair (from M1). Old phone does X25519(ephemeral, newPub),
      HKDF to a 32 byte key, AES-256-GCM(DEK). Only the ciphertext and the ephemeral public key go through the server.
```

* Recovery code: 128 random bits shown as 26 Crockford base32 characters in 5 groups (`K7Q2M 9XD4T ...`). Never stored anywhere in clear, never sent to the server.
* 6 digit approval code: the first 4 bytes of SHA-256 of the new device public key, read as an unsigned integer, modulo 1.000.000, zero padded to 6 digits, shown on both phones. The user compares them, which stops the server from swapping keys.
* Libraries (pin versions, record them in `docs/adr/`): `@op-engineering/op-sqlite` with SQLCipher and FTS5 enabled, `react-native-keychain`, `react-native-argon2`, `@noble/ciphers`, `@noble/hashes`, `@noble/curves`, `expo-crypto` for random bytes.

## Technical design

### Vault (`modules/vault/`)

* Implements `VaultDb`, `registerVaultMigrations`, `getVaultDb` exactly as in the shared contracts. Migrations are applied per module in registration order and tracked in `vault_migrations(module, version, applied_at)`.
* Lock states: `locked`, `unlocking`, `unlocked`. The vault locks when the app goes to background for more than 5 minutes and on sign out. Emit `vault.locked` and `vault.unlocked`.
* `wipe()`: closes and deletes the database file, deletes copies A and B, clears backup state. Used on sign out from a removed device and on account deletion.
* `exportAll()` for M13 data export: returns every registered backup collection plus bank data as JSON, decrypted, for the user to save.

### Lock screen (new screen, reuse the header of Iniciar sesión)

* Shown at app start when a session exists. If biometrics are enabled: prompt immediately, button "Huella o Face ID" and link "Ingresar con contraseña" (opens Keycloak login from M1). Without biometrics: go straight to the Keycloak login.
* Settings in Mi cuenta, Seguridad: toggle "Desbloquear con huella o Face ID". Turning it on requires a fresh Keycloak login in the last 5 minutes.

### Backup (`modules/vault/backup/` and `services/api/internal/backup/`)

* `registerBackupCollection` and `markDirty` as in the contracts. A background queue (only while the app is open) uploads dirty records 5 seconds after the last change and on app close.
* Record envelope sent to the server: `{ collection, recordId, version, deleted, nonce, ciphertext }`. AAD = `userId|collection|recordId|version`. The server never sees field names or values.
* Restore: download all records, decrypt, call `importAll` per collection, highest version wins.

Backend schema `backup`:

```sql
create table backup.records (
  user_id text not null,
  collection text not null,
  record_id uuid not null,
  version bigint not null,
  deleted boolean not null,
  nonce bytea not null,
  ciphertext bytea not null,
  updated_at timestamptz not null,
  primary key (user_id, collection, record_id)
)
create table backup.recovery_keys (
  user_id text primary key,
  wrapped_dek bytea not null, nonce bytea not null, salt bytea not null,
  kdf text not null, kdf_params jsonb not null, created_at timestamptz not null
)
create table backup.device_approvals (
  id uuid primary key, user_id text not null, new_device_id uuid not null,
  new_device_public_key bytea not null, status text not null,
  ephemeral_public_key bytea, wrapped_dek bytea, nonce bytea,
  created_at timestamptz not null, expires_at timestamptz not null, decided_at timestamptz
)
```

* `PUT /backup/records` accepts up to 200 records, rejects a version lower than the stored one with `409 stale_version`. Limit 5 MB per user.
* `GET /backup/records` pages by `updatedAfter` cursor.
* `PUT /backup/recovery-key` and `GET /backup/recovery-key`. Only a device with status `active` may call PUT.
* Device approvals: `POST /device-approvals` (new device, pending), `GET /device-approvals/pending` (old device, polled every 5 s while the approval screen is open), `GET /device-approvals/{id}` (new device polls), `POST /device-approvals/{id}/approve` (old active device sends ephemeral key, wrapped DEK, nonce, then calls identity `ActivateDevice`), `POST /device-approvals/{id}/reject`. Requests expire after 10 minutes.
* Audit: `backup.uploaded` (count only), `backup.restored`, `recovery_key.set`, `device.approved`, `device.rejected`.

### Screens

* **Código de recuperación**: shown once after registration. Title "Guarda tu código de recuperación", the 26 characters in 5 groups in the monospace font, buttons "Copiar" and "Ya lo guardé", warning "Si pierdes tu teléfono y este código, no podremos recuperar tus metas ni tus gastos manuales." To finish, the user types back the last group. Option in Mi cuenta to generate a new code (old one stops working).
* **Restaurar en un teléfono nuevo**: after login on a pending device. Two options: "Aprobar desde mi otro teléfono" (shows the 6 digit code and waits) and "Usar mi código de recuperación" (26 character input, tolerant to spaces and lowercase). Third option "No tengo ninguno de los dos" explains the consequence and starts with an empty vault plus bank resync.
* **Aprobar nuevo dispositivo** (old phone): card with device name, platform and the 6 digit code, buttons "Aprobar" (biometrics or password) and "Rechazar". Reachable from a notification inside the app and from Mi cuenta, Dispositivos vinculados.

## Work plan (one branch each, from `develop`)

1. `feature/sqlcipher-vault`: VaultDb, migrations runner, key copy A, lock states, wipe. Test that the file cannot be read without the key.
2. `feature/biometric-unlock`: copy B, lock screen, settings toggle, invalidation on new enrollment.
3. `feature/recovery-code`: generation, screen, Argon2id wrap, `PUT /backup/recovery-key`.
4. `feature/encrypted-backup-sync`: backend schema and endpoints, upload queue, restore with the code.
5. `feature/new-device-approval`: endpoints, both screens, polling, activation.

## Tests

* Crypto unit tests with fixed vectors: wrap and unwrap DEK, record encryption with AAD, tampering with any byte or with the AAD fails.
* The database file opened with plain SQLite fails. Copy B disappears after simulating a biometric enrollment change.
* Server side test: a stored record never contains the plaintext of the test payload (search the bytes).
* Login on a new device without code or approval cannot read any record.
* An approval older than 10 minutes cannot be approved. A device that is not `active` cannot approve.
* Maestro flow: device A registers, creates a goal, device B logs in, restores with the code, sees the goal.

## Done when

* Every criterion passes. Gate B items about the vault and restore pass on staging.
* `docs/adr/0002-key-hierarchy.md` explains the key hierarchy for the jury, including the limitation that copy A depends on the phone's own lock.

## Ask before

* Changing Argon2id parameters, the algorithms, or what goes into the backup.
* Adding any server endpoint that could return a decryptable key.
