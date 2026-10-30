---
date: 2026-10-30
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-8, SCRUM-62, SCRUM-63]
branch: docs/key-hierarchy-adr
tool: Claude Code
pr: none
status: done
---

# ADR 0002: key hierarchy for the jury

## Instruction

The M2 prompt ("Done when") asks for `docs/adr/0002-key-hierarchy.md`, which "explains the key hierarchy for the jury, including the limitation that copy A depends on the phone's own lock". Write it in the format and tone of ADR 0007, and check every claim against the code and the contract.

## What was done

* **`docs/adr/0002-key-hierarchy.md`:** the DEK and its copies A and B, the backup key and record encryption, the recovery code and its Argon2id wrap, a new phone with the code, a new phone with approval, the backup reset, what never leaves the phone, the audit events, the security rules and the consequences.
* Claims were checked against `domain/crypto.ts`, `domain/recoveryCode.ts`, `adapters/keychain/dekStore.ts`, `application/lockController.ts`, `contracts/modules/backup.yaml` and the Go services under `services/api/internal/backup/`.

## Result

* Documentation only. Prettier passes on the file.

## Decisions and problems

* The device-approval HKDF info string (`fynk/device-approval/v1`) and the recovery associated data (`fynk/recovery/v1`) are written as decided values, because the mobile branches that use them are built in parallel.
* The limit of the code attempts counts failures, as `recovery/service.go` does, not every attempt.
* The mapping of a non-UUID module id to a UUID (version 8 layout) comes from the instruction. It is not in `develop` yet, it arrives with the backup registry branch.
* Argon2id on a real phone is still untested.

## Next step

Review the ADR against the branches that implement the recovery wrap and the approval grant, and fix any difference.
