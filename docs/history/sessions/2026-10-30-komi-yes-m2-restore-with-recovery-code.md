---
date: 2026-10-30
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-62]
branch: feature/restore-with-recovery-code
tool: Claude Code
pr: none
status: done
---

# Restore on a new phone with the recovery code

## Instruction

HU-045: "Restore on a new phone with the recovery code". The phone that is pending, or active with no local key while the server has a recovery key, must let the person type the code. A wrong code is found on the phone; only a right one activates the device, writes copy A, opens the vault and downloads the backup.

## What was done

* **API:** `RecoveryKeyApi.activate(proof)` over `POST /backup/recovery-key/activate`. The errors become `RecoveryError` kinds `mismatch`, `tooMany`, `removed` and `noKey`.
* **`restoreWithCode.ts`:** parse the code, read the recovery key, derive RK, open the DEK on the phone (wrong code ends here, the server hears nothing), send the device proof, then wipe the old file, write copy A, open the vault, set the restore mark, `restoreAll`, clear the mark. RK, proof and DEK bytes are zeroed at the end.
* **Restore mark:** vault migration 2 creates `vault_state`; `restoreState.ts` sets, reads and clears `restore_pending`. After any open with the backup on, the lock controller resumes a restore that was cut short, in the background.
* **Lock controller:** new state `restoring`, new `restoreError` on `pendingDevice`, and `restoreWithCode(typed)`. Wired in `defaultLock.ts` with `restoreAll` from `defaultBackup.ts`.
* **UI:** `RestoreScreen.tsx` replaces the static pending text. Title, text, the "Usar mi código de recuperación" option, the code field, "Restaurar", the error texts and the "Cerrar sesión" link. Two comment slots mark where the next branch adds "Aprobar desde mi otro teléfono" and "No tengo ninguno de los dos".

## Result

* `make lint-mobile`, `make test-mobile` (126 suites, 1604 tests) and `make format-check` pass.
* Tests cover every outcome with fakes, including "a pending phone never reads records or opens the vault without the right code".

## Decisions and problems

* **Partial result:** if the download fails after the vault opened (offline), `restore` answers `partial`, not a failure. The controller unlocks, the mark stays and the next open retries.
* **`restoring` keeps the screen:** the restore screen stays mounted in `pendingDevice` and `restoring`, so the typed code survives an error. The form is replaced by the spinner text.
* **Failed write or open after activation:** the vault is closed and copy A removed, so the phone is a pending-like phone again. Activating twice answers 204, so a retry works.
* **Wipe before write:** a left-over vault file cannot be read with the new key, so `vault.wipe()` runs after the activation and before copy A is written.
* **Field size:** one field of 26 characters in IBM Plex Mono at 15 px, not the six boxes of OnbCorreo.html at 22 px, so it fits the width.
* **Only a phone can check:** the real Argon2id time on a low-end device, the keyboard behaviour of the field, and the restore of a real backup.

## Next step

Approval from the other phone and "No tengo ninguno de los dos" (SCRUM-63).
