---
date: 2026-10-27
developer: Juan Pablo Contreras
github: juancontrerasp
module: M14
jira: [SCRUM-47]
branch: infra/monitoring-and-alerts
tool: Claude Code
pr: none
status: done
---

# M14 Step 5: CloudWatch alarms, dashboard, metric filters, and incident runbook

## Instruction

Juan Pablo Contreras requested to execute all steps of Module M14 (AWS Staging Infrastructure): "Please do the module m14 all the steps please."

## What was done

* Created branch `infra/monitoring-and-alerts` based on `infra/caddy-egress`.
* `infra/terraform/modules/monitoring/`:
  * Created SNS Topic `fynk-staging-alerts` for notifications with email subscription.
  * Configured CloudWatch Alarms per HU-033:
    1. ALB 5xx error rate > 5 in 5 minutes.
    2. Unhealthy target group hosts for 2 consecutive minutes.
    3. RDS CPU utilization > 80% for 10 minutes.
    4. RDS Free storage space < 2 GB.
    5. Caddy instance StatusCheckFailed >= 1.
    6. Custom metric `bank.sync_failed` > 10 in 15 minutes.
    7. Bedrock API invocation errors > 5 in 15 minutes.
  * Implemented PII leak detection metric filter (`fynk-staging-pii-leak-detector`) inspecting log events for unmasked bearer tokens, card numbers, or credentials.
  * Constructed CloudWatch Dashboard `Fynk-staging` tracking host availability, HTTP 2xx/5xx status rates, p95 response times across services, and bank sync outcomes.
* `docs/runbooks/incident.md`:
  * Incident classification (P1/P2/P3), diagnostic commands via AWS CLI/SSM, log inspection procedures, and Jira incident documentation workflow.

## Result

* `terraform fmt -check` passed.
* `terraform validate` passed with configuration valid.

## Decisions and problems

* Metric filter regexes were configured to actively flag accidental PII emissions in compliance with Colombian privacy laws (Ley 1581 / Circular Externa 004).

## Next step

Step 6: `infra/deploy-pipeline` (GitHub Actions OIDC role, deploy and terraform plan workflows, smoke script).
