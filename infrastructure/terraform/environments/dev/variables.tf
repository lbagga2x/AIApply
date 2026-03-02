variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "aiapply"
}

variable "anthropic_api_key" {
  description = "Anthropic API key for Claude"
  type        = string
  sensitive   = true
}

variable "github_repo" {
  description = "GitHub repo in 'owner/repo-name' format, e.g. 'johnsmith/AIApply'"
  type        = string
  default     = "lbagga2x/AIApply"
}
