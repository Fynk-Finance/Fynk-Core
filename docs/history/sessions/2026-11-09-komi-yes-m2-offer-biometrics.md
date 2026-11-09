---
date: 2026-11-09
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-96]
branch: feature/offer-biometrics-after-unlock
tool: Claude Code
pr: "#348"
status: partial
---

# Offer biometrics once after a password unlock

## Instruction

Daniel said the lock screen "should give the option with the face id or huella". The button only shows once biometrics are on, and the only switch was in Mi cuenta › Seguridad. between keeping that and asking once after the first password unlock, Daniel chose the second.

## What was done

* `lockController.ts`: a new `biometricOffer` state, entered only after a password unlock on the lock screen, and `finishBiometricOffer()`. The vault is already open behind it and it locks after 5 minutes away like the open app.
* `DekStore` port and `adapters/keychain/dekStore.ts`: a yes/no mark under `co.fynk.app.vault.biometricOffer`. `removeAll` removes it.
* `ui/BiometricOfferScreen.tsx`, new, with "Activar" and "Ahora no". `VaultFlow.tsx` shows it. Copy in `strings.es-CO.ts`.
* `CLAUDE.md`, "Where data lives": a row for the mark.
* Tests: `one-time biometrics offer` in `lockController.test.ts`, `biometrics offer mark` in `dekStore.test.ts`, `BiometricOfferScreen.test.tsx`, and one in `VaultFlow.test.tsx`.

## Result

* Tests: 2,779 pass in the whole mobile suite, `tsc` clean. ESLint and Prettier clean on the changed files.
* Not checked on a device. The emulator has no fingerprint enrolled, so the screen cannot appear there, and enrolling one needs a PIN on the emulator.
* Pull request: #348.

## Decisions and problems

* The mark is saved before the question shows, so a failure can never repeat it. If it cannot be saved, the person goes straight in.
* On a phone with no biometrics the offer is not spent, so it comes once the person enrolls one.
* If a missing recovery code would also be due, the offer goes first and the recovery check repeats on the next unlock.
* The button's rule stays as the team decided: it shows only where biometrics are on.

## Next step

Check the screen on a phone or emulator with a fingerprint enrolled, in light and dark, then design review.
