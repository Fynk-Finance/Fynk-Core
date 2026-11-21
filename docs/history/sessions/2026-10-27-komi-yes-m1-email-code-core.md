---
date: 2026-10-27
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-67, SCRUM-5]
branch: feature/keycloak-email-code-core
tool: Claude Code
pr: none
status: done
---

# The core of the 6-digit email codes, built into the Keycloak image

## Instruction

The team decided that sign-up and password recovery use a 6-digit code sent by email, as in the design, instead of Keycloak's links. The developer asked for a secure Keycloak extension in this repository: "the extension of keycloack to follow the app flow planed in the design is a group decision that you do the respective extension it has to be still secure". Claude Code plans and reviews, and a Sonnet subagent writes each task. Limits chosen by the developer: "10 fallos en 12 h".

## What was done

* `services/keycloak/extensions/email-code/`: a Maven project (Java 21, Keycloak 26.8.1 APIs as `provided`, JUnit 5).
* `EmailCode`:
  * issues a random 6-digit code;
  * stores only `v1.<salt>.<sha256(salt+code)>.<expires>.<attempts>`;
  * checks it in constant time, with 5 attempts, a 10-minute life and single use.
  * Input that isn't 6 digits isn't counted. A tampered note is refused. `toString` never shows the code or the hash.
* `UserLimits`, over `LimitStore`:
  * a 60 s resend cooldown and 10 wrong codes per 12 h, for each person and purpose;
  * the window starts at the first failure and does not slide.
* `SingleUseLimitStore` keeps those counters in Keycloak's single-use cache, so they hold across browsers.
* `Dockerfile`: a first stage builds the jar and runs its tests, then the jar goes into `providers/` before `kc.sh build`. The stage runs on the build machine's platform (the deploy builds arm64 with QEMU). It also works with Docker's classic builder, which testcontainers may use.

## Result

* `mvn verify`: 19 tests pass. `docker build` works with BuildKit and with the classic builder. Claude Code ran both again itself.

## Decisions

* The code lives only in the browser's authentication session, never on the user, so it is bound to the browser that asked for it.
* Key names are lowercased with `Locale.ROOT` (changed in review), so a server locale like Turkish cannot change them.

## Problems

* `ARG BUILDPLATFORM` with no default breaks the classic builder, and a default of `linux/amd64` overrides the real platform under BuildKit. `${BUILDPLATFORM:-linux/amd64}` works with both.

## Next step

* `feature/keycloak-email-verification-code`: the required action, pages, emails and realm changes on top of this core.
