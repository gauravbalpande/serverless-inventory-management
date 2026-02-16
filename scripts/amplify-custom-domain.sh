#!/bin/bash
#
# Configure custom domain for an existing Amplify app.
# Prereqs: Amplify app already created and connected to repo; domain owned in Route 53 (or use external DNS).
#
# Usage:
#   AMPLIFY_APP_ID=xxx AMPLIFY_BRANCH=main DOMAIN=app.example.com ./scripts/amplify-custom-domain.sh
#   # Or with subdomain only (Amplify will suggest SSL):
#   AMPLIFY_APP_ID=xxx DOMAIN=inventory.example.com ./scripts/amplify-custom-domain.sh
#
set -e

AMPLIFY_APP_ID="${AMPLIFY_APP_ID:?Set AMPLIFY_APP_ID (Amplify console → App settings → General)}"
AMPLIFY_BRANCH="${AMPLIFY_BRANCH:-main}"
DOMAIN="${DOMAIN:?Set DOMAIN (e.g. inventory.example.com)}"
REGION="${AWS_REGION:-us-east-1}"

echo "App: $AMPLIFY_APP_ID  Branch: $AMPLIFY_BRANCH  Domain: $DOMAIN"

# 1. Associate domain with Amplify app (creates SSL and gives CNAME target)
aws amplify create-domain-association \
  --app-id "$AMPLIFY_APP_ID" \
  --domain-name "$DOMAIN" \
  --region "$REGION" \
  --sub-domain-settings "prefix=$AMPLIFY_BRANCH,branchName=$AMPLIFY_BRANCH" 2>/dev/null || \
aws amplify update-domain-association \
  --app-id "$AMPLIFY_APP_ID" \
  --domain-name "$DOMAIN" \
  --region "$REGION" \
  --sub-domain-settings "prefix=$AMPLIFY_BRANCH,branchName=$AMPLIFY_BRANCH"

# 2. Get CNAME target for the branch
echo ""
echo "Domain association created/updated. To finish:"
echo "1. In Route 53 (or your DNS): create CNAME record:"
echo "   $AMPLIFY_BRANCH.$DOMAIN  ->  (value shown in Amplify console: Domain management)"
echo "   Or for apex $DOMAIN, use the Amplify-provided alias target."
echo "2. In Amplify: Domain management → $DOMAIN → Verify. Wait for SSL to be issued."
echo ""
aws amplify get-domain-association --app-id "$AMPLIFY_APP_ID" --domain-name "$DOMAIN" --region "$REGION" 2>/dev/null | cat
