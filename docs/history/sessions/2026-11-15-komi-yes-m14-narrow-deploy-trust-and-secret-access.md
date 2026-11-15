---
date: 2026-11-15
developer: Daniel Palacios
github: Komi-yes
module: M14
jira: [SCRUM-48]
branch: fix/infra-narrow-deploy-trust-and-secret-access
tool: Claude Code
pr: "#390"
status: done
---

# The deploy role trusts only the deploy refs, and a service reads only its own secrets

## Instruction

After the code analysis of the whole repository, Daniel asked to "fix the bugs with the simple fixes" in the other modules too, and to "push that fixes with their PRs" so each owner reviews them. This is BUG-14 of that analysis, in Juan Pablo's module.

## What was done

* `infra/terraform/modules/github-oidc`: new variable `deploy_refs` (`refs/heads/develop`, `refs/tags/v*`). The trust policy lists `repo:<repo>:ref:<ref>` for each, no longer `repo:<repo>:*`.
* `infra/terraform/modules/ecs-service`: new variable `secrets_kms_key_arn`. The execution secrets policy allows `GetSecretValue` on the ARNs of `var.secrets` and `kms:Decrypt` on that key, and exists only when the service has secrets.
* `infra/terraform/envs/staging/main.tf`: the API and Keycloak services pass `module.kms.data_key_arn`.
* Tests with `terraform test` and a mock provider: `modules/github-oidc/tests/trust.tftest.hcl` and `modules/ecs-service/tests/execution_secrets.tftest.hcl`. The tests of the changed policies were run on the old code and failed.

## Result

* Tests: both Terraform test files pass (3 runs). `terraform fmt -check -recursive` and `terraform validate` pass for `bootstrap` and `envs/staging`. `make lint` clean, `make test` passes (247 Jest suites, 2,878 tests, Go and script tests).
* Pull request: #390.
* Not run: `terraform plan` or `apply`. There are no AWS credentials on this PC, and Claude Code never applies.

## Decisions and problems

* The deploy refs follow the triggers of `.github/workflows/deploy-staging.yml`, the only workflow that assumes the role.
* The module tests ran with AWS provider 6.73, because the modules pin no provider version. Staging validates with its pinned `~> 5.80`.
* `terraform init` added Windows hashes to the two committed lock files. I reverted them, they are not part of this branch.
* CI does not run `terraform test`. Adding it is a change to `terraform-plan.yml`, left to Juan Pablo.
* The change is in another person's module. Juan Pablo reviews it as CODEOWNER.

## Next step

Juan Pablo runs `terraform plan` on staging and reviews the pull request.
