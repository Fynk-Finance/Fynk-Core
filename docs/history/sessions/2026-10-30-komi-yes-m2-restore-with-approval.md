---
date: 2026-10-30
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-63]
branch: feature/restore-with-approval
tool: Claude Code
pr: none
status: done
---

# Restore on a new phone with the old phone's approval

## Instruction

Build the new phone's side of HU-046: "Aprobar desde mi otro teléfono". The new phone asks, shows a 6 digit code, waits for the old phone to approve, opens the grant and restores like the code path does. Share the steps after the DEK is known between the two paths.

## What was done

* **`completeRestore.ts`:** the part of `restoreWithCode` that starts once the DEK is known (wipe, copy A, open, mark, `restoreAll`, clear the mark, undo on failure). Both paths use it; the `restoreWithCode` tests did not change.
* **`restoreWithApproval.ts`:** `start()` makes a random Idempotency-Key, creates the request and returns the id, the code and the expiry (`device_already_active` becomes `alreadyActive`). `check(id)` is one poll: `waiting`, `rejected`, `expired`, `offline`, or, when approved with a grant, shared secret, `openGrant` with the approval id as AAD, `completeRestore`, and the secrets zeroed. Approved without a grant is `grantLost`.
* **`lockController.ts`:** `pendingDevice` carries `deviceStatus` (`pending` or `active`). `startApproval()` and `checkApproval(id)` set `restoring` while the restore runs and `unlocked` at the end. After `failed` or `grantLost` the phone is `active`.
* **UI:** the option card, `ApprovalWaiting` (instruction, code 3+3, "Esperando aprobación…", "Cancelar") and the `useApprovalRestore` hook that polls every 5 s and stops on cancel, a final answer, the expiry and unmount. Messages for rejected, expired, grantLost, offline and failed, with "Pedir de nuevo" for the first two.
* **Wiring:** `defaultLock.ts` passes the approvals API, `devicePublicKey` and `deviceSharedSecret` from identity.
* **Tests:** every outcome of the service with fakes, a full round trip with the real old phone service and an X25519 ephemeral key, the controller states, the screen in light and dark with fake timers.

## Result

* `make lint-mobile`, `make test-mobile` (134 suites, 1769 tests) and `make format-check` pass.
* Pull request: not opened yet.
* It needs a real pair of phones to see the whole flow.

## Decisions and problems

* **Option hidden for `active`:** the server refuses an approval for an active phone, so only the code is offered. A 409 at start makes the controller switch to `active` too.
* **`onRestoring` fires when the grant arrives**, not when the restore starts: the server clears the grant on that read, so any failure after it leaves an active phone with no key.
* **Offline during a poll** keeps waiting and shows a small notice.
* **Cancel** only leaves the screen; the request stays open on the server until it expires (10 minutes).
* **Only a phone can check:** the real X25519 key in identity, the old phone showing the same code, and the timing of the poll.

## Next step

"No tengo ninguno de los dos" (`feature/restore-without-code`).
