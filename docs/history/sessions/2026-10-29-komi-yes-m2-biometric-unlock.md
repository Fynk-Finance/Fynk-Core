---
date: 2026-10-29
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-7]
branch: feature/biometric-unlock
tool: Claude Code
pr: none
status: done
---

# The biometric button and setting

## Instruction

Step 3 of the mobile plan: "The 'Huella o Face ID' button only when copy B exists, with an immediate prompt … UnlockSetting with the CfgSeguridad 'Desbloqueo' card and Switch".

## What was done

* **`LockScreen.tsx`:** below "Ingresar con contraseña" comes the "o ingresa con" divider and the "Huella o Face ID" button, as in Login.html, only when copy B exists. The notices are a live region.
* **`VaultFlow.tsx`:** it opens the system prompt by itself once per lock.
* **`UnlockSetting.tsx`:** the "Desbloqueo" card of CfgSeguridad with the "Face ID o huella" switch, shown only on a phone with biometrics. M1's Seguridad screen already renders it.
* **Tests:** the button, the notices, the setting with a fresh and a stale login, cancel, errors, light and dark.

## Result

* `make lint-mobile`, `make test-mobile` (59 suites, 858 tests) and `make format-check` pass.

## Decisions and problems

* **Review fix:** after a lock in the background, the screen shows `locked` before the copy B lookup answers. The prompt would then never open by itself. It now opens when the button arrives, still once per lock.
* The card uses the shared `fingerprint` icon. The design's face icon isn't in `@shared/ui`.
* The switch uses the design's text, "Face ID o huella". The lock screen button keeps Login.html's "Huella o Face ID".
* **Only a phone can check:** the prompt and its texts, whether Android's write prompts, invalidation after a new fingerprint or face, and a phone without a screen lock.

## Next step

The recovery code (`feature/recovery-code`).
