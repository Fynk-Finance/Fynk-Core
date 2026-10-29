---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-8]
branch: feature/vault-lock-screen
tool: Claude Code
pr: none
status: done
---

# The lock screen

## Instruction

Step 2 of the M2 plan: "the vault gate and the lock screen with the Login header". The design has no lock screen, so it is built from Login.html and flagged "new screen, needs design review".

## What was done

* **`ui/LockScreen.tsx`:**
  * the Login header: the blue background, its rounded squares, the logo and the title;
  * the lime layer and the white sheet with "Ingresar con contraseña";
  * a spinner while opening, the pending phone message, and the open errors with the shared "Reintentar" button (none for `notEncrypted`);
  * every color comes from `useTheme()`. The squares map to `headerShapeA`, `headerShapeB` and `primaryPressed`.
* **`ui/strings.es-CO.ts`:** the new copy, marked for design review.
* **Tests:** every state, in light and dark.

## Result

* `make lint-mobile` and the vault, identity and app tests pass on this commit alone.

## Decisions and problems

* The design's skewed shine rectangle isn't drawn.
* The subtitle uses the `body` variant (15/22 regular). The design's 15 px weight 500 has no variant.

## Next step

The gate and the wiring (`feature/vault-gate`).
