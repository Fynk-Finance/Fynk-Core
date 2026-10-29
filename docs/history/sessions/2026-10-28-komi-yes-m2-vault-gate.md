---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-8]
branch: feature/vault-gate
tool: Claude Code
pr: none
status: done
---

# Gate the app on the unlocked vault

## Instruction

Step 2 of the M2 plan: "the vault.locked and vault.unlocked events; the vault gate".

## What was done

* **`ui/useVaultGate.ts`:** the gate is open while there is a session and the vault isn't unlocked. On sign in it calls `unlock()`, and it starts the sign out and AppState locks once. The hooks keep the same order on every render.
* **`ui/VaultFlow.tsx`:** the lock screen as the gate's flow, with a fade and no back gesture.
* **`adapters/appStateLock.ts` and `adapters/defaultLock.ts`:** the AppState wiring and the controller wired to the engine, the Keychain and identity.
* **`index.ts`:** the real `flow` and `useGate`. The exported `wipe()` also puts the controller back to locked.
* **`index.test.ts`:** the import cycle with identity works in both import orders.
* **`app/AppRoot.test.tsx` (M0):** a mock of `@modules/vault` with a closed gate, because the real gate now reads the session and the Keychain. Test only.

## Result

* `make lint-mobile`, `make test-mobile` (58 suites, 803 tests) and `make format-check` pass.

## Decisions and problems

* The events `vault.unlocked` and `vault.locked` come from the engine, not the controller, so they fire once.
* **Still needs a phone:** the lock after 5 minutes in the background, and the `prompt=login` round trip of "Ingresar con contraseña".

## Next step

Biometric unlock (`feature/biometric-unlock`).
