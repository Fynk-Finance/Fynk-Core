---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-6]
branch: feature/identity-session-for-vault
tool: Claude Code
pr: none
status: done
---

# Give the vault what it needs from the session and the device key

## Instruction

This is part of the M2 plan Daniel approved ("continue"). The vault needs several things from identity: a fresh login to unlock without biometrics, the time of the last login, this phone's status, and an X25519 key agreement with the device key for the device approval. It must get them without ever seeing a token or the private key.

## What was done

* **`domain/session.ts`:** `authTimeOf(jwt)` reads the id token's `auth_time`. `subjectOf` and `authTimeOf` now share one decoder.
* **`SessionService`:**
  * `lastLoginAt()` returns the time of the last typed login. Keycloak keeps `auth_time` across refreshes.
  * `reauthenticate()` runs `authorize` with `prompt=login` and `max_age=0`, and reuses `changePassword`'s same-account guard, now one `adopt()` helper. It returns `ok` only if the new `auth_time` is no older than the moment the call started, minus 60 s for clock skew. A Keycloak session that skipped the login form can't unlock the vault.
  * A sign-out during the browser step keeps the app signed out, and concurrent calls share one run.
* **Device:**
  * `currentDevice()` returns the id and status from `GET /devices/current`, handling 410 like `sync()`.
  * `devicePublicKey()` returns this phone's public key.
  * `deviceSharedSecret(peer)` does the X25519 inside identity, so the private key never leaves it.
* **`index.ts`:** exports these, plus `onSessionChange` for code outside React.
* **Seguridad:** on a pending phone, "Cerrar" and "Cerrar todas las demás sesiones" are hidden and "Este dispositivo espera aprobación" is shown. The API now refuses those calls from a pending phone.
* **Tests:**
  * `authTimeOf`;
  * `lastLoginAt` across sign in, refresh and sign out;
  * `reauthenticate`: ok, cancelled, failed, another account, a stale or missing `auth_time`, sign-out during the browser step, concurrent calls;
  * `currentDevice`;
  * the RFC 7748 §6.1 vectors for the shared secret;
  * the exports;
  * the pending phone's Seguridad, in light and dark.

## Result

* `make lint-mobile`, `make test-mobile` and `make format-check` pass.

## Decisions and problems

* **The fresh-login check was added during review.** Without it, `ok` would only mean "the browser came back with the same account".
* **The dev session** answers `ok` with `lastLoginAt` set to now. It has no device, so the device functions return null or reject.

## Next step

The vault's lock screen and biometrics call `reauthenticate()` and `lastLoginAt()`. The device approval uses `deviceSharedSecret()`.
