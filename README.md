## Cloud-Based Inventory Management System for Local Businesses

This project is a **serverless, cloud-based inventory management system** designed for local retailers. It provides:

- **Live inventory dashboard** for stock levels, search, filters, and low-stock alerts.
- **Serverless backend** on AWS (API Gateway + Lambda + DynamoDB + SNS).
- **Authentication** with Amazon Cognito (shop owners).
- **Hosting-ready frontend** for deployment via AWS Amplify.
- **Optional analytics layer** for sales and stock trends.

### High-Level Features

- **Product & inventory management**
  - CRUD for shops, products, and stock levels.
  - Record stock in/out transactions (sales and restocks).
  - View recent sales history per product.
- **Low-stock alerts**
  - Threshold per product.
  - Amazon SNS topic for email/SMS notifications.
- **Dashboard**
  - Inventory table with search, filters (shop, category, low-stock).
  - Quick actions: add/remove stock, create products.
  - Visual indicators for low stock.
- **Security & hosting**
  - Cognito user pool for shop-owner login.
  - Frontend statically hosted on AWS Amplify.

---

## Project Structure

- `backend/`
  - `template.yaml` – AWS SAM/CloudFormation template defining:
    - API Gateway REST API
    - Lambda functions for inventory
    - DynamoDB tables
    - SNS topic for low-stock alerts
    - Cognito User Pool + App Client
  - `src/`
    - `inventoryHandler.js` – main CRUD + stock logic.
  - `package.json` – Lambda runtime dependencies.
- `frontend/`
  - `index.html` – React app shell (UMD + CDN-based).
  - `app.js` – React components and API integration.
  - `styles.css` – dashboard styling.
  - `config.sample.js` – example runtime configuration for API base URL and Cognito IDs.

---

## Architecture Diagram

The following Mermaid diagram shows the overall architecture:

```mermaid
flowchart LR
  subgraph Client
    A[React Inventory Dashboard<br/>AWS Amplify Hosting]
  end

  subgraph Auth[Cognito]
    C[User Pool<br/>Shop Owners]
  end

  subgraph API[Serverless Backend]
    G[API Gateway]
    L[Lambda: inventoryHandler]
  end

  subgraph Data[Data Layer]
    D1[(DynamoDB<br/>Shops)]
    D2[(DynamoDB<br/>Products)]
    D3[(DynamoDB<br/>InventoryTransactions)]
  end

  subgraph Alerts[Notifications]
    S[(SNS Topic<br/>Low Stock Alerts)]
    U1[[SMS Subscribers]]
    U2[[Email Subscribers]]
  end

  A -->|Cognito Hosted UI / JWT| C
  A -->|HTTPS (JWT in Authorization header)| G
  G --> L
  L --> D1
  L --> D2
  L --> D3
  L -->|Publish Low Stock| S
  S --> U1
  S --> U2
```

---

## DynamoDB Schema Design

To keep things simple and explicit, we use **three tables**:

### Table 1: `Shops`

- **Partition key**: `shopId` (string, e.g. `"shop-small-001"`)
- **Attributes**:
  - `name` (string)
  - `ownerEmail` (string)
  - `size` (string: `"small" | "medium" | "large"`)
  - `createdAt` (ISO 8601 string)

### Table 2: `Products`

- **Partition key**: `shopId` (string)
- **Sort key**: `productId` (string, UUID or SKU)
- **Attributes**:
  - `name` (string)
  - `sku` (string)
  - `category` (string)
  - `unit` (string, e.g. `"pcs"`, `"kg"`)
  - `reorderThreshold` (number)
  - `currentStock` (number)
  - `createdAt` (ISO 8601 string)
  - `updatedAt` (ISO 8601 string)

**Global Secondary Index (GSI):**

- `GSI1` – for product search:
  - Partition key: `shopId`
  - Sort key: `name`

### Table 3: `InventoryTransactions`

- **Partition key**: `shopId` (string)
- **Sort key**: `transactionId` (string, e.g. `"{timestamp}#{productId}"`)
- **Attributes**:
  - `productId` (string)
  - `type` (string: `"SALE" | "RESTOCK" | "ADJUSTMENT"`)
  - `quantity` (number, positive for restock, negative for sale)
  - `balanceAfter` (number, stock after the transaction)
  - `note` (string, optional)
  - `createdAt` (ISO 8601 string)

This design allows:

- Fast lookups of all products for a given shop.
- Simple product search by name within a shop.
- Efficient retrieval of recent sales history for a shop (and filtering by `productId` in Lambda).

---

## Backend (AWS Lambda + API Gateway + DynamoDB + SNS)

### Endpoints

All endpoints are prefixed by `API_BASE_URL` (API Gateway invoke URL), e.g.:

- `GET /shops/{shopId}/products` – list products for a shop.
- `POST /shops/{shopId}/products` – create a product.
- `PUT /shops/{shopId}/products/{productId}` – update a product.
- `DELETE /shops/{shopId}/products/{productId}` – delete a product.
- `POST /shops/{shopId}/products/{productId}/adjust-stock` – adjust stock (sale or restock).
- `GET /shops/{shopId}/products/{productId}/transactions` – recent sales/stock history.

All routes are handled by a single Lambda `inventoryHandler` that inspects `event.httpMethod` and `event.resource` to route internally.

### Low-Stock SNS Alerts

When stock is adjusted via `adjust-stock`:

1. Lambda loads the product and current stock.
2. It computes the new stock based on the adjustment payload.
3. It writes the updated stock back to DynamoDB and stores an `InventoryTransactions` item.
4. If `newStock <= reorderThreshold`, Lambda publishes a message to the SNS topic:
   - Subject: `"Low stock alert: {productName} ({shopName})"`.
   - Message includes shop, product, SKU, current stock, and threshold.

Subscribers to the SNS topic (configured manually or via CloudFormation) will receive SMS/email.

---

## Frontend (React Dashboard)

The frontend is a **single-page React app** using UMD builds and plain JavaScript, making it easy to host as simple static files on Amplify.

Key features:

- **Login status** bar (Cognito integration stub, ready to connect to hosted UI).
- **Shop selector** (for multi-shop owners).
- **Inventory table**:
  - Product name, SKU, category, current stock, threshold.
  - Low-stock badge when `currentStock <= reorderThreshold`.
  - Filter by category and low-stock, search by name/SKU.
- **Stock actions**:
  - Add product form.
  - Adjust stock (sale / restock) with quantity input.
  - View recent history per product.

The React app uses a small `window.APP_CONFIG` object (or `config.js`) for:

- `API_BASE_URL`
- `COGNITO_USER_POOL_ID`
- `COGNITO_CLIENT_ID`
- `COGNITO_REGION`

You can copy `config.sample.js` to `config.js` and fill in real values after deploying the backend.

---

## Authentication (Cognito) & Hosting (Amplify)

### Cognito

1. **Create a User Pool** (or deploy via the provided CloudFormation in `backend/template.yaml`):
   - Add an app client (no secret, enable hosted UI).
   - Configure allowed callback/logout URLs to your Amplify app domain.
2. **Configure React app**:
   - Set `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, and `COGNITO_REGION` in `config.js`.
   - The frontend contains utility functions to:
     - Redirect to Cognito Hosted UI.
     - Parse the auth code / tokens on redirect.
     - Attach `Authorization: Bearer {idToken}` to API calls.

### Amplify Hosting

1. Push this project to a Git repository (e.g., GitHub).
2. In the AWS Console, open **Amplify Hosting**.
3. Connect your repo and pick the `frontend` folder as the build artifact root (or create a simple build spec that copies `index.html`, `app.js`, `styles.css`, and `config.js`).
4. Configure environment variables as needed for `API_BASE_URL` (or bake them into `config.js`).
5. Deploy – Amplify will give you a public URL you can use in Cognito and for testing.

---

## SNS Alert Demo

To demonstrate low-stock alerts:

1. Deploy the backend stack from `backend/template.yaml` (SAM or CloudFormation).
2. Note the **SNS topic ARN** output from the stack, and subscribe your email/SMS:
   - In the SNS console, create a subscription to the topic.
   - Confirm the subscription via email/SMS.
3. In the React dashboard:
   - Create a product with a small `reorderThreshold` (e.g., `5`).
   - Adjust stock downward until `currentStock` becomes `<= threshold`.
4. Within a short time, you should receive an SNS alert with product and shop info.

Alternatively, invoke the Lambda directly with a test event that simulates `adjust-stock` and confirm the SNS message via CloudWatch Logs and your subscription.

---

## Data Analytics (Optional)

You can extend this system in two common ways:

- **Amazon QuickSight**:
  - Export or mirror `InventoryTransactions` to S3 (e.g., via Kinesis Firehose or scheduled Lambda).
  - Build QuickSight dashboards for:
    - Top-selling products per shop.
    - Stock turnover rates.
    - Days of cover (inventory vs. average daily sales).
- **In-App Charts**:
  - The React app is structured so you can drop in a charting library (e.g., Chart.js, Recharts).
  - Use `/transactions` data to plot:
    - 30-day sales trend per product.
    - Total stock value by category.

---

## Business Case Study: 3 Shop Sizes

### 1. Small Corner Store (Single Shop, ~100 SKUs)

- **Current pain**:
  - Manual notebook or Excel tracking.
  - Frequent stockouts of fast-moving items (bread, milk, snacks).
- **With this system**:
  - Owner logs in, maintains a simple product catalog.
  - Low-stock SMS alerts for the top 20 critical SKUs.
  - Weekly view of sales history for just-in-time reordering.
- **Impact**:
  - Fewer lost sales from stockouts.
  - Owner spends less time counting shelves and more time serving customers.

### 2. Medium Retail Shop (Single Shop, 1,000–3,000 SKUs)

- **Current pain**:
  - Fragmented records between PoS exports and ad-hoc spreadsheets.
  - Hard to see which suppliers or categories are underperforming.
- **With this system**:
  - Product catalog segmented by category (beverages, snacks, household, etc.).
  - Dashboard filters show low-stock items by category.
  - Sales history per product reveals slow movers and overstock risks.
- **Impact**:
  - Better working capital control by reducing dead inventory.
  - Fewer emergency orders and improved supplier negotiations based on real data.

### 3. Multi-Branch Retailer (3–5 Shops, 5,000+ SKUs)

- **Current pain**:
  - No consolidated view of inventory across branches.
  - Difficult to rebalance stock between shops when one is overstocked and another is understocked.
- **With this system**:
  - Each shop is a `shopId`, with separate product and transaction data.
  - Central owner or manager logs into a single dashboard, switches between shops.
  - Low-stock alerts per shop, plus optional analytics to see cross-shop trends.
- **Impact**:
  - Centralized decision-making on transfers and purchasing.
  - More consistent customer experience across branches (fewer “out of stock” surprises).

---

## Step-by-Step Deployment Guide

Follow these steps to deploy and run the entire application from scratch.

### Quick Summary

1. ✅ **Prerequisites**: AWS CLI, SAM CLI, Node.js 18+
2. ✅ **Deploy Backend**: `cd backend && sam build && sam deploy --guided`
3. ✅ **Configure Frontend**: Update `frontend/config.js` with deployment outputs
4. ✅ **Update Cognito URLs**: Set callback/logout URLs in Cognito console
5. ✅ **Setup SNS**: Subscribe email/SMS to the SNS topic
6. ✅ **Run Frontend**: `cd frontend && serve -p 3000 .`
7. ✅ **Test**: Create products, record sales, trigger alerts

**Estimated Time**: 15-20 minutes for first-time deployment

---

### Prerequisites

Before starting, ensure you have:

1. **AWS Account** with appropriate permissions (IAM admin or sufficient permissions for Lambda, API Gateway, DynamoDB, SNS, Cognito, CloudFormation)
2. **AWS CLI** installed and configured:
   ```bash
   aws --version
   aws configure
   # Enter your Access Key ID, Secret Access Key, region (e.g., us-east-1), and output format (json)
   ```
3. **AWS SAM CLI** installed (for deploying the backend):
   ```bash
   # macOS
   brew install aws-sam-cli
   
   # Linux/Windows - see: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
   
   sam --version
   ```
4. **Node.js 18+** installed:
   ```bash
   node --version  # Should be 18.x or higher
   npm --version
   ```

**Quick Verification**: Run the verification script to check your setup:
```bash
./verify-deployment.sh
```

---

### Step 1: Prepare Backend Code

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Verify the structure:
   ```bash
   ls -la
   # Should show: package.json, template.yaml, src/inventoryHandler.js
   ```

---

### Step 2: Deploy Backend Infrastructure (IaC)

1. **Build the SAM application**:
   ```bash
   sam build
   ```
   This will:
   - Install Lambda dependencies
   - Package the code
   - Validate the `template.yaml`

2. **Deploy the stack** (first time - guided mode):
   ```bash
   sam deploy --guided
   ```
   
   You'll be prompted for:
   - **Stack Name**: `cloud-inventory-backend` (or your choice)
   - **AWS Region**: `us-east-1` (or your preferred region)
   - **Parameter CognitoCallbackUrl**: `http://localhost:3000` (for local testing) or your Amplify URL
   - **Parameter CognitoLogoutUrl**: `http://localhost:3000` (for local testing) or your Amplify URL
   - **Confirm changes before deploy**: `Y`
   - **Allow SAM CLI IAM role creation**: `Y`
   - **Disable rollback**: `N`
   - **Save arguments to configuration file**: `Y`
   - **SAM configuration file**: `samconfig.toml`
   - **SAM configuration environment**: `default`

3. **Wait for deployment** (takes ~5-10 minutes):
   - CloudFormation will create:
     - API Gateway REST API
     - Lambda function
     - 3 DynamoDB tables
     - SNS topic
     - Cognito User Pool + App Client

4. **Note the outputs** after deployment completes:
   ```
   Outputs:
   ──────────────────────────────────────────────────────────────────────────
   Key                 InventoryApiUrl
   Description         Base URL for the Inventory API
   Value               https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod
   
   Key                 LowStockTopicArn
   Description         SNS topic ARN for low-stock alerts
   Value               arn:aws:sns:us-east-1:123456789012:cloud-inventory-backend-LowStockTopic-xxxxx
   
   Key                 UserPoolId
   Description         Cognito User Pool ID
   Value               us-east-1_xxxxxxxxx
   
   Key                 UserPoolClientId
   Description         Cognito User Pool App Client ID
   Value               xxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

5. **Save these values** - you'll need them in Step 3!

---

### Step 3: Configure Frontend

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```

2. Copy the sample config file:
   ```bash
   cp config.sample.js config.js
   ```

3. **Edit `config.js`** with your deployment outputs:
   ```javascript
   window.APP_CONFIG = {
     API_BASE_URL: 'https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod',
     COGNITO_USER_POOL_ID: 'us-east-1_xxxxxxxxx',
     COGNITO_CLIENT_ID: 'xxxxxxxxxxxxxxxxxxxxxxxxxx',
     COGNITO_REGION: 'us-east-1'  // Your AWS region
   };
   ```
   
   Replace:
   - `API_BASE_URL` with the `InventoryApiUrl` from Step 2
   - `COGNITO_USER_POOL_ID` with the `UserPoolId` from Step 2
   - `COGNITO_CLIENT_ID` with the `UserPoolClientId` from Step 2
   - `COGNITO_REGION` with your AWS region (e.g., `us-east-1`)

---

### Step 4: Update Cognito Callback URLs (Important!)

After deploying, you need to update Cognito callback URLs:

1. **Get your Cognito User Pool ID** from Step 2 outputs

2. **Update via AWS Console**:
   - Go to **Amazon Cognito** → **User pools** → Select your pool
   - Go to **App integration** → **App client** → Click your app client
   - Under **Hosted UI**, click **Edit**
   - Update **Callback URLs**:
     - For local testing: `http://localhost:3000`
     - For production: Your Amplify URL (e.g., `https://main.xxxxx.amplifyapp.com`)
   - Update **Sign-out URLs**:
     - For local testing: `http://localhost:3000`
     - For production: Your Amplify URL
   - Click **Save changes**

3. **Or update via AWS CLI**:
   ```bash
   aws cognito-idp update-user-pool-client \
     --user-pool-id us-east-1_xxxxxxxxx \
     --client-id xxxxxxxxxxxxxxxxxxxxxxxxxx \
     --callback-urls http://localhost:3000 https://your-amplify-url.amplifyapp.com \
     --logout-urls http://localhost:3000 https://your-amplify-url.amplifyapp.com \
     --region us-east-1
   ```

---

### Step 5: Set Up SNS Alerts (Optional but Recommended)

1. **Get the SNS Topic ARN** from Step 2 outputs (`LowStockTopicArn`)

2. **Subscribe to the topic** (via AWS Console):
   - Go to **Amazon SNS** → **Topics**
   - Find your topic (name contains `LowStockTopic`)
   - Click **Create subscription**
   - **Protocol**: `Email` or `SMS`
   - **Endpoint**: Your email address or phone number
   - Click **Create subscription**
   - **Confirm the subscription**:
     - For email: Check your inbox and click the confirmation link
     - For SMS: Enter the confirmation code sent to your phone

3. **Test the alert** (after Step 6):
   - Create a product with `reorderThreshold: 5`
   - Set `currentStock: 10`
   - Record a sale that reduces stock to `5` or below
   - You should receive an SNS notification!

---

### Step 6: Run the Frontend Locally

1. **Install a simple HTTP server** (if you don't have one):
   ```bash
   npm install -g serve
   # OR use Python's built-in server:
   # python3 -m http.server 3000
   ```

2. **Start the server**:
   ```bash
   # Using serve
   serve -p 3000 .
   
   # OR using Python
   python3 -m http.server 3000
   
   # OR using Node.js http-server
   npx http-server -p 3000
   ```

3. **Open your browser**:
   ```
   http://localhost:3000
   ```

4. **You should see**:
   - The Cloud Inventory dashboard
   - "API: connected" badge (if config.js is correct)
   - Empty inventory table (no products yet)

---

### Step 7: Test the API (Optional - Using curl)

Before testing the frontend, you can verify the backend API works:

1. **Get your API URL** from Step 2 outputs

2. **Create a test product**:
   ```bash
   curl -X POST "https://6afugtzb15.execute-api.us-east-1.amazonaws.com/prod/shops/demo-shop-001/products" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Product",
       "sku": "TEST-001",
       "category": "Test",
       "unit": "pcs",
       "reorderThreshold": 5,
       "currentStock": 10
     }'
   ```

3. **List products**:
   ```bash
   curl "https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/prod/shops/demo-shop-001/products"
   ```

4. **Adjust stock** (this will trigger SNS if stock goes below threshold):
   ```bash
   curl -X POST "https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/prod/shops/demo-shop-001/products/PRODUCT-ID/adjust-stock" \
     -H "Content-Type: application/json" \
     -d '{
       "quantity": -6,
       "note": "Test sale"
     }'
   ```

---

### Step 8: Test the Application (Frontend)

1. **Create a test product**:
   - Fill in the "New product" form on the right:
     - Name: `Whole Wheat Bread`
     - SKU: `WWB-001`
     - Category: `Bakery`
     - Unit: `pcs`
     - Reorder threshold: `5`
     - Starting stock: `10`
   - Click **Save product**
   - The product should appear in the inventory table

2. **Record a sale**:
   - Click **Record sale** on the product
   - Enter quantity: `-3` (negative for sale)
   - Note: `Customer purchase`
   - Click **Record movement**
   - Stock should update to `7`

3. **Test low-stock alert**:
   - Record another sale: `-3` (stock becomes `4`)
   - Since `4 <= 5` (threshold), an SNS alert should fire
   - Check your email/SMS for the alert!

4. **View transaction history**:
   - Click **History** on any product
   - You should see all sales/restocks in the "Stock activity" panel

5. **Test search and filters**:
   - Use the search box to filter by name/SKU
   - Use category dropdown to filter by category
   - Toggle "Low stock" to see only items below threshold

---

### Step 9: Deploy Frontend to AWS Amplify (Production)

1. **Push your code to GitHub** (or GitLab/Bitbucket):
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Cloud Inventory Management System"
   git remote add origin https://github.com/yourusername/cloud-inventory.git
   git push -u origin main
   ```

2. **Create Amplify App**:
   - Go to **AWS Amplify Console**
   - Click **New app** → **Host web app**
   - Connect your Git repository
   - **Build settings**: Amplify will auto-detect (or use default)
   - **App root directory**: `frontend`
   - Click **Save and deploy**

3. **Wait for deployment** (~2-3 minutes)

4. **Update Cognito callback URLs** (Step 4) with your Amplify URL

5. **Update `config.js`** with production API URL (if different from local)

6. **Access your live app** at the Amplify URL!

---

### Troubleshooting

#### Backend Issues

- **`sam build` fails**: Ensure Node.js 18+ is installed and `package.json` is valid
- **`sam deploy` fails**: Check AWS credentials (`aws sts get-caller-identity`)
- **Lambda errors**: Check CloudWatch Logs for the function
- **API Gateway 403**: Verify CORS settings in `template.yaml`

#### Frontend Issues

- **"API: configure config.js"**: Check that `config.js` exists and has correct `API_BASE_URL`
- **CORS errors**: Ensure API Gateway CORS is enabled (already in template.yaml)
- **401 Unauthorized**: Cognito token not attached (auth button needs implementation)
- **Products not loading**: Check browser console for API errors, verify API URL

#### SNS Issues

- **No alerts received**: 
  - Verify subscription is confirmed (check email/SMS)
  - Check CloudWatch Logs for Lambda errors
  - Verify `LOW_STOCK_TOPIC_ARN` environment variable in Lambda

---

### Quick Reference: Important Commands

```bash
# Backend deployment
cd backend
sam build
sam deploy

# View stack outputs
aws cloudformation describe-stacks --stack-name cloud-inventory-backend --query 'Stacks[0].Outputs'

# Frontend local testing
cd frontend
serve -p 3000 .

# Check Lambda logs
aws logs tail /aws/lambda/InventoryHandler --follow

# List DynamoDB tables
aws dynamodb list-tables
```

---

### Next Steps

- **Implement Cognito authentication** in the frontend (hook up the "Auth" button)
- **Add more shops** by creating entries in the `Shops` DynamoDB table
- **Set up QuickSight** for analytics (see README Analytics section)
- **Configure custom domain** for Amplify
- **Set up CI/CD** for automatic deployments

You now have a **fully functional cloud-based inventory management system** running on AWS!

