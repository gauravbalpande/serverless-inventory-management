#!/bin/bash

# Deployment Verification Script
# This script checks if your deployment is configured correctly

echo "🔍 Cloud Inventory Deployment Verification"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check AWS CLI
echo "1. Checking AWS CLI..."
if command -v aws &> /dev/null; then
    echo -e "${GREEN}✓${NC} AWS CLI installed"
    aws --version
else
    echo -e "${RED}✗${NC} AWS CLI not found. Install it from https://aws.amazon.com/cli/"
    exit 1
fi

# Check AWS credentials
echo ""
echo "2. Checking AWS credentials..."
if aws sts get-caller-identity &> /dev/null; then
    echo -e "${GREEN}✓${NC} AWS credentials configured"
    aws sts get-caller-identity --query 'Account' --output text | xargs echo "   Account:"
else
    echo -e "${RED}✗${NC} AWS credentials not configured. Run 'aws configure'"
    exit 1
fi

# Check SAM CLI
echo ""
echo "3. Checking AWS SAM CLI..."
if command -v sam &> /dev/null; then
    echo -e "${GREEN}✓${NC} SAM CLI installed"
    sam --version
else
    echo -e "${RED}✗${NC} SAM CLI not found. Install it from https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
    exit 1
fi

# Check Node.js
echo ""
echo "4. Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js installed: $NODE_VERSION"
    if [[ $(node --version | cut -d'v' -f2 | cut -d'.' -f1) -lt 18 ]]; then
        echo -e "${YELLOW}⚠${NC} Node.js 18+ recommended"
    fi
else
    echo -e "${RED}✗${NC} Node.js not found. Install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# Check backend files
echo ""
echo "5. Checking backend files..."
if [ -f "backend/template.yaml" ]; then
    echo -e "${GREEN}✓${NC} template.yaml found"
else
    echo -e "${RED}✗${NC} backend/template.yaml not found"
    exit 1
fi

if [ -f "backend/src/inventoryHandler.js" ]; then
    echo -e "${GREEN}✓${NC} inventoryHandler.js found"
else
    echo -e "${RED}✗${NC} backend/src/inventoryHandler.js not found"
    exit 1
fi

# Check frontend files
echo ""
echo "6. Checking frontend files..."
if [ -f "frontend/index.html" ]; then
    echo -e "${GREEN}✓${NC} index.html found"
else
    echo -e "${RED}✗${NC} frontend/index.html not found"
    exit 1
fi

if [ -f "frontend/config.js" ]; then
    echo -e "${GREEN}✓${NC} config.js found"
    # Check if config has placeholder values
    if grep -q "your-api-id" frontend/config.js || grep -q "your_user_pool_id" frontend/config.js; then
        echo -e "${YELLOW}⚠${NC} config.js contains placeholder values. Update it with your deployment outputs."
    fi
else
    echo -e "${YELLOW}⚠${NC} config.js not found. Copy config.sample.js to config.js and update values."
fi

# Check if backend dependencies are installed
echo ""
echo "7. Checking backend dependencies..."
if [ -d "backend/node_modules" ]; then
    echo -e "${GREEN}✓${NC} Backend dependencies installed"
else
    echo -e "${YELLOW}⚠${NC} Backend dependencies not installed. Run 'cd backend && npm install'"
fi

# Summary
echo ""
echo "=========================================="
echo -e "${GREEN}Verification complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Deploy backend: cd backend && sam build && sam deploy --guided"
echo "2. Update frontend/config.js with deployment outputs"
echo "3. Run frontend: cd frontend && serve -p 3000 ."
echo ""
