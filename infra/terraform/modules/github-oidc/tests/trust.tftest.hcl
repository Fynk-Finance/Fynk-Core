# Run with: terraform init -backend=false && terraform test (no AWS account needed).
mock_provider "aws" {}

run "only_the_deploy_refs_may_assume_the_role" {
  command = apply

  variables {
    github_repository = "Fynk-Finance/Fynk-Core"
    environment       = "staging"
  }

  assert {
    condition = toset(flatten([jsondecode(aws_iam_role.github_deploy.assume_role_policy).Statement[0].Condition.StringLike["token.actions.githubusercontent.com:sub"]])) == toset([
      "repo:Fynk-Finance/Fynk-Core:ref:refs/heads/develop",
      "repo:Fynk-Finance/Fynk-Core:ref:refs/tags/v*",
    ])
    error_message = "The deploy role must trust only develop and the release tags, never repo:<repo>:*"
  }
}
