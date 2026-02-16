#!/bin/bash
#
# Set up S3 bucket and export for QuickSight analytics.
# Run from repo root. Requires: AWS CLI, jq, STACK_NAME (e.g. cloud-inventory-backend).
#
set -e

STACK_NAME="${STACK_NAME:-cloud-inventory-backend}"
REGION="${AWS_REGION:-us-east-1}"
BUCKET="cloud-inventory-quicksight-${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"
TRANSACTIONS_TABLE="${STACK_NAME}-Transactions"
PRODUCTS_TABLE="${STACK_NAME}-Products"

echo "Stack: $STACK_NAME Region: $REGION Bucket: $BUCKET"

# 1. Create S3 bucket for analytics export
aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null || aws s3api create-bucket --bucket "$BUCKET" --region "$REGION"
aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled 2>/dev/null || true

# 2. Export DynamoDB Transactions table to S3 (one-off scan + CSV)
echo "Exporting $TRANSACTIONS_TABLE to s3://$BUCKET/transactions/..."
TMPJSON=$(mktemp).json
TMPCSV=$(mktemp).csv
aws dynamodb scan --table-name "$TRANSACTIONS_TABLE" --region "$REGION" --output json > "$TMPJSON"
node -e "
  const fs = require('fs');
  const d = JSON.parse(fs.readFileSync('$TMPJSON', 'utf8'));
  const rows = (d.Items || []).map(i => ({
    shopId: (i.shopId && i.shopId.S) || '',
    transactionId: (i.transactionId && i.transactionId.S) || '',
    productId: (i.productId && i.productId.S) || '',
    type: (i.type && i.type.S) || '',
    quantity: (i.quantity && i.quantity.N) || '',
    balanceAfter: (i.balanceAfter && i.balanceAfter.N) || '',
    note: (i.note && i.note.S) || '',
    createdAt: (i.createdAt && i.createdAt.S) || ''
  }));
  const header = 'shopId,transactionId,productId,type,quantity,balanceAfter,note,createdAt';
  const csv = [header].concat(rows.map(r => [r.shopId,r.transactionId,r.productId,r.type,r.quantity,r.balanceAfter,(r.note||'').replace(/,/g,' '),r.createdAt].join(','))).join('\n');
  fs.writeFileSync('$TMPCSV', csv);
"
aws s3 cp "$TMPCSV" "s3://$BUCKET/transactions/transactions-$(date +%Y%m%d).csv" --region "$REGION"
rm -f "$TMPJSON" "$TMPCSV"

# 3. QuickSight: grant access to bucket (use QuickSight role or create resource policy)
echo ""
echo "Next steps (manual in AWS Console):"
echo "1. QuickSight: Admin → Manage QuickSight → Security & permissions: ensure S3 access for $BUCKET."
echo "2. QuickSight: New dataset → S3, choose s3://$BUCKET/transactions/"
echo "3. Create analysis: e.g. quantity by type, balanceAfter over time, by shopId."
echo ""
echo "Bucket: s3://$BUCKET  (transactions CSV uploaded)"
