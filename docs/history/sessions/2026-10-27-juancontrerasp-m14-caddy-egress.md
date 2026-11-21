---
date: 2026-10-27
developer: Juan Pablo Contreras
github: juancontrerasp
module: M14
jira: [SCRUM-46, SCRUM-48]
branch: infra/caddy-egress
tool: Claude Code
pr: none
status: done
---

# M14 Step 4: Caddy mTLS egress proxy, Elastic IP, and certificate rotation runbook

## Instruction

Juan Pablo Contreras requested to execute all steps of Module M14 (AWS Staging Infrastructure): "Please do the module m14 all the steps please."

## What was done

* Created branch `infra/caddy-egress` based on `infra/ecs-services-and-alb`.
* `services/caddy/Caddyfile`:
  * Production/staging Caddy configuration with reverse proxy routes for:
    * `/banco-demo/*`: forwards to `https://bank-simulator.internal:9443` with mTLS client certificates.
    * `/bancolombia/*`: forwards to `https://api.sandbox.bancolombia.com` with mTLS client certificates.
    * `/alpaca/*`: proxies market data API with upstream host preservation.
  * Filtered JSON access logging deleting query strings, authorization headers, and cookies per HU-032 / HU-034.
* `infra/terraform/modules/caddy-egress/`:
  * EC2 instance on Graviton ARM64 (`t4g.nano`) in public subnet.
  * Static Elastic IP attached for partner bank egress allowlisting.
  * Security group restricting port 8443 access exclusively to `fynk-api` tasks.
  * IAM role with SSM Agent managed policy (`AmazonSSMManagedInstanceCore` - zero SSH keys opened) and Secrets Manager read permissions for client certificate and key.
  * User data automating Docker installation, retrieval of client cert/key from Secrets Manager, and container lifecycle.
* `docs/runbooks/rotate-mtls-cert.md`:
  * Complete operational runbook detailing 90-day mTLS certificate rotation via Secrets Manager and AWS SSM command execution without SSH.

## Result

* `terraform fmt -check` passed.
* `terraform validate` passed with configuration valid.

## Decisions and problems

* Replaced SSH access with AWS SSM Managed Instance Core, fulfilling the security requirement that instances have no open SSH ports or baked keys.
* Retained Elastic IP on Caddy egress to satisfy bank requirements for static outbound IP allowlists.

## Next step

Step 5: `infra/monitoring-and-alerts` (CloudWatch alarms, dashboard, metric filters, incident runbook).
