# AIApply — AI-Powered Job Application Platform

> **Stop applying to 200 jobs. Start applying to the right 20.**

AIApply uploads your CV once, learns your career goals, finds matching jobs, tailors your CV for each company, and applies on your behalf. Every application is transparent — you see exactly what was sent, to whom, and why.

Built on AWS serverless infrastructure (~**$5-7/month** at personal scale — basically just the Claude API).

---

## Table of Contents

- [Screenshots](#screenshots)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start — Local Dev](#quick-start--local-dev)
- [Deploying to AWS](#deploying-to-aws)
- [Agent Pipeline](#agent-pipeline)
- [Cost Breakdown](#cost-breakdown)
- [GitHub Actions CI/CD](#github-actions-cicd)
- [Roadmap](#roadmap)

---

## Screenshots

| Landing Page | CV Upload | Dashboard |
|---|---|---|
| "Stop applying to 200 jobs" hero | Drag-and-drop PDF/DOCX | Kanban: Matching → Offer |

| Application Detail | Career Goals |
|---|---|
| Split pane: job listing + CV diff (green/yellow/red) | Industry, salary, arrangement badges |

---

## Architecture

```
User Browser
    │
    ▼
S3 + CloudFront          ← Next.js 15 static export (frontend)
    │
    ▼
API Gateway (HTTP API)   ← REST endpoints
    │
    ▼
Lambda: api              ← Routes all /api/* requests
    │
    ├─── DynamoDB         ← Users, CVs, Applications, JobListings
    └─── S3               ← CV files, tailored CVs, screenshots

S3 Upload Event
    │
    ▼
Lambda: cv_analyst        ← Parse PDF/DOCX → extract structured data (Claude)
    │
    ▼
SQS: job-scout
    │
    ▼
Lambda: job_scout         ← Scrape LinkedIn/Indeed (JobSpy) → score matches (Claude Haiku)
    │
    ▼
SQS: cv-tailor
    │
    ▼
Lambda: cv_tailor         ← Rewrite CV per company → diff + cover letter (Claude Sonnet)
    │
    ▼
Status: "review"          ← User approves on dashboard → submits
```

**Auth**: AWS Cognito (email/password). JWT validated in each Lambda.

**Infrastructure as Code**: Terraform (6 modules, ~800 lines total).

**CI/CD**: GitHub Actions (3 workflows — ci, deploy, terraform).

---

## Tech Stack

| Layer | Technology | Monthly Cost |
|-------|-----------|-------------|
| Frontend | Next.js 15, TypeScript, shadcn/ui, Tailwind | $0 (CloudFront free tier) |
| Backend | Python 3.12, AWS Lambda | $0 (1M requests/mo free) |
| Database | DynamoDB | $0 (25 GB free tier) |
| Queue | SQS | $0 (1M messages/mo free) |
| Auth | AWS Cognito | $0 (50K MAU free) |
| Storage | S3 | $0 (5 GB free tier) |
| AI | Claude API (Anthropic) | **~$5–7/mo** (30 apps) |
| IaC | Terraform | $0 |
| CI/CD | GitHub Actions | $0 (public repos) |

---

## Project Structure

```
AIApply/
├── frontend/                        # Next.js 15 app
│   ├── app/
│   │   ├── page.tsx                 # Landing page
│   │   ├── login/page.tsx           # Login (Cognito)
│   │   ├── signup/page.tsx          # Sign up + email verify
│   │   ├── onboarding/page.tsx      # CV upload + career goals
│   │   ├── dashboard/page.tsx       # Kanban application tracker
│   │   ├── applications/[id]/       # Application detail + CV diff
│   │   └── settings/page.tsx        # Career goals + auto-apply toggle
│   ├── components/
│   │   ├── amplify-provider.tsx     # Cognito config wrapper
│   │   └── ui/                      # shadcn/ui components
│   ├── lib/
│   │   ├── auth.ts                  # Amplify/Cognito helpers
│   │   └── api.ts                   # API client (upload, goals, apps)
│   └── .env.local.example           # Environment variable template
│
├── backend/
│   └── lambdas/
│       ├── cv_analyst/handler.py    # S3 trigger → parse CV → DynamoDB
│       ├── api/handler.py           # API Gateway → REST routes
│       ├── job_scout/handler.py     # SQS → scrape jobs → score with Claude
│       └── cv_tailor/handler.py     # SQS → tailor CV → diff + cover letter
│
├── infrastructure/terraform/
│   ├── modules/
│   │   ├── storage/main.tf          # S3 (CVs) + DynamoDB (4 tables)
│   │   ├── cdn/main.tf              # S3 + CloudFront (frontend)
│   │   ├── auth/main.tf             # Cognito User Pool + App Client
│   │   ├── queue/main.tf            # SQS job-scout + cv-tailor queues
│   │   ├── api/main.tf              # Lambda functions + API Gateway
│   │   └── monitoring/main.tf       # CloudWatch dashboards + alarms
│   └── environments/dev/            # Dev environment (staging/prod same pattern)
│
├── .github/workflows/
│   ├── ci.yml                       # Lint + build on every PR
│   ├── deploy.yml                   # Deploy Lambda + frontend on push to main
│   └── terraform.yml                # Plan on PR, apply on merge
│
├── scripts/localstack-init.sh       # Creates local AWS resources in LocalStack
├── docker-compose.yml               # LocalStack for local dev
└── README.md                        # This file
```

---

## Quick Start — Local Dev

### Prerequisites

- Node.js 20+
- Python 3.12+
- Docker Desktop (for LocalStack)
- AWS CLI (`brew install awscli`)
- Terraform 1.7+ (`brew install terraform`)
- An Anthropic API key

### 1. Clone and install

```bash
git clone <your-repo>
cd AIApply

# Frontend
npm install --prefix frontend
cp frontend/.env.local.example frontend/.env.local
# Fill in your values (see .env.local.example)

# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

### 2. Start LocalStack (emulates AWS locally)

```bash
docker-compose up -d
# Wait ~20 seconds for LocalStack to initialise
docker-compose logs localstack | grep "Ready"
```

LocalStack automatically creates:
- S3 bucket: `aiapply-dev-cv-storage`
- DynamoDB tables: `users`, `cvs`, `job-listings`, `applications`
- SQS queues: `job-scout`, `cv-tailor`
- Secret: `aiapply-dev-anthropic-api-key`

### 3. Run the frontend

```bash
npm run dev --prefix frontend
# Open http://localhost:3000
```

### 4. Test a Lambda locally

```bash
cd backend
source .venv/bin/activate

# Set environment for LocalStack
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
export ANTHROPIC_API_KEY=sk-ant-your-key
export ENVIRONMENT=dev
export CV_BUCKET=aiapply-dev-cv-storage

# Test the API handler
python -c "
from lambdas.api.handler import lambda_handler
event = {'rawPath': '/api/health', 'requestContext': {'http': {'method': 'GET'}}}
print(lambda_handler(event, None))
"
```

---

## Deploying to AWS

### Step 1 — Bootstrap Terraform state storage

```bash
# Create S3 bucket for Terraform state (one-time setup)
aws s3 mb s3://aiapply-terraform-state --region us-east-1

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

### Step 2 — Apply Terraform

```bash
cd infrastructure/terraform/environments/dev

terraform init

# Preview what will be created
terraform plan -var="anthropic_api_key=sk-ant-YOUR_KEY"

# Create all AWS resources
terraform apply -var="anthropic_api_key=sk-ant-YOUR_KEY"
```

This creates (all within free tier at personal scale):
- ✅ S3 bucket + DynamoDB tables
- ✅ CloudFront distribution + S3 bucket (frontend)
- ✅ Cognito User Pool + App Client
- ✅ SQS queues + dead-letter queues
- ✅ Lambda functions + API Gateway
- ✅ CloudWatch dashboards + alarms
- ✅ IAM roles with least-privilege policies
- ✅ Secrets Manager (Anthropic API key)

### Step 3 — Configure frontend environment

```bash
# Get the outputs from Terraform
terraform output

# Create frontend/.env.local with the values
NEXT_PUBLIC_API_URL=<api_gateway_url>
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<cognito_user_pool_id>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<cognito_client_id>
NEXT_PUBLIC_AWS_REGION=us-east-1
```

### Step 4 — Deploy the frontend

```bash
npm run build --prefix frontend
aws s3 sync frontend/out/ s3://<frontend_bucket> --delete
aws cloudfront create-invalidation \
  --distribution-id <cloudfront_dist_id> \
  --paths "/*"
```

### Step 5 — Deploy Lambda functions

```bash
# Package and deploy each Lambda
for func in cv_analyst api job_scout cv_tailor; do
  cd backend/lambdas/$func
  pip install -r requirements.txt -t package/
  cp *.py package/
  cd package && zip -r "../${func}.zip" . && cd ..
  aws lambda update-function-code \
    --function-name aiapply-dev-${func} \
    --zip-file fileb://${func}.zip
  cd ../../..
done
```

After this, push to `main` and GitHub Actions handles all future deploys automatically.

---

## Agent Pipeline

The pipeline is event-driven via S3 and SQS:

```
1. User uploads CV to S3
        ↓ (S3 ObjectCreated event)
2. cv_analyst Lambda
   - Extracts text from PDF/DOCX
   - Sends to Claude Sonnet: extract name, skills, experience, education
   - Saves structured JSON to DynamoDB

3. User sets career goals on /onboarding
   - Target roles, industries, salary, location, dealbreakers saved to DynamoDB

4. Job Scout triggered (SQS message sent after goals saved)
        ↓ (SQS trigger)
5. job_scout Lambda
   - Scrapes LinkedIn + Indeed via JobSpy
   - Sends jobs to Claude Haiku: score each against career goals + CV
   - Filters: matchScore >= 70 AND careerAlignmentScore >= 70
   - Saves top 10 matches to DynamoDB
   - Creates Application record (status: "tailoring")
   - Sends message to cv-tailor SQS queue

        ↓ (SQS trigger)
6. cv_tailor Lambda
   - Loads original CV + job listing from DynamoDB
   - Sends to Claude Sonnet: rewrite CV for this specific company
   - Returns: tailored CV + list of changes + ATS score + cover letter
   - Saves tailored CV to S3
   - Updates Application record (status: "review")

7. User sees application on dashboard (status: "review")
   - Reviews the CV diff: green=added, yellow=modified, red=removed
   - Clicks "Approve & Submit"
   - Application status → "submitted"
```

### Claude model choices

| Agent | Model | Why |
|-------|-------|-----|
| CV Analyst | `claude-sonnet-4-5` | Accurate structured extraction |
| Job Scout | `claude-haiku-4-5` | High volume scoring, lowest cost |
| CV Tailor | `claude-sonnet-4-5` | Best creative rewriting quality |

---

## Cost Breakdown

### Per application: ~$0.15–0.24

| Step | Model | Est. Cost |
|------|-------|-----------|
| CV parsing (once per user) | Sonnet | ~$0.04 |
| Job scoring (20 jobs) | Haiku | ~$0.07 |
| CV tailoring | Sonnet | ~$0.06 |
| Cover letter | Sonnet | ~$0.04 |
| **Total** | | **~$0.21** |

With [prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) on system prompts: **~$0.15**.

### Monthly infrastructure

| Users | AWS infra | Claude API | **Total** |
|-------|-----------|-----------|-------|
| 1–2 (personal) | **$0** (free tier) | ~$5–7 | **~$7/mo** |
| 100 | ~$5 | ~$75 | ~$80/mo |
| 1,000 | ~$50 | ~$900 | ~$950/mo |

### Future SaaS pricing model

| Tier | Price | Applications | Margin |
|------|-------|-------------|--------|
| Free | $0 | 5/month | Loss leader |
| Pro | $29/mo | 30/month | ~81% |
| Premium | $59/mo | 60/month | ~82% |

---

## GitHub Actions CI/CD

### `ci.yml` — runs on every PR

```
lint-frontend   → ESLint + TypeScript check
lint-backend    → Ruff (Python linter)
test-frontend   → next build (compile check)
test-backend    → pytest (when tests added)
```

### `deploy.yml` — runs on push to `main`

```
deploy-frontend → npm build → s3 sync → CloudFront invalidation
deploy-backend  → zip each Lambda → aws lambda update-function-code
```

Uses **GitHub OIDC → IAM role** (no long-lived AWS credentials stored in GitHub).

### `terraform.yml` — runs on infra changes

```
PR  → terraform plan  (posted as PR comment)
main → terraform apply (auto-approve)
```

---

## Roadmap

### Phase 1 — Personal Tool ✅ (done)
- [x] CV upload + AI extraction
- [x] Career goals onboarding
- [x] Job Scout agent (JobSpy scraper)
- [x] CV Tailor agent (Claude Sonnet)
- [x] Dashboard with Kanban tracker
- [x] Application detail + CV diff view
- [x] Cognito auth + AWS serverless infra
- [x] Terraform + GitHub Actions CI/CD

### Phase 2 — Polish (next 2–4 weeks)
- [ ] Wire up Submit Agent (Playwright on Lambda for form auto-fill)
- [ ] Email notifications via SES (application submitted, interview booked)
- [ ] SQS trigger from career goals save (auto-starts job scout)
- [ ] CloudFront custom domain + SSL
- [ ] Mobile responsive tweaks

### Phase 3 — SaaS (when ready)
- [ ] Stripe subscription (Free / Pro / Premium)
- [ ] Migrate DynamoDB → RDS PostgreSQL + pgvector (semantic matching)
- [ ] Scale Lambda → ECS Fargate (for long-running Playwright sessions)
- [ ] Admin panel (user management, AI cost dashboard, pipeline monitoring)
- [ ] Analytics dashboard (interview conversion rates, skill demand)
- [ ] Add more job sources (Glassdoor, Adzuna, Reed)

---

## Contributing

This is a personal project — PRs welcome once it's public.

---

## License

MIT
