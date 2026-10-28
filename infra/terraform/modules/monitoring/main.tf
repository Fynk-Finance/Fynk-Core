data "aws_region" "current" {}

# SNS Topic for engineering alerts (HU-033)
resource "aws_sns_topic" "alerts" {
  name = "fynk-${var.environment}-alerts"

  tags = {
    Name    = "fynk-${var.environment}-alerts"
    module  = "monitoring"
    project = "fynk"
    env     = var.environment
  }
}

resource "aws_sns_topic_subscription" "email_sub" {
  count     = length(var.alert_emails)
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_emails[count.index]
}

# 1. ALB 5XX rate: over 5 errors in 5 minutes
resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "fynk-${var.environment}-alb-5xx-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "ALB target 5XX error count exceeded 5 in 5 minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  tags = {
    module  = "monitoring"
    project = "fynk"
    env     = var.environment
  }
}

# 2. Unhealthy targets for 2 minutes
resource "aws_cloudwatch_metric_alarm" "unhealthy_api" {
  alarm_name          = "fynk-${var.environment}-tg-api-unhealthy"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Maximum"
  threshold           = 1
  alarm_description   = "fynk-api has unhealthy targets for 2 consecutive minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.target_group_api_arn_suffix
  }

  tags = {
    module  = "monitoring"
    project = "fynk"
    env     = var.environment
  }
}

# 3. RDS CPU over 80% for 10 minutes
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "fynk-${var.environment}-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "RDS CPU utilization exceeded 80% for 10 minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  tags = {
    module  = "monitoring"
    project = "fynk"
    env     = var.environment
  }
}

# 4. RDS Free Storage under 2 GB (2,000,000,000 bytes)
resource "aws_cloudwatch_metric_alarm" "rds_storage" {
  alarm_name          = "fynk-${var.environment}-rds-storage-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 2000000000
  alarm_description   = "RDS free storage is below 2 GB"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  tags = {
    module  = "monitoring"
    project = "fynk"
    env     = var.environment
  }
}

# 5. Caddy instance status check failed
resource "aws_cloudwatch_metric_alarm" "caddy_status" {
  alarm_name          = "fynk-${var.environment}-caddy-status-check-failed"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Maximum"
  threshold           = 1
  alarm_description   = "Caddy egress instance status check failed"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    InstanceId = var.caddy_instance_id
  }

  tags = {
    module  = "monitoring"
    project = "fynk"
    env     = var.environment
  }
}

# 6. Custom Metric: bank.sync_failed over 10 in 15 minutes
resource "aws_cloudwatch_metric_alarm" "bank_sync_failed" {
  alarm_name          = "fynk-${var.environment}-bank-sync-failed-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "bank.sync_failed"
  namespace           = "Fynk/OpenFinance"
  period              = 900
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Bank synchronization failed more than 10 times in 15 minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  tags = {
    module  = "monitoring"
    project = "fynk"
    env     = var.environment
  }
}

# 7. Bedrock errors over 5 in 15 minutes
resource "aws_cloudwatch_metric_alarm" "bedrock_errors" {
  alarm_name          = "fynk-${var.environment}-bedrock-errors-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "InvocationServerErrors"
  namespace           = "AWS/Bedrock"
  period              = 900
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Amazon Bedrock API invocations failed more than 5 times in 15 minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  tags = {
    module  = "monitoring"
    project = "fynk"
    env     = var.environment
  }
}

# 8. Metric Filter: PII Leak Detection in Application Logs
resource "aws_cloudwatch_log_metric_filter" "pii_leak" {
  name           = "fynk-${var.environment}-pii-leak-detector"
  log_group_name = var.api_log_group_name
  pattern        = "[..., val = *Bearer* || val = *4[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]* || val = *5[1-5][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]*]"

  metric_transformation {
    name      = "PiiDetectedCount"
    namespace = "Fynk/Security"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "pii_leak" {
  alarm_name          = "fynk-${var.environment}-pii-leak-alert"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "PiiDetectedCount"
  namespace           = "Fynk/Security"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "SECURITY ALERT: Potential unmasked credential or card number detected in API logs"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  tags = {
    module  = "monitoring"
    project = "fynk"
    env     = var.environment
  }
}

# CloudWatch Dashboard: "Fynk staging" (HU-033)
resource "aws_cloudwatch_dashboard" "staging" {
  dashboard_name = "Fynk-staging"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "HealthyHostCount", "TargetGroup", var.target_group_api_arn_suffix, "LoadBalancer", var.alb_arn_suffix],
            [".", "UnHealthyHostCount", ".", ".", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Service Availability (Healthy vs Unhealthy Hosts)"
          period  = 60
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", var.alb_arn_suffix],
            [".", "HTTPCode_Target_2XX_Count", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "HTTP Status Codes (2xx vs 5xx)"
          period  = 60
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "TargetGroup", var.target_group_api_arn_suffix, "LoadBalancer", var.alb_arn_suffix, { stat = "p95" }],
            ["...", var.target_group_keycloak_arn_suffix, ".", ".", { stat = "p95" }],
            ["...", var.target_group_bank_simulator_arn_suffix, ".", ".", { stat = "p95" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Service Latency (p95 in seconds)"
          period  = 60
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["Fynk/OpenFinance", "bank.sync_failed"],
            [".", "bank.sync_success"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Bank Sync Results"
          period  = 300
        }
      }
    ]
  })
}
