---
date: 2026-10-30
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-63]
branch: feature/approve-new-device
tool: Claude Code
pr: none
status: done
---

# Approve a new device from the old phone

## Instruction

Build the old phone's side of HU-046 on top of `feature/backup-sync`: the approval crypto fixed by ADR 0002, the `/device-approvals` API adapter, the service that seals the DEK for the new phone, an owner check with biometrics or the password, the "Aprobar nuevo dispositivo" screen, an in-app notice, and an "Aprobar" action in M1's Seguridad. The new phone's side belongs to the restore branch.

## What was done

* **`domain/deviceApproval.ts`:** `approvalKey` (HKDF-SHA256 of the X25519 shared secret, info `fynk/device-approval/v1`), `sealGrant` and `openGrant` with the lowercase approval id as AAD. Tests use vectors made with Node's crypto and a round trip with real X25519 on both sides.
* **`adapters/api/deviceApprovalsApi.ts`:** the five operations with base64 only in the adapter; errors become `ApprovalError(kind)` in `application/ports.ts`.
* **`application/approveDevice.ts`:** `listPending` (adds the 6 digit code), `approve` (owner check, ephemeral key, shared secret, seal, send, wipe), `reject`. X25519 sits behind a `KeyAgreementPort` (`adapters/crypto/x25519KeyAgreement.ts`).
* **`adapters/confirmOwner.ts`:** copy B behind the prompt when it exists, else a fresh Keycloak login and copy A. It always asks, even with the vault open.
* **`ui/ApproveDeviceScreen.tsx`:** polls every 5 s only while focused; card per request with device, platform, code 3+3, minutes left, Aprobar and Rechazar, and every message. Registered as `vault.ApproveDevice`, path `boveda/aprobar`.
* **`application/approvalNotifier.ts`:** on `vault.unlocked` and on foreground (once a minute) it notifies each request through M12, lazily loaded.
* **Identity:** `DeviceRow` and `SecurityScreen` show "Aprobar" on a pending row when this phone is active and navigate to `vault.ApproveDevice` by name.

## Result

* `make lint-mobile`, `make test-mobile` (122 suites, 1538 tests) and `make format-check` pass.
* Only a phone can check: the biometric prompt and the Keycloak login of the owner check, and the look of the new screen and the extra button on the device row.

## Decisions and problems

* **No `isEnabled` check in the notifier:** M12 keeps `device_approval` always on, so a security notice never depends on a switch.
* **A failed password check throws and the service answers `failed`;** only a cancel answers `cancelled`.
* **An invalidated copy B falls back to the password** without deleting copy B; the lock screen does that on its next use.
* **A request whose public key is not 32 bytes is hidden** by the adapter, since it could not be approved.
* **`notFound` is reported as `notPending`:** for the person, the request is gone.
* **The Seguridad route is the literal `identity.Security`** in the vault index, because identity is still loading when the vault index loads (import cycle).
* The new screen and the "Aprobar" button on the device row are not in the design: they need design review.

## Next step

The restore branch: the new phone creates the request, shows the code, polls and opens the grant.
