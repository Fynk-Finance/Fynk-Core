# ADR 0005: Egress Architecture and Cost Analysis (Interface Endpoints vs NAT Gateway)

* Status: proposed
* Date: 2026-10-27
* Owner: M14 Infrastructure and Platform (Juan Pablo Contreras / `@juancontrerasp`)
* Jira: SCRUM-46, SCRUM-48 (HU-032, HU-034)

---

## 1. Context

Fynk's backend services (`fynk-api`, `keycloak`, `bank-simulator`) run inside private subnets without public IP addresses to satisfy strict financial security baselines (Open Finance / Superfinanciera Circular Externa 004 de 2024 / Decreto 0368 de 2026).

These private ECS Fargate tasks and container instances require outbound network connectivity to AWS managed services:
- Pulling container images from Amazon ECR (`ecr.api`, `ecr.dkr`).
- Emitting structured application logs to Amazon CloudWatch (`logs`).
- Retrieving master passwords, certificates, and auth tokens from AWS Secrets Manager (`secretsmanager`).
- Cryptographic operations with AWS KMS (`kms`).
- Invoking generative AI foundation models on Amazon Bedrock Converse API (`bedrock-runtime`).
- Sending transactional emails via Amazon SES (`email-smtp`).

Additionally, `fynk-api` must make outbound HTTPS calls with mutual TLS (`mTLS`) to financial institutions (Bancolombia Sandbox, Banco Demo) and Alpaca market data.

---

## 2. The Architectural Alternatives

### Option A: Private Subnets with Interface VPC Endpoints + Dedicated Caddy Egress EC2 (Current Confirmed Design)

- **AWS Services Traffic:** Remains strictly on the AWS private backbone via 7 AWS PrivateLink Interface VPC Endpoints placed in 1 AZ (`us-east-1a`). S3 access uses the free Gateway VPC Endpoint.
- **External Banking & Market Egress:** Routed through a dedicated Caddy reverse proxy running on an EC2 Graviton `t4g.nano` in a public subnet with a static Elastic IP. Partner banks allowlist this single static IP.
- **NAT Gateway:** None.

### Option B: Private Subnets with a Single AWS NAT Gateway

- **AWS Services Traffic & External Egress:** All outbound traffic from private subnets (ECR, CloudWatch, Secrets Manager, Bedrock, banks) routes through 1 AWS NAT Gateway in a public subnet with an Elastic IP.
- **Interface VPC Endpoints:** None needed. S3 Gateway endpoint retained (free).
- **Caddy Proxy:** Either kept as a software forward proxy inside ECS/EC2 or combined into the egress path.

---

## 3. Cost Analysis Comparison (us-east-1, October 2026 Pricing)

| Resource | Option A: Interface Endpoints + Caddy EC2 | Option B: Single NAT Gateway | Difference & Analysis |
|---|---|---|---|
| **VPC Interface Endpoints** | **$51.10 / month**<br>(7 endpoints × $0.01/hr × 730 hrs in 1 AZ) | **$0.00** | Endpoints charge an hourly base fee per endpoint per AZ regardless of traffic volume. |
| **Endpoint Data Processing** | ~$0.10 / month<br>($0.01 / GB for low staging traffic) | **$0.00** | Minimal for staging. |
| **AWS NAT Gateway** | **$0.00** | **$32.85 / month**<br>($0.045/hr × 730 hrs) | Base fixed cost for 1 NAT Gateway. |
| **NAT Gateway Data Processing** | **$0.00** | ~$0.45 / month<br>($0.045 / GB, ~10 GB in staging) | Charges per gigabyte processed. |
| **Caddy Egress EC2 (`t4g.nano`)** | **$3.80 / month**<br>($0.0052/hr × 730 hrs) | **$0.00**<br>(or $3.80 if dedicated egress proxy retained) | Tiny Graviton instance running Caddy mTLS proxy. |
| **Elastic IP** | **$3.65 / month**<br>($0.005/hr when attached to running instance) | **$3.65 / month**<br>(Attached to NAT Gateway) | Identical IP reservation cost. |
| **S3 Gateway Endpoint** | **$0.00** (Free) | **$0.00** (Free) | Free in both architectures. |
| **Total Outbound Platform Cost** | **~$58.65 / month** | **~$36.95 / month** | **Option B saves ~$21.70 / month (-37%)** in staging! |

---

## 4. Architectural Trade-offs & Security Findings

| Dimension | Option A: Interface Endpoints (Confirmed) | Option B: NAT Gateway |
|---|---|---|
| **Monthly Staging Cost** | ~$58.65 / mo | ~$36.95 / mo |
| **Network Attack Surface** | **Zero Internet Route:** Private subnets have no default route (`0.0.0.0/0`) whatsoever. Impossible for compromised containers to exfiltrate data to arbitrary public IPs. | **Full Internet Route:** Private subnets have a route to `0.0.0.0/0` via NAT Gateway. Network egress filtering requires security groups or DNS firewalls. |
| **AWS Backbone Isolation** | All AWS API calls (KMS, Secrets, Bedrock) remain entirely within the private AWS network fabric. | AWS API calls traverse the public endpoints of AWS services via NAT Gateway. |
| **mTLS & Bank Allowlisting** | Caddy EC2 instance terminates internal TLS, injects client certificates from Secrets Manager, and presents a stable Elastic IP to banks. | NAT Gateway provides a stable IP, but still requires an application proxy to inject the mTLS client certificate towards banks. |
| **Multi-AZ Scaling Cost** | If scaled to 2 AZs for high availability, interface endpoints double to ~$102.20 / mo. | If scaled to 2 AZs with redundant NAT Gateways, cost increases to ~$65.70 / mo. |

---

## 5. Recommendation for the Engineering Team

1. **Staging Recommendation:**
   - Keep the **confirmed design (Option A: 7 Interface Endpoints in 1 AZ + Caddy Egress EC2)** for the staging evaluation and jury demonstration.
   - Even though Option A costs approximately **$21.70 / month more** than a single NAT Gateway, it enforces **complete network isolation (air-gapped private subnets with no default internet gateway route)**. This provides decisive evidence for compliance audit HU-027 and security evaluation HU-032.
2. **Production Roadmap Consideration:**
   - As traffic scales significantly in production (> 500 GB/month), or if multiple AZs are mandated for disaster recovery, the team should re-evaluate introducing a NAT Gateway paired with an egress proxy filter or AWS Network Firewall to balance hourly endpoint fees against data processing fees.

---

## 6. Decision & Team Next Steps

* As established in `docs/modules/M14-infrastructure.md`, the confirmed design is implemented in Terraform without unapproved changes.
* This ADR is submitted to the team repository for formal sign-off during Sprint 2.
