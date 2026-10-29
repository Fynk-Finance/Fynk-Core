---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-9]
branch: fix/reset-return-is-not-an-error
tool: Claude Code
pr: none
status: done
---

# Take Keycloak's access_denied as a cancel, not a failure

## Instruction

It came out of the theme-in-image work of the approved M1 plan. After a password reset, the Keycloak theme sends the app back with `error=access_denied`, and the app has to take that as "back to Inicio". Claude Code (Opus) planned and reviewed. A Sonnet subagent wrote the fix, and Claude Code ran the checks again itself.

## What was done

* **`adapters/oidc/appAuthOidc.ts`:** `access_denied`, as a whole word, joins the patterns that mean `cancelled`.
* **`appAuthOidc.test.ts`:**
  * `classifyAppAuthError` table rows: `access_denied` is a cancel; `not_access_denied_at_all` and `unauthorized_client` stay `rejected`;
  * a new `authorize` test: an `access_denied` rejection ends as `cancelled`.

## Result

* `make lint-mobile` passes, and the identity tests pass (6 suites, 56 tests). Prettier is clean.
* Pull request: see the branch.

## Decisions and problems

* **Where `access_denied` comes from.** In react-native-app-auth 9.0.0 it reaches JavaScript as the error `code`:
  * iOS: `RNAppAuth.m`, `getErrorCode`, maps `OIDErrorCodeOAuthAuthorizationAccessDenied` to `access_denied`;
  * Android: `RNAppAuthModule.java` uses `ex.error`, the redirect's `error` parameter.
  * The message isn't relied on. The AppAuth sources themselves aren't in `node_modules`, so the Android value is inferred from AppAuth's documented behavior.
* **The app has no device check here.** It still has to be checked on a phone: reset the password, tap "Ir a iniciar sesión", and Inicio shows no error.

## Next step

* The theme-in-image PR, which sends `access_denied`, is opened once the email-code and theme stacks are in `develop`.
