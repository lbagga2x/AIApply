#!/bin/bash
# Initialize LocalStack with required AWS resources for local development

echo "Initializing LocalStack resources..."

# Create S3 bucket for CV storage
awslocal s3 mb s3://aiapply-dev-cv-storage
awslocal s3api put-bucket-cors --bucket aiapply-dev-cv-storage --cors-configuration '{
  "CORSRules": [{"AllowedHeaders": ["*"], "AllowedMethods": ["PUT", "POST", "GET"], "AllowedOrigins": ["*"]}]
}'

# Create DynamoDB tables
awslocal dynamodb create-table \
  --table-name aiapply-dev-users \
  --attribute-definitions AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

awslocal dynamodb create-table \
  --table-name aiapply-dev-cvs \
  --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=cvId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH AttributeName=cvId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST

awslocal dynamodb create-table \
  --table-name aiapply-dev-job-listings \
  --attribute-definitions AttributeName=jobId,AttributeType=S AttributeName=source,AttributeType=S AttributeName=postedAt,AttributeType=S \
  --key-schema AttributeName=jobId,KeyType=HASH \
  --global-secondary-indexes '[{"IndexName": "source-postedAt-index", "KeySchema": [{"AttributeName": "source", "KeyType": "HASH"}, {"AttributeName": "postedAt", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}}]' \
  --billing-mode PAY_PER_REQUEST

awslocal dynamodb create-table \
  --table-name aiapply-dev-applications \
  --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=applicationId,AttributeType=S AttributeName=status,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH AttributeName=applicationId,KeyType=RANGE \
  --global-secondary-indexes '[{"IndexName": "userId-status-index", "KeySchema": [{"AttributeName": "userId", "KeyType": "HASH"}, {"AttributeName": "status", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}}]' \
  --billing-mode PAY_PER_REQUEST

# Create SQS queues
awslocal sqs create-queue --queue-name aiapply-dev-job-scout
awslocal sqs create-queue --queue-name aiapply-dev-job-scout-dlq
awslocal sqs create-queue --queue-name aiapply-dev-cv-tailor
awslocal sqs create-queue --queue-name aiapply-dev-cv-tailor-dlq

# Store Anthropic API key in SSM Parameter Store (free, replaces Secrets Manager)
awslocal ssm put-parameter \
  --name "/aiapply-dev/anthropic-api-key" \
  --type "SecureString" \
  --value "${ANTHROPIC_API_KEY:-sk-ant-placeholder}" \
  --overwrite

echo "LocalStack initialization complete!"
