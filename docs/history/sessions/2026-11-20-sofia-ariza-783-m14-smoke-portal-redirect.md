---
date: 2026-11-20
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M14
jira: [SCRUM-46]
branch: fix/smoke-portal-redirect
tool: Claude Code
pr: "#439"
status: done
---

# Fix the staging smoke test that expected the Banco Demo portal to answer 200

## Instruction

Sofia asked why the release pull request from `develop` to `main` (#419) does not pass all its checks and what the
solution is, then: "create the new branch, fix the problem and open the new pr to solve this test problem".

## What was done

* Found that the only red check on #419 is "Build ARM64 & Deploy to ECS" from the Deploy Staging workflow. The deploy
  works; the last step, `scripts/smoke.sh habenly.site`, failed with
  `bank-simulator web portal ... FAILED (Expected 200, got 302)` on the last three runs on `develop`.
* Confirmed the 302 is the intended behavior: since the portal logs in through the `banco-demo` realm, an anonymous
  `GET /portal` is redirected to `auth.habenly.site/realms/banco-demo/protocol/openid-connect/auth`. The bank
  simulator's own tests require it (`portal_login_test.go`).
* `scripts/smoke.sh`: new `check_redirect` helper that passes only on a 302 whose `Location` starts with the
  banco-demo authorization endpoint. It prints only the status code, never the `Location`, because that URL carries
  state, nonce and PKCE values.
* `scripts/smoke.sh`: a connection failure printed `000000` because curl already writes `000` and `|| echo "000"`
  added a second one. Changed to `|| true`. Gave the HTTP to HTTPS check the same timeouts as the others.

## Result

* `./scripts/smoke.sh habenly.site` against live staging: all checks OK, "All smoke tests PASSED successfully!".
* Negative checks: the helper reports FAILED for a 200 (`/healthz`) and for a 302 to the wrong realm (`fynk`); an
  unreachable host now shows `got 000`.
* `make test-scripts`: 28 pass, 0 fail.
* Pull request: #439.

## Decisions and problems

* Kept the portal in the smoke test as a redirect check instead of removing it, so it still proves that the portal is
  reachable and wired to the right Keycloak realm.
* PR #419 is also blocked because it is a draft without the one approval `main` requires. The smoke test is not a
  required check, but it was fixed so `main` does not receive a red deploy.
* One local run of step 3 (HTTP to HTTPS) failed with a connection error; eight repeats and both resolved IPs then
  answered 301, so it was a one-off network problem on the local machine, not a staging fault.

## Next step

Juan Pablo Contreras (M14) reviews the pull request. After it merges into `develop`, check that the next Deploy Staging
run is green and that the check on #419 turns green.
