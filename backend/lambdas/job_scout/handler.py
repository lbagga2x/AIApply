"""
Job Scout Lambda — triggered by SQS.
Scrapes job listings via JobSpy, scores them against the user's career goals
using Claude, and saves matches to DynamoDB.
"""

import json
import os
import uuid
import boto3
import anthropic
from decimal import Decimal
from datetime import datetime, timezone


class DecimalEncoder(json.JSONEncoder):
    """DynamoDB returns numbers as Decimal — convert to float for JSON serialization."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)

s3_client = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")
ssm = boto3.client("ssm")
sqs = boto3.client("sqs")

ENVIRONMENT = os.environ.get("ENVIRONMENT", "dev")
ANTHROPIC_PARAM_NAME = os.environ.get("ANTHROPIC_PARAM_NAME", "")
CV_BUCKET = os.environ.get("CV_BUCKET", "")

JOBS_TABLE = f"aiapply-{ENVIRONMENT}-job-listings"
APPLICATIONS_TABLE = f"aiapply-{ENVIRONMENT}-applications"
USERS_TABLE = f"aiapply-{ENVIRONMENT}-users"
CV_TAILOR_QUEUE_URL = os.environ.get("CV_TAILOR_QUEUE_URL", "")

_anthropic_client = None


def get_client():
    global _anthropic_client
    if _anthropic_client is None:
        if ANTHROPIC_PARAM_NAME:
            param = ssm.get_parameter(Name=ANTHROPIC_PARAM_NAME, WithDecryption=True)
            api_key = param["Parameter"]["Value"]
        else:
            api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        _anthropic_client = anthropic.Anthropic(api_key=api_key)
    return _anthropic_client


def scrape_jobs(search_terms: list[str], location: str, num_results: int = 20) -> list[dict]:
    """Use JobSpy to scrape job listings."""
    try:
        from jobspy import scrape_jobs as jobspy_scrape
        jobs_df = jobspy_scrape(
            site_name=["linkedin", "indeed"],
            search_term=" OR ".join(search_terms[:3]),
            location=location or "Remote",
            results_wanted=num_results,
            hours_old=72,  # last 3 days only
            country_indeed="UK",
        )
        if jobs_df is None or jobs_df.empty:
            return []

        jobs = []
        for _, row in jobs_df.iterrows():
            jobs.append({
                "jobId": str(uuid.uuid4()),
                "title": str(row.get("title", "")),
                "company": str(row.get("company", "")),
                "location": str(row.get("location", "")),
                "description": str(row.get("description", ""))[:3000],  # truncate
                "url": str(row.get("job_url", "")),
                "source": str(row.get("site", "")),
                "salary_min": str(row.get("min_amount", "")),
                "salary_max": str(row.get("max_amount", "")),
                "postedAt": datetime.now(timezone.utc).isoformat(),
            })
        return jobs
    except Exception as e:
        print(f"JobSpy error: {e}")
        return []


def score_jobs_with_claude(jobs: list[dict], career_goals: dict, cv_summary: str) -> list[dict]:
    """Use Claude to score each job against career goals and CV."""
    if not jobs:
        return []

    client = get_client()

    # Build a compact job list for scoring
    job_list = "\n".join([
        f"{i+1}. [{j['title']} at {j['company']}] {j['description'][:300]}"
        for i, j in enumerate(jobs)
    ])

    career_summary = json.dumps({
        "targetRoles": career_goals.get("targetRoles", []),
        "targetIndustries": career_goals.get("targetIndustries", []),
        "workArrangement": career_goals.get("workArrangement", ["Remote"]),
        "dealbreakers": career_goals.get("dealbreakers", []),
        "minSalary": career_goals.get("minSalary"),
    }, cls=DecimalEncoder)

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": f"""Score these job listings for a candidate.

CANDIDATE PROFILE:
{cv_summary}

CAREER GOALS:
{career_summary}

JOB LISTINGS:
{job_list}

Return ONLY a JSON array (one object per job, same order):
[
  {{
    "index": 1,
    "matchScore": 85,
    "careerAlignmentScore": 78,
    "matchReason": "One sentence why this matches",
    "include": true
  }}
]

Rules:
- matchScore: how well skills/experience match the role (0-100)
- careerAlignmentScore: how well this advances stated career goals (0-100)
- include: true if both scores >= 70 AND no dealbreakers apply
Only return jobs with a realistic chance of success.""",
        }],
    )

    response_text = message.content[0].text
    if "```json" in response_text:
        response_text = response_text.split("```json")[1].split("```")[0]
    elif "```" in response_text:
        response_text = response_text.split("```")[1].split("```")[0]

    scores = json.loads(response_text.strip())
    score_map = {s["index"]: s for s in scores}

    scored_jobs = []
    for i, job in enumerate(jobs):
        score_data = score_map.get(i + 1, {})
        if score_data.get("include", False):
            scored_jobs.append({
                **job,
                "matchScore": score_data.get("matchScore", 0),
                "careerAlignmentScore": score_data.get("careerAlignmentScore", 0),
                "matchReason": score_data.get("matchReason", ""),
            })

    # Sort by combined score
    scored_jobs.sort(key=lambda j: j["matchScore"] + j["careerAlignmentScore"], reverse=True)
    return scored_jobs[:10]  # top 10 only


def lambda_handler(event, context):
    """Triggered by SQS message containing userId and cvId."""
    for record in event.get("Records", []):
        try:
            body = json.loads(record["body"])
            user_id = body["userId"]
            cv_id = body["cvId"]

            print(f"Scout for user {user_id}, cv {cv_id}")

            # Load career goals
            users_table = dynamodb.Table(USERS_TABLE)
            user = users_table.get_item(Key={"userId": user_id}).get("Item", {})
            career_goals = user.get("careerGoals", {})

            # Load CV structured data
            cvs_table = dynamodb.Table(f"aiapply-{ENVIRONMENT}-cvs")
            cv_item = cvs_table.get_item(
                Key={"userId": user_id, "cvId": cv_id}
            ).get("Item", {})
            cv_data = json.loads(cv_item.get("structuredData", "{}"))
            cv_summary = f"Skills: {', '.join(cv_data.get('skills', [])[:15])}. " \
                        f"Experience: {cv_data.get('totalYearsExperience', 0)} years. " \
                        f"Level: {cv_data.get('seniorityLevel', 'mid')}."

            # Scrape jobs
            target_roles = career_goals.get("targetRoles", ["Software Engineer"])
            location = (career_goals.get("locations") or ["Remote"])[0]
            raw_jobs = scrape_jobs(target_roles, location, num_results=30)

            if not raw_jobs:
                print("No jobs found from scrapers")
                return {"statusCode": 200, "body": "No jobs found"}

            # Score jobs
            matched_jobs = score_jobs_with_claude(raw_jobs, career_goals, cv_summary)

            # Save matched jobs to DynamoDB and queue CV tailoring
            jobs_table = dynamodb.Table(JOBS_TABLE)
            apps_table = dynamodb.Table(APPLICATIONS_TABLE)

            for job in matched_jobs:
                # Save job listing
                jobs_table.put_item(Item=job)

                # Create application record
                app_id = str(uuid.uuid4())
                apps_table.put_item(Item={
                    "userId": user_id,
                    "applicationId": app_id,
                    "jobId": job["jobId"],
                    "cvId": cv_id,
                    "status": "tailoring",
                    "companyName": job["company"],
                    "jobTitle": job["title"],
                    "matchScore": str(job["matchScore"]),
                    "careerAlignmentScore": str(job["careerAlignmentScore"]),
                    "matchReason": job["matchReason"],
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                })

                # Queue CV tailoring
                if CV_TAILOR_QUEUE_URL:
                    sqs.send_message(
                        QueueUrl=CV_TAILOR_QUEUE_URL,
                        MessageBody=json.dumps({
                            "userId": user_id,
                            "cvId": cv_id,
                            "applicationId": app_id,
                            "jobId": job["jobId"],
                        }),
                    )

            print(f"Found {len(matched_jobs)} matches, queued for tailoring")
            return {"statusCode": 200, "body": f"Found {len(matched_jobs)} matches"}

        except Exception as e:
            print(f"Error in job scout: {e}")
            import traceback
            traceback.print_exc()

    return {"statusCode": 200, "body": "Done"}
