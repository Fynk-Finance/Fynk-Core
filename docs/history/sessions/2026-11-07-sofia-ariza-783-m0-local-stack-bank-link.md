---
date: 2026-11-07
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-68]
branch: fix/local-stack-bank-link
tool: Claude Code
pr: "#327"
status: partial
---

# Let make dev link Banco Demo locally without manual steps

## Instruction

Sofia pasted the follow-ups from the end-to-end test of M4 and M5 on the local stack: "To ensure everything works without requiring manual intervention, the following tasks need to be addressed in your modules." For M0: `make dev` fails on macOS because `scripts/dev/postgres-init.sh` is not executable, and the `api` service gets no bank settings, so it starts with "bank link disabled". `make certs` must also create the two bank keys.

## What was done

* `scripts/dev/postgres-init.sh` is now mode 100755 in Git (`git update-index --chmod=+x`).
* `docker-compose.yml`: the `api` service (not `migrate`) gets `BANK_SIGNER_KEY_FILE`, `BANK_FINGERPRINT_KEY_FILE`, `BANK_REDIRECT_URI`, `BANCO_DEMO_CLIENT_ID`, `BANCO_DEMO_ISSUER` and `BANCO_DEMO_AUTHORIZE_URL`, and mounts the two keys read-only.
* `scripts/dev/certs.sh` creates `bank-signer.pem` (RSA 3072, `step crypto keypair`) and `bank-fingerprint.key` (32 random bytes). It keeps existing files unless `FORCE=1`, and makes them readable for the distroless API user.
* `Makefile` `dev` runs `make certs` when the CA or either bank key is missing, so machines that already have `certs/` get the new keys.
* `services/api/.env.example` and `docs/local-dev.md`: the Banco Demo URLs are `http://localhost:8082` locally, and the docs say where the keys come from. The troubleshooting table has a row for "bank link disabled".

## Result

* `sh -n scripts/dev/certs.sh` passes. `docker compose config` shows the six settings and the two mounts on `api`. Prettier passes on the YAML and the docs.
* Not run yet: `make certs` and `make dev` end to end, because Docker Desktop was not running in this session.
* Pull request: #327.

## Decisions and problems

* The keys are made with `step` and `head` instead of the `openssl` commands in `.env.example`. `make certs` runs in the pinned `smallstep/step-cli` image, and `step` is always in it; with Docker off, we could not check whether the image has `openssl`. The API accepts PKCS #1 or PKCS #8 RSA keys and a raw key file of 32 bytes or more.
* `http://` is right for Banco Demo locally: its public listener is plain HTTP on a developer machine, and the API allows non-https authorize URLs only when `APP_ENV=local`.
* The settings go on the `api` service only, so the one-off `migrate` container does not mount keys it never uses.
* PR #318 (Daniel) also edits `docker-compose.yml`, in other lines. Rebase if it merges first.
* The local test edit in `services/api/internal/audit/validation.go` blocked the update of `develop`. On Sofia's choice it was stashed (`git stash list`), not committed.

## Next step

With Docker running, run `make certs`, then `make dev`. Check that `docker compose logs api` has no "bank link disabled" and that the onboarding Cuentas step lists Banco Demo.
