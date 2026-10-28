---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-5, SCRUM-9]
branch: feature/keycloak-theme-in-image
tool: Claude Code
pr: none
status: partial
---

# Build the fynk theme into the Keycloak image and turn it on for login

## Instruction

The last theme step of the approved M1 plan, T3: "Realm `loginTheme: fynk` … A Dockerfile stage … the whole integration suite passes on the themed image". Claude Code (Opus) planned and reviewed. A Sonnet subagent wrote the code, and Claude Code ran every check again itself.

## What was done

* **`services/keycloak/Dockerfile`:** a `theme` stage. It is the Maven image `maven:3.9.11-eclipse-temurin-21` with Node copied in from `node:22.21.1-bookworm-slim`; pnpm comes from `packageManager` through corepack.
  * It runs `pnpm install --frozen-lockfile --ignore-workspace` and `pnpm build-keycloak-theme`, then copies `fynk-keycloak-theme.jar` into `providers/` before `kc.sh build`.
  * Like the extension stage, it runs on the build machine (`BUILDPLATFORM`), so the arm64 deploy build doesn't run Node or Maven under QEMU.
* **`.dockerignore`:** lets in only the theme's sources and config, never `node_modules`, build output or generated files.
* **`fynk-realm.json`:** `"loginTheme": "fynk"`. `banco-demo` keeps Keycloak's pages, and `emailTheme` stays unset until the email theme exists. The new `realm_test.go` `TestLoginUsesTheFynkTheme` checks all three.
* **Integration tests (`realm_integration_test.go`):** the theme draws the pages in the browser, so Keycloak's HTML now holds the data model (`kcContext`) instead of the form.
  * The tests read the form URL (`url.loginAction`, `url.registrationAction`), the `pageId` and the messages from the data model.
  * The recovery enumeration test compares the data model key by key:
    * two requests for the same account are identical once the session values are taken out, which proves the normalization hides nothing else;
    * a real account and an unknown email give the same first page, the same waiting page and the same wrong-code page;
    * `auth` and `user` are not on the code page.
* **"Ir a iniciar sesión" after a reset (`theme/src/login/appReturnUrl.ts`, `Info.tsx`):** Keycloak closes the login session and gives no link, and it rejects a custom-scheme base URL on `fynk-mobile`. So the page reads the app's `redirect_uri` and `state` from the `client_data` of the session URLs and links to `co.fynk.app://oauth/callback?error=access_denied&state=...`, the answer Keycloak gives when a person cancels. Only the app's own scheme is accepted. An integration test checks that `client_data` is still on that page.
* **`Info.tsx`:** the real image sends the header key `accountUpdatedTitle` on the success page, so the success page check accepts it.
* **`README.md`:** how the image builds the theme, what the tests read, and the way back to the app.

## Result

* `make test-keycloak` passes on the themed image (64 s). `make lint-go`, the realm unit tests, `pnpm typecheck` and `pnpm format-check` pass.
* The subagent also checked an arm64 `buildx` build (2 min 34 s) and a cold build (2 min 6 s).
* **Pull request: stacked.** The developer asked to stack the PRs so they're easier to merge. The theme stack (#62 to #66) now sits on the email-code stack (#49, #50, #54), and this PR sits on #66: one line, one merge order.
* **Checked with the backend line too.** With the devices and profile line (#40 to #61) merged in as well, `admin_integration_test.go` (#58) no longer compiles: it uses the old form helpers. Moving it to `formAction` with page ids (`login.ftl`, `terms.ftl`) makes the whole suite pass (107 s). Whichever of this PR and #58 merges second gets that change.

## Decisions and problems

* **`@types/node` moved to the library PR (#62).** A clean image build failed because the theme's build script needs Node types, which locally only resolved from a parent folder. A library belongs in its `chore/add-*` pull request, so the theme stack was rebased onto it.
* **No base URL on `fynk-mobile`.** Keycloak rejects `co.fynk.app://...` as "not a valid URL" in the admin API and in the realm import, so the way back is taken from the login session instead.
* **The app must take `access_denied` as "back to Inicio".** Today the AppAuth adapter would sort it as a failure. It is fixed in its own small pull request, `fix/reset-return-is-not-an-error`.
* **Size.** About 500 changed lines, 450 of them the integration tests. They can't be split off: the tests and `loginTheme: fynk` have to change together, or the suite fails.

## Next step

* Review: Juan Pablo for the Dockerfile, because the banco-demo realm shares the image. After each merge below it, rebase onto `develop` and rerun `make test-keycloak`.
* The email theme, later.
