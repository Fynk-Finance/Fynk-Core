---
date: 2026-11-11
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-67]
branch: docs/dev-token-device-required
tool: Claude Code
pr: "#363"
status: done
---

# Note why the dev-token session cannot link a bank

## Instruction

Daniel shared two notes Juan Carlos's M4 and M5 review left on 7 Nov (one for Daniel, one for Sofia) and asked to confirm each point against `develop`. Then: "agrega la nota para que en sesiones y pruebas futuras no se confunda y sepa la solucion por la documentacion".

## What was done

* Checked the 10 points of the two notes against `develop`. 9 were already fixed: #312, #317 and #319 to #322 merged on 7 Nov; the API in `docker-compose.yml` gets the bank settings; `scripts/dev/certs.sh` creates `bank-signer.pem` and `bank-fingerprint.key`; `scripts/dev/postgres-init.sh` is `100755`; `Button` has `iconAfter` and the `externalLink` icon (#362); the Dashboard pulls to sync with `syncNow`; Detalle de cuenta disconnects with `disconnectLink`; movements keep their account name after a revoke (`33ca423`).
* The one still open: with `EXPO_PUBLIC_DEV_AUTH=dev-token` the app registers no device, so `POST /bank/authorizations`, completing the link and creating the consent answer `device_required` (422). Conectar banco shows "Este teléfono no está registrado en tu cuenta. Inicia sesión de nuevo."
* `apps/mobile/.env.example`: the comment of `EXPO_PUBLIC_DEV_AUTH` says that linking a bank fails in that mode and points to the fix.
* `docs/local-dev.md`, section 8: a troubleshooting row with the message, the cause and the fix (leave `EXPO_PUBLIC_DEV_AUTH` empty, restart Metro with `--clear`, sign in with a real account).
* `apps/mobile/src/modules/identity/index.ts`: the comment where the dev session skips the device names the consequence and links to the doc.

## Result

* Prettier (from the repository root, as `make format-check`) and ESLint pass on the changed files. Only comments and docs changed, so no tests were added.
* Pull request: #363.

## Decisions and problems

* Documented the limit instead of registering a test device in dev mode. The review marked it optional, and a fake device would change the M1 sign in flow for a dev-only case.
* The note names only the calls that need a device (bank link and consent creation), checked with `grep` for `ErrDeviceRequired` in `services/api/internal`.
* `apps/mobile/.env.example` and `docs/local-dev.md` are M0 files, so Sofia reviews them.
* Daniel's local, uncommitted change to `apps/mobile/.env.example` (real API URL and `EXPO_PUBLIC_BANCO_DEMO_PORTAL_URL`) was stashed and left out of this branch.

## Next step

Sofia reviews the pull request.
