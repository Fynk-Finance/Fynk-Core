# Runbook: Rotate Open Finance mTLS Client Certificate

**Owner:** Module M14 (Juan Pablo Contreras / `@juancontrerasp`)  
**Frequency:** Every 90 days (per regulatory security baseline HU-032 / HU-034)  
**Target:** Caddy Egress instance (`fynk-staging-caddy-egress`)

---

## 1. Context & Architecture

Caddy egress runs on an EC2 Graviton instance in a public subnet with a static Elastic IP. It acts as an egress proxy for `fynk-api`, terminating internal TLS and originating mutual TLS (mTLS) with client certificates towards Open Finance financial institutions (Bancolombia, Banco Demo).

The client certificate and private key are stored securely in AWS Secrets Manager:
- `fynk/staging/mtls-client-cert`
- `fynk/staging/mtls-client-key`

---

## 2. Pre-Requisites

- AWS CLI configured with permissions to update Secrets Manager and execute SSM commands.
- The new client certificate (`fynk-client.crt`) and private key (`fynk-client.key`) issued by the approved CA (e.g. Certicámara / GSE or local CA for staging).
- The public key has already been registered / allowlisted by the partner bank.

---

## 3. Step-by-Step Rotation Procedure

### Step 3.1: Upload New Certificate and Key to Secrets Manager

```bash
# Upload new client certificate
aws secretsmanager put-secret-value \
  --secret-id "fynk/staging/mtls-client-cert" \
  --secret-string file://fynk-client.crt

# Upload new client private key
aws secretsmanager put-secret-value \
  --secret-id "fynk/staging/mtls-client-key" \
  --secret-string file://fynk-client.key
```

### Step 3.2: Fetch Secrets and Reload Caddy via AWS SSM (Zero SSH Required)

Obtain the Caddy instance ID from Terraform outputs or AWS CLI:

```bash
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=fynk-staging-caddy-egress" "Name=instance-state-name,Values=running" \
  --query "Reservations[0].Instances[0].InstanceId" --output text)

echo "Target instance: $INSTANCE_ID"
```

Execute remote refresh and Caddy restart via AWS Systems Manager:

```bash
aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --comment "Rotate mTLS client certificates and reload Caddy" \
  --parameters 'commands=[
    "set -euo pipefail",
    "aws secretsmanager get-secret-value --secret-id fynk/staging/mtls-client-cert --query SecretString --output text > /run/secrets/fynk-client.crt",
    "aws secretsmanager get-secret-value --secret-id fynk/staging/mtls-client-key --query SecretString --output text > /run/secrets/fynk-client.key",
    "chmod 600 /run/secrets/*",
    "docker restart caddy-egress"
  ]'
```

### Step 3.3: Verify the Handshake

Run a verification request from within the VPC (or via ECS test task):

```bash
# Verify health of Caddy
curl -k https://caddy.internal:8443/healthz

# Verify mTLS handshake with Banco Demo simulator
curl -k https://caddy.internal:8443/banco-demo/open-finance/v1/accounts
```

Check Caddy logs:
```bash
aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["docker logs --tail 50 caddy-egress"]'
```

### Step 3.4: Revoke and Decommission the Old Certificate

Once the partner bank and the verification tests confirm successful traffic, notify the CA / partner bank to revoke the previous leaf certificate. Record the rotation event in Jira under HU-034.
