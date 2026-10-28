# Runbook: Staging Infrastructure Incident Response

**Owner:** Module M14 (Juan Pablo Contreras / `@juancontrerasp`)  
**Scope:** Staging Environment (`fynk-staging`)  
**Reference:** HU-033 SCRUM-47 (Monitoreo y trazabilidad de incidentes)

---

## 1. Incident Severity Levels

| Severity | Definition | Examples | Response Target |
|---|---|---|---|
| **P1 - Critical** | Full outage of core banking/auth features | ALB 5xx rate > 5/min, Keycloak unreachable, DB crash | < 15 minutes |
| **P2 - Major** | Degraded functionality or security alert | Bank sync failure rate > 10, PII detected in logs, Caddy egress down | < 30 minutes |
| **P3 - Minor** | Performance warning, resource threshold | RDS CPU > 80%, Free storage < 2 GB | < 2 hours |

---

## 2. Who Receives the Alarm

- All CloudWatch Alarms publish to the SNS Topic `fynk-staging-alerts`.
- Subscribed endpoints include the engineering team mailing list (`dev-team@fynk.club`) and Slack integration channel `#fynk-alerts`.

---

## 3. First Checks & Diagnostic Playbook

### Step 3.1: Check CloudWatch Dashboard
Navigate to AWS Console -> CloudWatch -> Dashboards -> **`Fynk-staging`**:
- Review healthy host counts for `api`, `keycloak`, and `bankdemo`.
- Inspect p95 latency anomalies.
- Check 5xx error spikes and correlation with recent deployments.

### Step 3.2: Inspect Application & Container Logs
Run via AWS CLI:
```bash
# Check fynk-api logs for errors in the last 15 minutes
aws logs filter-log-events \
  --log-group-name "/ecs/fynk-staging-api" \
  --start-time $(date -d '15 minutes ago' +%s000) \
  --filter-pattern "ERROR"

# Check Keycloak authentication logs
aws logs filter-log-events \
  --log-group-name "/ecs/fynk-staging-keycloak" \
  --start-time $(date -d '15 minutes ago' +%s000) \
  --filter-pattern "ERROR"
```

### Step 3.3: Verify Caddy Egress Health
If bank sync operations fail (`bank.sync_failed` alarm):
```bash
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=fynk-staging-caddy-egress" "Name=instance-state-name,Values=running" \
  --query "Reservations[0].Instances[0].InstanceId" --output text)

aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["docker ps", "docker logs --tail 20 caddy-egress"]'
```

### Step 3.4: PII Leak Remediation
If alarm `fynk-staging-pii-leak-alert` fires:
1. Identify the log stream containing unmasked bearer tokens, card numbers, or credentials.
2. Immediately contact the on-call engineer for M0/M1/M5 to patch the logging serializer.
3. In accordance with Colombian data protection regulations (Ley 1581 de 2012 / Circular Externa 004), delete or mask the affected CloudWatch log events.

---

## 4. Recording the Incident in Jira

1. Open Jira project **FYNK**.
2. Create an Issue of type **Bug** or **Incident**.
3. Set components: `Infrastructure`, `M14`.
4. Template format:
   - **Summary:** `[INCIDENT] <Alarm Name> triggered on staging`
   - **Trigger Time:** UTC timestamp of alarm.
   - **Impact:** Services affected and user impact.
   - **Root Cause Analysis (RCA):** What failed and why.
   - **Remediation Action:** What was changed to resolve and prevent recurrence.
5. Link the issue to the relevant Scrum sprint.
