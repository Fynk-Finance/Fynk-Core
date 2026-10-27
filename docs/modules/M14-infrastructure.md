# M14 Infrastructure and platform (AWS)

| Item | Value |
| --- | --- |
| Phase | 0 (base), then continuous |
| Stories | HU-032 SCRUM-46 (3), HU-033 SCRUM-47 (5), HU-034 SCRUM-48 (2) |
| Points | 10 |
| Owner | Juan Pablo Contreras (`@juancontrerasp`) |
| Owns | `infra/terraform/`, `services/caddy/`, `.github/workflows/deploy-*.yml`, `docs/runbooks/` |
| Depends on | M0 (Dockerfiles and CI) |
| Used by | every backend service, M5 (egress, KMS, certificates), M11 (Bedrock) |

How to use: open Claude Code at the repository root on a fresh branch from `develop` and paste everything below the line. Never run `terraform apply` from Claude Code. Claude writes the code and runs `terraform fmt`, `validate` and `plan` only. A person applies.

---

You are building module M14 of Fynk: the AWS infrastructure as code, the Caddy egress, secrets, encryption in transit, monitoring and the deploy pipeline. Only one environment, `staging`, which is also the jury demo.

## Read first

1. `CLAUDE.md` (Security rules), `docs/modules/00-shared-contracts.md`.
2. `docs/modules/M05-bank.md` (egress and KMS needs) and `docs/modules/M16-banco-demo.md` (mTLS listener).
3. Jira SCRUM-46, SCRUM-47, SCRUM-48.

## Stories and criteria

* **HU-032 Cifrado en tránsito (SCRUM-46)** Todo tráfico con TLS. Sin protocolos inseguros. Buenas prácticas criptográficas. Integridad verificada.
* **HU-033 Monitoreo (SCRUM-47)** Métricas clave. Alertas automáticas. Disponibilidad visible. Trazabilidad de incidentes.
* **HU-034 Gestión de secretos (SCRUM-48)** Sin secretos en el código. Control de acceso. Rotación de credenciales. Uso de secretos registrado.

## Architecture (confirmed, do not change without a team decision)

```
Internet
  -> Route 53: api.<domain>, auth.<domain>, bancodemo.<domain>
  -> ALB (public subnets in 2 AZs), TLS 1.2+ policy ELBSecurityPolicy-TLS13-1-2-2021-06, ACM wildcard cert
       host api.*        -> ECS service fynk-api           (HTTPS 8443, self signed cert inside the task)
       host auth.*       -> ECS service keycloak           (HTTPS 8443)
       host bancodemo.*  -> ECS service bank-simulator     (public portal and authorize redirect, HTTPS 8443)
Private subnets (1 AZ for tasks and data, to save cost)
  ECS Fargate ARM64: fynk-api, keycloak, bank-simulator
  RDS PostgreSQL 16 (TLS required, verify-full with the RDS CA), databases fynk and keycloak
  ElastiCache Redis 7 (in transit encryption and AUTH token)
  bank-simulator internal mTLS listener 9443 (only reachable from the Caddy egress security group)
Public subnet
  Caddy egress on EC2 t4g.nano with an Elastic IP (stable outbound IP that banks can allow list)
    fynk-api -> https://caddy.internal/<provider>/...  -> Caddy adds the Fynk client certificate -> bank
    providers: banco-demo (bank-simulator:9443 inside the VPC), bancolombia (sandbox URL), alpaca (market data)
VPC endpoints (because there is no NAT Gateway): S3 gateway (free), and interface endpoints for
  ecr.api, ecr.dkr, logs, secretsmanager, kms, bedrock-runtime, email-smtp
KMS: one symmetric key for data at rest, one asymmetric RSA_3072 key for private_key_jwt (PS256), one HMAC_256 key for token fingerprints
Secrets Manager: RDS master (managed rotation), Redis auth token, Keycloak admin, fynk-admin client secret, mTLS client cert and key, Alpaca keys
Bedrock: model access for the configured model in the same region
```

### Cost estimate (us-east-1, on demand, October 2026 prices)

| Item | Size | USD per month |
| --- | --- | --- |
| ALB | 1, low traffic | about 22 |
| Fargate ARM64 fynk-api | 0.5 vCPU, 1 GB | about 14 |
| Fargate ARM64 keycloak | 1 vCPU, 2 GB | about 29 |
| Fargate ARM64 bank-simulator | 0.25 vCPU, 0.5 GB | about 7 |
| RDS PostgreSQL | db.t4g.micro, 20 GB gp3, single AZ | about 14 |
| ElastiCache Redis | cache.t4g.micro | about 12 |
| Caddy egress EC2 plus Elastic IP | t4g.nano | about 7 |
| VPC interface endpoints | 7 endpoints in 1 AZ at 0.01 per hour | about 51 |
| KMS, Secrets Manager, CloudWatch, Route 53 | small | about 12 |
| Bedrock | depends on use, see M11 | about 15 for 1.000 users |
| **Total** | | **about 183** |

Important finding for the team: without a NAT Gateway, private tasks need the interface endpoints above to reach ECR, logs, secrets, KMS, Bedrock and SES. Those cost about 51 per month, more than a single NAT Gateway (about 33 per month plus 0.045 per GB). Write this in `docs/adr/0005-egress.md` and ask the team whether to keep the confirmed design. Do not change it on your own.

## Terraform layout

```
infra/terraform/
  modules/network        VPC, 2 public and 2 private subnets, route tables, S3 gateway endpoint
  modules/endpoints      interface endpoints with one security group
  modules/alb            ALB, listeners, host rules, ACM, Route 53 records
  modules/ecs-service    reusable: task definition, service, autoscaling off, log group, IAM roles
  modules/rds            PostgreSQL, parameter group with rds.force_ssl=1, managed master secret
  modules/redis          ElastiCache with TLS and auth
  modules/caddy-egress   EC2 with SSM agent (no SSH), Elastic IP, user data that pulls the Caddy image and the client cert from Secrets Manager
  modules/kms            the three keys with key policies limited to the task roles
  modules/monitoring     alarms, dashboard, SNS email topic
  envs/staging           composition, terraform.tfvars without secrets, backend s3 with use_lockfile = true
```

* Terraform 1.10 or later (S3 native state locking, no DynamoDB). Pin provider versions.
* Every resource tagged `project=fynk`, `env=staging`, `module=<owner module>`.
* IAM least privilege per task role: fynk-api may sign with the PS256 key, generate MACs, read its secrets, invoke only the configured Bedrock model, send nothing else. Keycloak may read its own secrets and send through SES.

## Caddy egress (`services/caddy/`)

* `Caddyfile` with one route per provider, for example:

```
:8443 {
  tls /etc/caddy/internal.crt /etc/caddy/internal.key
  handle_path /banco-demo/* {
    reverse_proxy https://bank-simulator.internal:9443 {
      transport http {
        tls_client_auth /run/secrets/fynk-client.crt /run/secrets/fynk-client.key
        tls_trusted_ca_certs /etc/caddy/banco-demo-ca.crt
      }
    }
  }
  handle_path /bancolombia/* {
    reverse_proxy https://<sandbox host> {
      header_up Host {upstream_hostport}
      transport http {
        tls_client_auth /run/secrets/fynk-client.crt /run/secrets/fynk-client.key
      }
    }
  }
  handle_path /alpaca/* {
    reverse_proxy https://data.alpaca.markets {
      header_up Host {upstream_hostport}
    }
  }
  respond 404
}
```

* Check every directive against the pinned Caddy version (newer versions replace `tls_trusted_ca_certs` with `tls_trust_pool file`).
* Only the fynk-api security group can reach port 8443. Access logs in JSON without query strings or headers.
* Certificate rotation runbook `docs/runbooks/rotate-mtls-cert.md`: new cert in Secrets Manager, restart Caddy through SSM, check the handshake, revoke the old one. Rotate every 90 days.

## Encryption in transit (HU-032)

* ALB TLS 1.2 and 1.3 only. HTTP listener only redirects to HTTPS. HSTS header from the API.
* ALB to tasks over HTTPS (self signed certs generated at container start are enough, the ALB does not validate them).
* RDS with `sslmode=verify-full`, Redis with TLS, Caddy to banks with mTLS.
* A CI check (`make tls-check`) that runs `testssl.sh` or `sslyze` against staging and fails on TLS 1.0, 1.1 or weak ciphers.

## Monitoring (HU-033)

* Health checks `/healthz` (liveness) and `/readyz` (DB, Redis, Keycloak JWKS reachable) on the target groups.
* CloudWatch alarms to the SNS topic `fynk-alerts` (team emails): ALB 5xx over 5 in 5 minutes, unhealthy targets for 2 minutes, ECS service with fewer running tasks than desired, RDS CPU over 80 % for 10 minutes or free storage under 2 GB, Caddy instance status check failed, custom metric `bank.sync_failed` over 10 in 15 minutes, Bedrock errors over 5 in 15 minutes.
* One CloudWatch dashboard "Fynk staging" with availability (healthy hosts, 5xx rate), latency p95 per service, sync results, Bedrock tokens.
* Log groups with 30 day retention. Logs are already redacted by the API (M0), plus a metric filter that alarms if a log line matches a token, email or card number pattern.
* Incident runbook `docs/runbooks/incident.md`: who gets the alarm, first checks, how to record the incident in Jira.

## Secrets (HU-034)

* Nothing secret in Terraform variables or the repo. Terraform creates empty secrets, a person sets the values once with the AWS CLI. The mTLS client key is generated outside the repo.
* Tasks read secrets through ECS `secrets` (injected at start), never baked into images.
* CloudTrail data events for Secrets Manager `GetSecretValue` and KMS `Sign` and `GenerateMac`, kept 90 days, so each use of a secret is logged.
* Rotation: RDS managed rotation every 30 days, Redis auth token and Keycloak admin every 90 days (runbook), mTLS cert every 90 days.

## Deploy pipeline

* `.github/workflows/deploy-staging.yml` on push to `develop` and on tags `v*`: GitHub OIDC role (no access keys), build ARM64 images, push to ECR with the commit SHA tag, update ECS services, wait for stability, run `scripts/smoke.sh` (healthz, Keycloak well known, Banco Demo mTLS through Caddy).
* `.github/workflows/terraform-plan.yml` on pull requests that touch `infra/`: `fmt -check`, `validate`, `plan` posted as a PR comment. Apply is manual by a person.
* Mobile builds are outside this module. Note for the team: iOS builds on real phones need an Apple Developer account (USD 99 per year). Android APKs do not.

## Work plan (one branch each, from `develop`)

1. `infra/terraform-state-and-network`: state bucket bootstrap, network, endpoints.
2. `infra/data-stores`: RDS, Redis, KMS keys, secrets shells.
3. `infra/ecs-services-and-alb`: ECR repos, ECS cluster, 3 services, ALB with host rules, DNS, ACM.
4. `infra/caddy-egress`: EC2, Elastic IP, Caddyfile, local docker compose equivalent for M0.
5. `infra/monitoring-and-alerts`: alarms, dashboard, metric filters, runbooks.
6. `infra/deploy-pipeline`: OIDC role, deploy and plan workflows, smoke script.
7. `docs/egress-cost-finding`: ADR 0005 with the endpoint versus NAT numbers.

## Done when

* Gate A infrastructure items pass. `terraform plan` on a clean checkout shows no drift. A forced failure (stop the API task) raises an alarm email within 5 minutes.

## Ask before

* Applying anything, adding a NAT Gateway, a second environment, Multi AZ, or any resource over USD 10 per month not listed above.
