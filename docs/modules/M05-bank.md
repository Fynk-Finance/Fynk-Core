# M5 Bank connection and sync

| Item | Value |
| --- | --- |
| Phase | 1 (Banco Demo), 2 (Bancolombia adapter) |
| Stories | HU-009 SCRUM-23 (8), HU-010 SCRUM-24 (5), HU-011 SCRUM-25 (3), HU-030 SCRUM-44 (8), HU-031 SCRUM-45 (5) |
| Points | 29 |
| Owner | Juan Carlos Leal (`@JuanLeal05`) |
| Owns | `services/api/internal/bank/`, `contracts/modules/bank.yaml`, `apps/mobile/src/modules/bank/` |
| Depends on | M1 (session), M2 (vault), M4 (consents), M14 (Caddy egress, KMS keys, certificates), M16 (Banco Demo API) |
| Used by | M6, M7, M9, M10 (they read what sync writes), M3, M15 |

How to use: open Claude Code at the repository root on a fresh branch from `develop` and paste everything below the line.

---

You are building module M5 Bank connection and sync of Fynk. The backend is the confidential OAuth client towards each bank (FAPI 2.0 style). The phone keeps the bank tokens encrypted in its vault. The backend never stores a bank token or a movement. It only passes them through.

## Read first

1. `CLAUDE.md` (Architecture rules 4 and 7, Security rules), `docs/modules/00-shared-contracts.md` sections 2, 3.3, 4.4, 4.5 and 5.
2. `docs/modules/M16-banco-demo.md`, sections API and OAuth, because you are its main client.
3. Design PNGs `20-conectar-banco.png`, `15-config-cuentas.png`, `09-billetera.png` and `09-billetera-2.png` ("Mis cuentas" with "+ Conectar"), `08-notificaciones.png` (sync result). Read the code of the same screens in `docs/design/source/` first (file map in `docs/design/README.md`) and take exact values, SVGs and animations from it. The PNGs are for checking the result.
4. Jira SCRUM-23, SCRUM-24, SCRUM-25, SCRUM-44, SCRUM-45.

## Stories and criteria

**HU-009 Vincular institución (SCRUM-23)**
* El usuario elige la entidad. Después de autorizar en el portal del banco se muestran las cuentas que el banco devolvió, o un mensaje claro si no hay ninguna. No se solicita ni se almacena la cédula. Flujo seguro. Estado de conexión confirmado. Errores de autenticación manejados. El token se custodia en el dispositivo, no en el backend.

**HU-010 Sincronizar cuentas (SCRUM-24)**
* Sincronización correcta. Saldos y metadatos actualizados. Errores registrados. Fecha de última actualización. Solo con la aplicación abierta. Historial de los últimos 12 meses.

**HU-011 Actualización con la aplicación abierta (SCRUM-25)**
* Al abrir la aplicación, al deslizar para actualizar, y al volver al primer plano después de 15 minutos. Espera mínima de 60 segundos entre actualizaciones. Solo movimientos posteriores a la última sincronización. Sin segundo plano. Límites de API respetados. Eventos registrados. Resultado informado. Texto de Conectar banco: "Se actualizan cada vez que abres Fynk o deslizas para actualizar".

**HU-030 OAuth 2.0 (SCRUM-44)**
* Cumple estándares, renueva tokens, protege contra accesos indebidos, integra con Open Finance.

**HU-031 mTLS hacia Open Finance (SCRUM-45)**
* Certificado de ambas partes validado. Tráfico no autorizado rechazado. Rotación de certificados. Evidencia de conexión registrada.

## Link flow

```
Phone                         Fynk API (bank module)                Caddy egress          Bank (Banco Demo / Bancolombia)
1. user accepts consent  ->   M4 POST /consents (pending)
2. create PKCE verifier,
   challenge, state       ->  POST /bank/authorizations
                              PAR with private_key_jwt (KMS PS256) -> adds client cert -> /par  (mTLS)
                         <-   authorizeUrl, authorizationId
3. open authorizeUrl in the system browser (expo-web-browser openAuthSessionAsync)
   user logs in at the bank and approves -> redirect fynk://bank/callback?code&state
4. check state            ->  POST /bank/authorizations/{id}/exchange {code, codeVerifier}
                              token request, private_key_jwt        -> client cert   -> /token (mTLS)
                              M4 MarkGranted, store link with HMAC fingerprint of the refresh token
                         <-   {accessToken, refreshToken, expiresIn, linkId}   (not stored on the server)
5. save tokens in vault table bank_tokens, run first sync (12 months)
```

* PAR request includes `client_id`, `redirect_uri`, `scope` mapped from the consent scopes, `code_challenge` (S256), `state`, `nonce`, the consent id. `state` is checked on the phone. The authorization id expires in 10 minutes in Redis.
* Client assertion JWT for `private_key_jwt`: signed by an asymmetric AWS KMS key (`RSASSA_PSS_SHA_256`, alg PS256), `jti` random, `exp` 60 s. The private key never leaves KMS.
* The mTLS client certificate lives only on the Caddy egress (M14). The API calls `https://caddy.internal/<provider>/...` and Caddy forwards to the bank with the client certificate. Locally, docker compose does the same with a local CA.
* Token fingerprint: KMS `GenerateMac` (HMAC_SHA_256) over the refresh token. On every refresh the device sends the old refresh token, the API checks its fingerprint against the link, then stores the new fingerprint. A refresh token from another user or a revoked link is rejected.
* Replay protection: each phone request to `/bank/*` includes a nonce header, kept 5 minutes in Redis.

## Sync engine (phone)

* Triggers: vault unlocked, pull to refresh on Dashboard, Billetera and Movimientos, and `AppState` back to `active` after 15 minutes. Cooldown 60 s per link stored in the vault. No timers in background, no background fetch.
* For each active link: refresh the access token if it expires in less than 60 s, `POST /bank/accounts/query`, then for each account `POST /bank/transactions/query` with `since = lastSyncedAt minus 3 days` (overlap to catch pending movements that became booked), paging by cursor. First sync uses 12 months.
* Upsert accounts by `(provider, providerAccountId)` and movements by `(accountId, providerTxId)`. Pending movements that disappear are deleted. Set `merchantKey` with `normalizeMerchant`. Leave `categoryId` as `other` with `categorySource='rule'`, M7 categorizes on `sync.completed`.
* Emit `sync.completed` with new transaction ids and changed account ids, or `sync.failed` with a code. Show the result as a small toast and as an M12 notification "<Entidad> sincronizada · Tus movimientos están al día." (deduped per day).
* A `409 consent_revoked` marks the link revoked, deletes its tokens and shows "Reconecta <Entidad>" on its card.

## Backend

Schema `bank`:

```sql
create table bank.links (
  id uuid primary key, user_id text not null, device_id uuid not null,
  provider text not null, consent_id uuid not null,
  token_fingerprint bytea not null, status text not null,  -- active, revoked
  created_at timestamptz not null, last_refreshed_at timestamptz, revoked_at timestamptz
)
```

* Endpoints in `contracts/modules/bank.yaml`: `GET /providers` (id, display name, kind, isSimulated, supported scopes, logo key), `POST /bank/authorizations`, `POST /bank/authorizations/{id}/exchange`, `POST /bank/accounts/query`, `POST /bank/transactions/query`, `POST /bank/tokens/refresh`. All query endpoints take the access token in the body.
* Before every call to a bank: `ConsentChecker.Active`, link `active`, link belongs to the user and the device.
* Map provider responses to the shared `Account` and `Transaction` shapes. Amounts to centavos as integers. Only the last 4 digits of account numbers leave the adapter.
* Rate limit per user: 30 bank queries per minute in Redis. Upstream `429` is passed back with `Retry-After`.
* `Revoker` port for M4: client credentials token (private_key_jwt) then `DELETE /consents/{providerConsentID}` at the bank.
* `Products()` port for M15: public CDT products, no user token.
* Audit: `bank.link_created`, `bank.sync` (provider, accounts count, movements count), `bank.sync_failed`, `bank.token_refreshed`. Log the mTLS handshake result (certificate serial, not the key) as connection evidence.

### Adapters

* `adapters/bankdemo`: full implementation against `contracts/bank-simulator.yaml`. Covers Banco Demo and Billetera Demo (same simulator, two provider ids).
* `adapters/bancolombia`: first a 3 day spike (branch `spike/bancolombia-sandbox`) to answer whether the sandbox allows delegated access to a person's accounts with authorization code. Write the answer in `docs/adr/0003-bancolombia-sandbox.md`. If yes, implement the adapter in Phase 2. If no, keep the adapter returning `provider_unavailable` and document the finding for the jury. Do not use any flow that asks for the user's bank password inside Fynk.

## Mobile exports (`index.ts`)

`ConnectBankScreen` (hosts M4's consent card), `ConnectBankButton`, `BankLinkList` (used by onboarding step 3: logo tile, name, kind, "Conectada" with check, balance), `useSync()` (state, lastSyncedAt, `refresh()`), `syncNow()`, `getLinks()`, `useProviders()`.

## Work plan (one branch each, from `develop`)

1. `feature/bank-provider-port`: port, Banco Demo adapter, Caddy routing in local compose, contract file.
2. `feature/bank-link-with-par-and-pkce`: authorizations, exchange, KMS signer (local: a file key behind the same interface), links table, fingerprints.
3. `feature/mobile-connect-bank-flow`: Conectar banco screen with M4, browser handoff, callback, token storage in the vault.
4. `feature/mobile-sync-engine`: triggers, cooldown, incremental sync, events, revoked handling.
5. `spike/bancolombia-sandbox`, then `feature/bancolombia-adapter` or `docs/bancolombia-finding`.

## Tests

* Contract tests for the Banco Demo adapter against the running simulator in docker compose.
* A refresh token from user A on user B's link is rejected. A replayed nonce is rejected.
* Sync with an injected clock: two pulls within 60 s make one network call. A payment created in the Banco Demo portal appears after the next pull to refresh.
* First sync stores exactly 12 months. Incremental sync with 3 days of overlap creates no duplicates.
* Without the client certificate the Banco Demo rejects the connection (test through Caddy with and without the cert).

## Done when

* All criteria pass. Gate B items about linking and sync pass on staging. The Bancolombia ADR is merged.

## Ask before

* Storing anything new in the backend, changing the sync triggers, or using an aggregator.
