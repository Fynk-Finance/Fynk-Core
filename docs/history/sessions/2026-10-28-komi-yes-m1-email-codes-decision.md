---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-5, SCRUM-9, SCRUM-67]
branch: docs/email-codes-decision
tool: Claude Code
pr: none
status: done
---

# Write down the email code and offline session decisions in the docs

## Instruction

With Sofia's PRs merged, the developer asked to "finish M1 by finishing the pending task that we left until sofia's PRs were merged". Then they asked to check the previous plan for anything else on hold: "you checked the previous plan to see if anything else that is mentioned there that was in a hold state is missing?". This branch is the docs part of that plan. Claude Code (Opus) wrote it without a subagent.

## What was done

* **`CLAUDE.md`:**
  * Open items 2 (email codes) and 5 (offline sessions) move to "Decisions taken", and the other open items are renumbered.
  * "Where data lives" now says the profile name is in Keycloak. `PATCH /me` writes it there, and only the devices are in the `identity` schema.
* **`docs/design/README.md`:**
  * Crear cuenta leads to the code page.
  * Recuperar uses a code, in four steps.
  * OnbCorreo is the Keycloak code page, not an onboarding step any more.
  * Nombre is now onboarding step 1.
* **`docs/modules/M01-identity.md`:**
  * The recovery copy and the code pages are described.
  * `EmailVerificationStep` and `POST /me/verification-email` are removed, with the reason.
  * Seguridad uses `kc_action=UPDATE_PASSWORD`, and the device place is not shown.
  * The devices table gets `session_id` and the unique key.
  * `passwordUpdatedAt` and `POST /devices/sign-out-others` are added.
  * The `fynk-admin` roles are the real ones.
  * No offline sessions.
  * The exports and tests are updated, and "Ask before" is resolved.
* **`docs/modules/00-shared-contracts.md` §5:** the identity endpoints are the real ones.
* **New `docs/adr/0007-email-codes.md`:** the decision, the security rules, the dropped endpoint, and the reset page's response time as a known limitation. 0002, 0003, 0004 and 0006 are reserved by other module docs.
* **`services/keycloak/README.md` and a comment in `realm_test.go`:** they said "open item 5", which no longer exists after the renumbering.

## Result

* Docs only, plus one Go comment.
* M3's files are Sofia's. The PR carries a note for her to drop the email step from `M03-onboarding.md`.

## Decisions and problems

* **The open items are renumbered instead of left as gaps.** The only two places that pointed at "open item 5" now point at the decision by name.
* **Inicio is not exported from `index.ts`.** The module's own flow shows it, so M01's export list drops it instead of adding an unused export.

## Next step

Sofia reviews the shared docs, and Sofia updates `M03-onboarding.md`.
