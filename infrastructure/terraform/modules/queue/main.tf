variable "prefix" {
  type = string
}

variable "environment" {
  type = string
}

# --- SQS Queue: Job Scout (find and score jobs) ---
resource "aws_sqs_queue" "job_scout" {
  name                       = "${var.prefix}-job-scout"
  visibility_timeout_seconds = 900 # 15 min (Lambda max timeout)
  message_retention_seconds  = 86400 # 1 day
  receive_wait_time_seconds  = 10  # Long polling

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.job_scout_dlq.arn
    maxReceiveCount     = 3
  })
}

resource "aws_sqs_queue" "job_scout_dlq" {
  name                      = "${var.prefix}-job-scout-dlq"
  message_retention_seconds = 604800 # 7 days
}

# --- SQS Queue: CV Tailor (generate tailored CVs) ---
resource "aws_sqs_queue" "cv_tailor" {
  name                       = "${var.prefix}-cv-tailor"
  visibility_timeout_seconds = 900
  message_retention_seconds  = 86400
  receive_wait_time_seconds  = 10

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.cv_tailor_dlq.arn
    maxReceiveCount     = 3
  })
}

resource "aws_sqs_queue" "cv_tailor_dlq" {
  name                      = "${var.prefix}-cv-tailor-dlq"
  message_retention_seconds = 604800
}

# --- Outputs ---
output "job_scout_queue_url" {
  value = aws_sqs_queue.job_scout.url
}

output "job_scout_queue_arn" {
  value = aws_sqs_queue.job_scout.arn
}

output "cv_tailor_queue_url" {
  value = aws_sqs_queue.cv_tailor.url
}

output "cv_tailor_queue_arn" {
  value = aws_sqs_queue.cv_tailor.arn
}
