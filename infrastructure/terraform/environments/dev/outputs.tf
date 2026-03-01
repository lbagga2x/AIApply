output "cloudfront_domain" {
  description = "CloudFront distribution domain name"
  value       = module.cdn.cloudfront_domain
}

output "api_gateway_url" {
  description = "API Gateway endpoint URL"
  value       = module.api.api_gateway_url
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.auth.user_pool_id
}

output "cognito_client_id" {
  description = "Cognito App Client ID"
  value       = module.auth.client_id
}

output "cv_bucket_name" {
  description = "S3 bucket for CV uploads"
  value       = module.storage.cv_bucket_name
}

output "frontend_bucket" {
  description = "S3 bucket for frontend — set as FRONTEND_BUCKET in GitHub vars"
  value       = module.cdn.frontend_bucket_name
}

output "cloudfront_dist_id" {
  description = "CloudFront distribution ID — set as CLOUDFRONT_DIST_ID in GitHub vars"
  value       = module.cdn.cloudfront_distribution_id
}

output "github_actions_role_arn" {
  description = "IAM role for GitHub Actions — set as AWS_DEPLOY_ROLE_ARN in GitHub vars"
  value       = module.cicd.github_actions_role_arn
}
