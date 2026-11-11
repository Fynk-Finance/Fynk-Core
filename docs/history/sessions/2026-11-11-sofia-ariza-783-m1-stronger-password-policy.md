---
date: 2026-11-11
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M1
jira: [SCRUM-91]
branch: feature/stronger-password-policy
tool: Claude Code
pr: none
status: done
---

# Stronger passwords: a special character and no reuse of the current one (QA F1)

## Instruction

QA review 2026-11-07, item F1. Sofia asked to "ask for stronger passwords": the recovery checklist
only asked for "tener una letra, tener un numero y minimo 8 caracteres", and "tener una letra"
sounds odd, so it should say "Combinación de caracteres alfanuméricos". A special character must
be required, and "do not let change the password for the same current password, it doesn't have
any sense".

## What was done

* `services/keycloak/realms/fynk-realm.json`: the policy adds `specialChars(1)` and
  `passwordHistory(1)` (Keycloak compares the new password with the stored one, so both the
  recovery and the in-app "Cambiar contraseña" refuse the current password). New
  `localizationTexts.es` replaces Keycloak's own Spanish errors ("las últimas 1 contraseñas",
  "1 caracteres especiales") with plain ones, for example "La nueva contraseña debe ser diferente
  a la actual."
* Login theme: the checklist of the new password page is now "Mínimo 8 caracteres",
  "Combinación de caracteres alfanuméricos" (a letter and a digit) and "Un carácter especial
  (! # $ - _ …)". A special character is anything that is not a letter or a digit, as Keycloak
  counts it. The registration hint now names the special character.
* Tests: `realm_test.go` checks the new policy string and the four Spanish messages. The
  integration tests (real Keycloak in Docker) use `abcdefg1!` as the good password, reject
  `abcdefg1` (no special character), and check that the recovery and the in-app change both refuse
  the current password with the new message.
* Docs: `services/keycloak/README.md`, `docs/modules/M01-identity.md` and the Registro and
  Recuperar rows of the screen inventory in `docs/design/README.md`.

## Result

* Go unit tests of `internal/identity/keycloak` pass. Theme `pnpm typecheck` and Prettier pass.
* Integration tests against Keycloak 26.8.1 in Docker (policy, registration, recovery, in-app change, login): pass.
* Pull request: not opened yet.

## Decisions and problems

* "Una letra" and "Un número" became one row, "Combinación de caracteres alfanuméricos", since
  alphanumeric already means letters and numbers. Three rows remain.
* The "not the current password" rule is only checked by Keycloak: the page never knows the
  current password, so it shows as the field error after submit, not in the checklist.
* The new copy is not in the design: listed as "needs design review".
* A local Keycloak that already imported the realm keeps the old policy (`--import-realm` skips an
  existing realm). Recreate its volume to see the change.

## Next step

Daniel Palacios (M1) reviews the pull request.
