#!/usr/bin/env bash
# terraform-bootstrap.sh
#
# Creates the S3 bucket and DynamoDB table needed for Terraform remote state.
# Run ONCE before the first `terraform init`. Safe to re-run (idempotent).
#
# Usage:
#   chmod +x scripts/terraform-bootstrap.sh
#   ./scripts/terraform-bootstrap.sh
#
# Prerequisites:
#   - AWS CLI configured (aws configure, or AWS_PROFILE / environment variables)
#   - Sufficient IAM permissions: s3:CreateBucket, s3:PutBucketVersioning,
#     s3:PutEncryptionConfiguration, dynamodb:CreateTable

set -euo pipefail

REGION="us-east-1"
STATE_BUCKET="aiapply-terraform-state"
LOCK_TABLE="terraform-locks"

echo "======================================================"
echo "  AIApply — Terraform State Bootstrap"
echo "======================================================"
echo ""

# ── S3 state bucket ──────────────────────────────────────
echo "==> Creating Terraform state S3 bucket: $STATE_BUCKET"

# us-east-1 is special: it does NOT accept LocationConstraint
if aws s3api create-bucket \
     --bucket "$STATE_BUCKET" \
     --region "$REGION" \
     2>/dev/null; then
  echo "    Created."
else
  echo "    Already exists (skipping create)."
fi

echo "    Enabling versioning..."
aws s3api put-bucket-versioning \
  --bucket "$STATE_BUCKET" \
  --versioning-configuration Status=Enabled

echo "    Enabling server-side encryption..."
aws s3api put-bucket-encryption \
  --bucket "$STATE_BUCKET" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}'

echo "    Blocking public access..."
aws s3api put-public-access-block \
  --bucket "$STATE_BUCKET" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

echo ""

# ── DynamoDB lock table ───────────────────────────────────
echo "==> Creating DynamoDB state lock table: $LOCK_TABLE"

if aws dynamodb create-table \
     --table-name "$LOCK_TABLE" \
     --attribute-definitions AttributeName=LockID,AttributeType=S \
     --key-schema AttributeName=LockID,KeyType=HASH \
     --billing-mode PAY_PER_REQUEST \
     --region "$REGION" \
     2>/dev/null; then
  echo "    Created."
else
  echo "    Already exists (skipping create)."
fi

echo ""
echo "======================================================"
echo "  Bootstrap complete!"
echo "======================================================"
echo ""
echo "Next steps:"
echo ""
echo "  1. cd infrastructure/terraform/environments/dev"
echo "  2. terraform init"
echo "  3. terraform apply -var='anthropic_api_key=sk-ant-YOUR_KEY'"
echo "     (review the plan and type 'yes')"
echo "  4. terraform output"
echo "     (copy the outputs into GitHub repo variables)"
echo ""
echo "GitHub repo variables to set (Settings → Secrets and variables → Actions → Variables):"
echo "  AWS_DEPLOY_ROLE_ARN  ← github_actions_role_arn"
echo "  API_GATEWAY_URL      ← api_gateway_url"
echo "  COGNITO_USER_POOL_ID ← cognito_user_pool_id"
echo "  COGNITO_CLIENT_ID    ← cognito_client_id"
echo "  FRONTEND_BUCKET      ← frontend_bucket"
echo "  CLOUDFRONT_DIST_ID   ← cloudfront_dist_id"
echo ""
echo "Also create two GitHub Environments (Settings → Environments):"
echo "  production"
echo "  infrastructure"
echo ""
