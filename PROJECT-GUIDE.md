# Cloud Inventory – Complete Step-by-Step Project Guide

Use this **single file** to run and finish the project from start to finish. Follow the steps in order; later steps assume earlier ones are done.

---

## Before You Start

- **AWS account** with permissions for Lambda, API Gateway, DynamoDB, SNS, Cognito, CloudFormation, Amplify, S3.
- **On your machine:** AWS CLI, AWS SAM CLI, Node.js 18+, and (optional) Git.

---

# Phase 1: Get the app running

## Step 1 – Prerequisites

1. **Configure AWS CLI**
   ```bash
   aws configure
   ```
   Enter Access Key ID, Secret Access Key, region (e.g. `us-east-1`), output `json`.

2. **Check SAM CLI**
   ```bash
   sam --version
   ```
   If missing: [Install SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) (e.g. `brew install aws-sam-cli` on macOS).

3. **Check Node.js**
   ```bash
   node --version   # 18 or higher
   ```

---

## Step 2 – Deploy the backend

1. Go to the backend folder and install dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Build and deploy (first time use guided):
   ```bash
   sam build
   sam deploy --guided
   ```

3. When prompted, use:
   - **Stack name:** `cloud-inventory-backend` (or your choice)
   - **Region:** e.g. `us-east-1`
   - **CognitoCallbackUrl:** `http://localhost:3000` (for local testing)
   - **CognitoLogoutUrl:** `http://localhost:3000`
   - **Allow SAM CLI IAM role creation:** `Y`
   - **Save arguments to config:** `Y`

4. Wait for the stack to finish (~5–10 min). Then **copy these outputs** (you need them in the next step):
   - **ApiUrl** (or InventoryApiUrl) → your API base URL
   - **UserPoolId** → Cognito User Pool ID
   - **UserPoolClientId** → Cognito App Client ID
   - **LowStockTopicArn** → SNS topic ARN (for alerts later)

---

## Step 3 – Configure the frontend

1. From the project root:
   ```bash
   cd frontend
   cp config.sample.js config.js
   ```

2. Edit **`frontend/config.js`** and set:
   - `API_BASE_URL` = the **ApiUrl** from Step 2 (e.g. `https://xxxx.execute-api.us-east-1.amazonaws.com/prod`)
   - `COGNITO_USER_POOL_ID` = **UserPoolId** from Step 2
   - `COGNITO_CLIENT_ID` = **UserPoolClientId** from Step 2
   - `COGNITO_REGION` = your AWS region (e.g. `us-east-1`)
   - **`COGNITO_DOMAIN`** = the **CognitoDomain** output from Step 2 (e.g. `cloud-inventory-app.auth.us-east-1.amazoncognito.com`).  
     Without this, the Login button shows “Login pages unavailable”. You can use **CognitoDomain** from the stack outputs, or set `COGNITO_DOMAIN_PREFIX` (e.g. `cloud-inventory-app`) and we build the domain from the region.

3. Save the file.

---

## Step 4 – Set Cognito callback URLs

So login/logout redirects work:

1. Open **AWS Console → Cognito → User pools** → your pool.
2. **App integration** → your **App client** → **Edit** under Hosted UI.
3. **Callback URL(s):** add `http://localhost:3000` (and later your Amplify URL if you use it).
4. **Sign-out URL(s):** add `http://localhost:3000` (and Amplify URL if needed).
5. Save.

---

## Step 5 – Add shops to DynamoDB

The dashboard shop dropdown is filled from the **Shops** table. Add at least one shop:

```bash
# From project root
STACK_NAME=cloud-inventory-backend node scripts/add-shops.js
```

Use your stack name if it’s different. To use your own list, edit `scripts/shops.json` and run:

```bash
STACK_NAME=cloud-inventory-backend node scripts/add-shops.js scripts/shops.json
```

---

## Step 6 – Run the frontend locally

1. From the **frontend** folder:
   ```bash
   cd frontend
   npx serve -p 3000 .
   ```
   (Or: `python3 -m http.server 3000`.)

2. Open **http://localhost:3000** in the browser.

3. You should see:
   - “API: connected”
   - Shop dropdown with the shops you added
   - Ability to add products, adjust stock, see history

4. **Quick test:** Create a product (e.g. name, category, threshold 5, stock 10), then “Record sale” with quantity -6; stock goes to 4 and a low-stock alert can fire (see Step 7).

---

## Step 7 – SNS low-stock alerts (optional)

1. In **AWS Console → SNS → Topics**, open the topic whose ARN you saved (e.g. `...LowStockTopic...`).
2. **Create subscription**
   - Protocol: **Email** (or SMS)
   - Endpoint: your email (or phone)
3. **Confirm** the subscription (email link or SMS code).
4. In the app, create a product with a low **reorder threshold** and reduce stock below that value; you should get an email/SMS when the Lambda publishes to SNS.

---

## Step 8 – Cognito login (already wired)

The app already has Cognito Hosted UI:

- **Login:** Click **Login** in the top bar → redirects to Cognito → sign in (create a user in Cognito if needed: User pools → Users → Create user).
- **After login:** The top bar shows your email and a **Logout** button; API requests send the JWT in the `Authorization` header.

No code change needed; just ensure **Step 3** and **Step 4** are done.

---

# Phase 2: Production and extras

## Step 9 – Deploy frontend to AWS Amplify

1. Push the project to **GitHub** (or GitLab/Bitbucket).

2. In **AWS Console → Amplify → New app → Host web app**, connect the repo.

3. **Build settings:**
   - If Amplify asks for a build spec: set **Root** to `frontend` and use “No build” (static only), **or** use the repo root and keep **amplify.yml** in the repo (it publishes the `frontend` folder).

4. Add **environment variables** in Amplify (if you inject config at build time):
   - `API_BASE_URL`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_REGION`

5. Deploy. Amplify will give you a URL (e.g. `https://main.xxxxx.amplifyapp.com`).

6. **Important:** In Cognito (Step 4), add this Amplify URL to **Callback URLs** and **Sign-out URLs** so login works in production.

---

## Step 10 – QuickSight analytics (optional)

1. From project root, run:
   ```bash
   STACK_NAME=cloud-inventory-backend ./scripts/setup-quicksight.sh
   ```
   This creates an S3 bucket and exports the **Transactions** table to CSV there.

2. In **AWS Console → QuickSight**:
   - **New dataset** → **S3** → choose the bucket and the `transactions/` prefix.
   - Create an analysis (e.g. quantity by type, by shop, over time).

---

## Step 11 – Custom domain for Amplify (optional)

1. Get your **Amplify App ID** (Amplify console → App settings → General).

2. Run (use your domain):
   ```bash
   AMPLIFY_APP_ID=your-app-id DOMAIN=inventory.yourdomain.com ./scripts/amplify-custom-domain.sh
   ```

3. In your DNS (e.g. Route 53), add the CNAME or alias record that Amplify shows in **Domain management**. Wait for SSL to be issued.

---

## Step 12 – CI/CD (optional)

**Frontend (Amplify):**  
Once the repo is connected (Step 9), each push to the connected branch triggers a new deploy. No extra config required.

**Backend (GitHub Actions):**

1. In GitHub: **Settings → Secrets and variables → Actions** → add:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

2. The workflow **`.github/workflows/deploy-backend.yml`** runs on push to `main` when `backend/` (or the workflow file) changes. It runs `sam build` and `sam deploy`.

3. Optional: In GitHub **Variables**, set `COGNITO_CALLBACK_URL` and `COGNITO_LOGOUT_URL` to your Amplify URL so each backend deploy uses the correct Cognito URLs.

---

# Quick reference

| Goal                    | What to do |
|-------------------------|------------|
| Run backend             | `cd backend && npm install && sam build && sam deploy --guided` |
| Run frontend locally    | Set `frontend/config.js` → `cd frontend && npx serve -p 3000 .` → open http://localhost:3000 |
| Add shops               | `STACK_NAME=cloud-inventory-backend node scripts/add-shops.js` |
| SNS alerts              | Subscribe email/SMS to the LowStockTopic in SNS console |
| Deploy frontend         | Connect repo to Amplify, set root to `frontend` (or use amplify.yml) |
| QuickSight              | `STACK_NAME=cloud-inventory-backend ./scripts/setup-quicksight.sh` then create dataset from S3 |
| Custom domain           | `AMPLIFY_APP_ID=... DOMAIN=... ./scripts/amplify-custom-domain.sh` then set DNS |
| Backend CI/CD           | Add AWS secrets in GitHub; push to `main` with `backend/` changes |

---

# Troubleshooting

- **“Missing Authentication Token”** from API → You’re calling the wrong path. Use `/shops/{shopId}/products` (e.g. `/shops/demo-shop-001/products`), not just `/prod`.
- **“Internal server error”** / **“Cannot find module 'aws-sdk'”** → Backend needs `aws-sdk` in `backend/package.json` and a redeploy: `cd backend && npm install && sam build && sam deploy`.
- **“Failed to fetch”** in browser → Serve the app from a server (e.g. `npx serve -p 3000 .`), not by opening the HTML file directly; and ensure `config.js` has the correct `API_BASE_URL`.
- **“Login pages unavailable. Please contact an administrator.”** → The Cognito User Pool has no Hosted UI domain. (1) Redeploy the backend so the template creates the domain (it now includes `CognitoUserPoolDomain`). (2) In `config.js` set **COGNITO_DOMAIN** to the stack output **CognitoDomain** (e.g. `cloud-inventory-app.auth.us-east-1.amazoncognito.com`). If the default prefix is taken, deploy with `CognitoDomainPrefix=your-unique-prefix`.
- **Login redirect fails** → Check Cognito callback and sign-out URLs (Step 4) and that they match the URL in the browser (e.g. `http://localhost:3000` or your Amplify URL).
- **Shop dropdown empty** → Run the add-shops script (Step 5) and ensure the backend has the **GET /shops** route deployed.

---

You can do the rest of the project by following this guide from **Step 1** through **Step 12** in order. For more detail on scripts, see **scripts/README.md**; for architecture and schema, see **README.md**.
