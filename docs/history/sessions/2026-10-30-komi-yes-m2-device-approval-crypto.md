---
date: 2026-10-30
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-63]
branch: feature/device-approval-crypto
tool: Claude Code
pr: none
status: done
---

# The device approval crypto and service

## Instruction

Daniel asked to "continue the implementation of M2 and complete what is left". This is the first half of HU-046 on the phone: the approval crypto fixed by ADR 0002, the `/device-approvals` API, and the old phone's service that seals the vault key for the new one.

## What was done

* **`domain/deviceApproval.ts`:**
  * `approvalKey` is HKDF-SHA256 of the X25519 shared secret, with info `fynk/device-approval/v1`;
  * `sealGrant` and `openGrant` use AES-256-GCM, with the lowercase approval id as AAD, so a grant works for one request only.
* **`adapters/api/deviceApprovalsApi.ts`:** the five operations, with base64 only in the adapter. Errors become `ApprovalError(kind)`.
* **`application/approveDevice.ts`:**
  * `listPending` adds the 6-digit code;
  * `approve` checks the owner, makes an ephemeral key, seals and sends, then zeroes the DEK copy, the shared secret and the ephemeral private key;
  * `reject`.
* **`adapters/confirmOwner.ts`:** biometrics (copy B) when they are on, else a fresh Keycloak login and copy A. It always asks, even with the vault open, so a phone left unlocked cannot approve by itself.
* **`adapters/crypto/x25519KeyAgreement.ts`:** X25519 from `@noble/curves` behind a port.
* **Tests:**
  * vectors computed with Node's crypto, and an X25519 round trip on both sides;
  * the approval code matches on both phones;
  * a wrong id, byte or key fails;
  * every service outcome;
  * the owner check with fakes.

## Result

* `make lint-mobile`, `make test-mobile` and `make format-check` pass.
* Pull request: not opened yet.
* No screen uses it yet. The screen and the in-app notice come in `feature/approve-new-device`.

## Decisions and problems

* **Invalid or failed biometrics fall back to the password,** without deleting copy B. The lock screen does that on its next use.
* **`notFound` is reported as `notPending`:** for the person, the request is gone either way.
* The work was done by a Sonnet 5.5 agent and reviewed by the orchestrating session, which split it from the screen to keep each pull request reviewable.

## Next step

The "Aprobar nuevo dispositivo" screen (`feature/approve-new-device`).
