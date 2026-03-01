#!/usr/bin/env bash
# Deploy all 4 Lambda functions with minimal per-function dependencies.
# Uses --platform manylinux2014_x86_64 so wheels work on Lambda (Linux x86_64)
# even when building on macOS.
set -e

export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"

REGION="us-east-1"
PREFIX="aiapply-dev"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
LAMBDAS_DIR="$REPO_ROOT/backend/lambdas"
BUILD_DIR="/tmp/aiapply_lambda_build"

pip_install() {
  # Install packages that have pre-built wheels for Lambda's Linux x86_64 runtime
  local target="$1"
  shift
  pip3 install \
    --platform manylinux2014_x86_64 \
    --target "$target" \
    --python-version 3.12 \
    --only-binary=:all: \
    --quiet \
    "$@"
}

pip_install_pure() {
  # Install pure-Python packages (no pre-built wheel needed)
  local target="$1"
  shift
  pip3 install \
    --target "$target" \
    --quiet \
    "$@"
}

deploy() {
  local func_dir="$1"       # e.g. api
  local lambda_name="$2"    # e.g. aiapply-dev-api-handler
  local pkg_dir="$BUILD_DIR/$func_dir"

  echo ""
  echo "=== Deploying $func_dir → $lambda_name ==="

  rm -rf "$pkg_dir" && mkdir -p "$pkg_dir"
  cp "$LAMBDAS_DIR/$func_dir/handler.py" "$pkg_dir/"

  # Install deps if provided
  shift 2
  if [ $# -gt 0 ]; then
    echo "  Installing: $*"
    pip_install "$pkg_dir" "$@"
  fi

  local zip_file="$BUILD_DIR/${func_dir}.zip"
  (cd "$pkg_dir" && zip -r "$zip_file" . -q)

  local size_kb=$(du -k "$zip_file" | cut -f1)
  echo "  Package size: ${size_kb} KB"

  aws lambda update-function-code \
    --function-name "$lambda_name" \
    --zip-file "fileb://$zip_file" \
    --region "$REGION" \
    --no-cli-pager

  echo "  ✓ Done"
}

mkdir -p "$BUILD_DIR"

# api — only uses boto3 which is built into the Lambda runtime
deploy "api" "$PREFIX-api-handler"

# cv_analyst — needs anthropic SDK, PyPDF2, python-docx
deploy "cv_analyst" "$PREFIX-cv-analyst" \
  "anthropic==0.84.0" "PyPDF2==3.0.1" "python-docx==1.2.0"

# job_scout — anthropic (binary wheel) + jobspy (pure Python, no wheel for target)
echo ""
echo "=== Deploying job_scout → $PREFIX-job-scout ==="
JOB_SCOUT_PKG="$BUILD_DIR/job_scout"
rm -rf "$JOB_SCOUT_PKG" && mkdir -p "$JOB_SCOUT_PKG"
cp "$LAMBDAS_DIR/job_scout/handler.py" "$JOB_SCOUT_PKG/"
echo "  Installing: anthropic==0.84.0 (binary wheel)"
pip_install "$JOB_SCOUT_PKG" "anthropic==0.84.0"
echo "  Installing: python-jobspy (pure Python, installs as jobspy module)"
pip_install "$JOB_SCOUT_PKG" "python-jobspy"
JOB_SCOUT_ZIP="$BUILD_DIR/job_scout.zip"
(cd "$JOB_SCOUT_PKG" && zip -r "$JOB_SCOUT_ZIP" . -q)
echo "  Package size: $(du -k "$JOB_SCOUT_ZIP" | cut -f1) KB"
aws lambda update-function-code \
  --function-name "$PREFIX-job-scout" \
  --zip-file "fileb://$JOB_SCOUT_ZIP" \
  --region "$REGION" \
  --no-cli-pager
echo "  ✓ Done"

# cv_tailor — needs anthropic only
deploy "cv_tailor" "$PREFIX-cv-tailor" \
  "anthropic==0.84.0"

echo ""
echo "=== All Lambdas deployed successfully ==="
