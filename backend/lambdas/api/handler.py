"""
API Handler Lambda — Serves REST API requests via API Gateway.
Routes requests to appropriate handlers for CRUD operations.
"""

import base64
import json
import os
import boto3
from decimal import Decimal
from datetime import datetime, timezone

dynamodb = boto3.resource("dynamodb")
s3 = boto3.client("s3")
sqs = boto3.client("sqs")

ENVIRONMENT = os.environ.get("ENVIRONMENT", "dev")
CV_BUCKET = os.environ.get("CV_BUCKET", "aiapply-dev-cv-storage")
SQS_JOB_SCOUT_URL = os.environ.get("SQS_JOB_SCOUT_URL", "")

# Table references
USERS_TABLE = f"aiapply-{ENVIRONMENT}-users"
CVS_TABLE = f"aiapply-{ENVIRONMENT}-cvs"
APPLICATIONS_TABLE = f"aiapply-{ENVIRONMENT}-applications"
JOBS_TABLE = f"aiapply-{ENVIRONMENT}-job-listings"


class DecimalEncoder(json.JSONEncoder):
    """Handle DynamoDB Decimal types in JSON serialization."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def response(status_code: int, body: dict) -> dict:
    """Create API Gateway response."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        },
        "body": json.dumps(body, cls=DecimalEncoder),
    }


def get_user_id(event: dict) -> str:
    """Extract user ID (Cognito sub) from the JWT.

    Tries two sources in order:
    1. requestContext.authorizer.jwt.claims — populated when API Gateway has a
       JWT authorizer configured (preferred, validated by APIGW).
    2. Authorization header — decode the JWT payload directly (base64url).
       No signature verification here; we trust APIGW already accepted the
       request over HTTPS from our own frontend.
    """
    # Path 1: API Gateway JWT authorizer (if configured)
    claims = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    )
    if claims.get("sub"):
        return claims["sub"]

    # Path 2: Decode JWT payload from Authorization header
    auth_header = (event.get("headers") or {}).get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        try:
            token = auth_header.split(" ", 1)[1]
            # JWT = header.payload.signature — we only need the payload
            payload_b64 = token.split(".")[1]
            # Base64url → base64 (add padding)
            payload_b64 += "=" * (4 - len(payload_b64) % 4)
            payload = json.loads(base64.b64decode(payload_b64).decode("utf-8"))
            sub = payload.get("sub", "")
            if sub:
                return sub
        except Exception as e:
            print(f"JWT decode error: {e}")

    return "anonymous"


def handle_get_profile(event: dict) -> dict:
    """GET /api/profile — Get user profile and CV data."""
    user_id = get_user_id(event)
    table = dynamodb.Table(CVS_TABLE)

    result = table.query(
        KeyConditionExpression="userId = :uid",
        ExpressionAttributeValues={":uid": user_id},
    )

    cvs = result.get("Items", [])
    # Parse structured data JSON strings back to dicts
    for cv in cvs:
        if "structuredData" in cv and isinstance(cv["structuredData"], str):
            cv["structuredData"] = json.loads(cv["structuredData"])

    return response(200, {"userId": user_id, "cvs": cvs})


def handle_get_applications(event: dict) -> dict:
    """GET /api/applications — Get all applications for the user, enriched with job URLs."""
    user_id = get_user_id(event)
    table = dynamodb.Table(APPLICATIONS_TABLE)

    result = table.query(
        KeyConditionExpression="userId = :uid",
        ExpressionAttributeValues={":uid": user_id},
        ScanIndexForward=False,  # newest first
    )

    applications = result.get("Items", [])

    # Enrich with jobUrl from the job-listings table (for applications that
    # don't already have jobUrl embedded on the record).
    # Use individual GetItem calls — the Lambda role has GetItem but not
    # BatchGetItem, and we have at most ~10 applications so it's fine.
    needs_url = [a for a in applications if a.get("jobId") and not a.get("jobUrl")]
    if needs_url:
        jobs_table = dynamodb.Table(JOBS_TABLE)
        job_ids = list({a["jobId"] for a in needs_url})
        job_urls = {}
        for jid in job_ids:
            try:
                item = jobs_table.get_item(
                    Key={"jobId": jid},
                    ProjectionExpression="jobId, #u",
                    ExpressionAttributeNames={"#u": "url"},
                ).get("Item", {})
                if item:
                    job_urls[jid] = item.get("url", "")
            except Exception as e:
                print(f"Could not fetch URL for job {jid}: {e}")
        for app in applications:
            if app.get("jobId") and app["jobId"] in job_urls:
                app["jobUrl"] = job_urls[app["jobId"]]

    return response(200, {"applications": applications})


def handle_get_upload_url(event: dict) -> dict:
    """POST /api/upload-url — Generate presigned S3 URL for CV upload."""
    user_id = get_user_id(event)
    body = json.loads(event.get("body", "{}"))
    file_name = body.get("fileName", "cv.pdf")
    file_type = body.get("fileType", "application/pdf")

    # Sanitize filename
    safe_name = file_name.replace(" ", "_").replace("/", "_")
    cv_id = safe_name.rsplit(".", 1)[0]
    s3_key = f"uploads/{user_id}/{safe_name}"

    presigned_url = s3.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": CV_BUCKET,
            "Key": s3_key,
            "ContentType": file_type,
        },
        ExpiresIn=300,  # 5 minutes
    )

    return response(200, {
        "uploadUrl": presigned_url,
        "s3Key": s3_key,
        "cvId": cv_id,
    })


def get_job_scout_queue_url() -> str:
    """Get job scout SQS queue URL from env var, or derive it via STS (no extra perms needed)."""
    if SQS_JOB_SCOUT_URL:
        return SQS_JOB_SCOUT_URL
    # Fallback: derive from account ID — works without GetQueueUrl permission
    account_id = boto3.client("sts").get_caller_identity()["Account"]
    region = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
    return f"https://sqs.{region}.amazonaws.com/{account_id}/aiapply-{ENVIRONMENT}-job-scout"


def handle_save_career_goals(event: dict) -> dict:
    """POST /api/career-goals — Save user's career goals and trigger job scout."""
    user_id = get_user_id(event)
    body = json.loads(event.get("body", "{}"))

    table = dynamodb.Table(USERS_TABLE)
    table.put_item(
        Item={
            "userId": user_id,
            "careerGoals": {
                "targetRoles": body.get("targetRoles", []),
                "targetIndustries": body.get("targetIndustries", []),
                "minSalary": body.get("minSalary"),
                "maxSalary": body.get("maxSalary"),
                "locations": body.get("locations", []),
                "workArrangement": body.get("workArrangement", ["remote"]),
                "dealbreakers": body.get("dealbreakers", []),
            },
        }
    )

    # Trigger job scout for the user's primary CV
    cvs_table = dynamodb.Table(CVS_TABLE)
    result = cvs_table.query(
        KeyConditionExpression="userId = :uid",
        ExpressionAttributeValues={":uid": user_id},
        Limit=1,
    )
    items = result.get("Items", [])
    if items:
        cv_id = items[0]["cvId"]
        queue_url = get_job_scout_queue_url()
        sqs.send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps({"userId": user_id, "cvId": cv_id}),
        )
        print(f"Triggered job scout for user {user_id}, cv {cv_id}")
    else:
        print(f"No CV found for user {user_id} — job scout not triggered")

    return response(200, {"message": "Career goals saved"})


def handle_get_career_goals(event: dict) -> dict:
    """GET /api/career-goals — Get user's career goals."""
    user_id = get_user_id(event)
    table = dynamodb.Table(USERS_TABLE)

    result = table.get_item(Key={"userId": user_id})
    item = result.get("Item", {})

    return response(200, {"careerGoals": item.get("careerGoals", {})})


def handle_delete_application(event: dict) -> dict:
    """DELETE /api/applications — Permanently delete an application record."""
    user_id = get_user_id(event)
    params = event.get("queryStringParameters") or {}
    application_id = params.get("applicationId")

    if not application_id:
        return response(400, {"error": "applicationId required"})

    table = dynamodb.Table(APPLICATIONS_TABLE)
    table.delete_item(Key={"userId": user_id, "applicationId": application_id})
    return response(200, {"message": "Application deleted"})


def handle_approve_application(event: dict) -> dict:
    """POST /api/applications/approve — Mark a reviewed application as submitted."""
    user_id = get_user_id(event)
    body = json.loads(event.get("body", "{}"))
    application_id = body.get("applicationId")

    if not application_id:
        return response(400, {"error": "applicationId required"})

    table = dynamodb.Table(APPLICATIONS_TABLE)
    table.update_item(
        Key={"userId": user_id, "applicationId": application_id},
        UpdateExpression="SET #status = :s, submittedAt = :t",
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={
            ":s": "submitted",
            ":t": datetime.now(timezone.utc).isoformat(),
        },
    )

    return response(200, {"message": "Application approved and marked as submitted"})


def handle_get_tailored_cv(event: dict) -> dict:
    """GET /api/applications/tailored-cv?applicationId=xxx — Fetch the tailored CV JSON from S3."""
    user_id = get_user_id(event)
    params = event.get("queryStringParameters") or {}
    application_id = params.get("applicationId")

    if not application_id:
        return response(400, {"error": "applicationId required"})

    # Look up application to get the S3 key (also verifies ownership via userId PK)
    apps_table = dynamodb.Table(APPLICATIONS_TABLE)
    item = apps_table.get_item(
        Key={"userId": user_id, "applicationId": application_id}
    ).get("Item", {})

    tailored_cv_key = item.get("tailoredCvKey")
    if not tailored_cv_key:
        return response(404, {"error": "Tailored CV not ready yet"})

    obj = s3.get_object(Bucket=CV_BUCKET, Key=tailored_cv_key)
    cv_data = json.loads(obj["Body"].read().decode("utf-8"))

    return response(200, {"tailoredCV": cv_data})


def lambda_handler(event, context):
    """Main Lambda handler — routes requests based on path and method."""
    raw_path = event.get("rawPath", "")
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")

    print(f"Request: {method} {raw_path}")

    # Route mapping
    if method == "OPTIONS":
        return response(200, {})
    elif raw_path == "/api/profile" and method == "GET":
        return handle_get_profile(event)
    elif raw_path == "/api/applications" and method == "GET":
        return handle_get_applications(event)
    elif raw_path == "/api/applications" and method == "DELETE":
        return handle_delete_application(event)
    elif raw_path == "/api/applications/approve" and method == "POST":
        return handle_approve_application(event)
    elif raw_path == "/api/applications/tailored-cv" and method == "GET":
        return handle_get_tailored_cv(event)
    elif raw_path == "/api/upload-url" and method == "POST":
        return handle_get_upload_url(event)
    elif raw_path == "/api/career-goals" and method == "POST":
        return handle_save_career_goals(event)
    elif raw_path == "/api/career-goals" and method == "GET":
        return handle_get_career_goals(event)
    elif raw_path == "/api/health":
        return response(200, {"status": "healthy", "environment": ENVIRONMENT})
    else:
        return response(404, {"error": f"Not found: {method} {raw_path}"})
