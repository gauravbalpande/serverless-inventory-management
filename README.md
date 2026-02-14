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



