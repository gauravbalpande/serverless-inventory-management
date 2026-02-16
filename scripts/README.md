# Scripts

## 1. Add shops (DynamoDB)

Adds shop records to the `Shops` table so they appear in the frontend dropdown.

**Prereqs:** AWS CLI configured; backend stack deployed (so the table exists).

```bash
# Use default 3 demo shops
STACK_NAME=cloud-inventory-backend node scripts/add-shops.js

# Use custom JSON (array of { shopId, name, ownerEmail?, size? })
STACK_NAME=cloud-inventory-backend node scripts/add-shops.js scripts/shops.json
```

Optional env: `AWS_REGION` (default `us-east-1`), `STACK_NAME` (default `cloud-inventory-backend`).

---

## 2. QuickSight analytics

Creates an S3 bucket, exports the `Transactions` DynamoDB table to CSV there, and prints manual steps to create a QuickSight dataset.

**Prereqs:** AWS CLI, Node.js, backend stack deployed.

```bash
STACK_NAME=cloud-inventory-backend ./scripts/setup-quicksight.sh
```

Then in AWS Console: QuickSight → New dataset → S3 → choose the bucket and `transactions/` prefix.

---

## 3. Amplify custom domain

Associates a custom domain with an existing Amplify app and prints DNS instructions.

**Prereqs:** Amplify app already created; domain you control.

```bash
AMPLIFY_APP_ID=your-app-id DOMAIN=inventory.example.com ./scripts/amplify-custom-domain.sh
```

Optional: `AMPLIFY_BRANCH=main`, `AWS_REGION=us-east-1`.

---

## 4. CI/CD

- **Frontend:** Connect the repo to **AWS Amplify** and set the app root to `frontend` (or repo root and use `amplify.yml`). Pushes to the connected branch auto-deploy.
- **Backend:** Use **GitHub Actions** – see [ci-cd-README.md](./ci-cd-README.md). Add `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in GitHub repo secrets, then push to `main` (with changes under `backend/`) to deploy.

See **scripts/ci-cd-README.md** for full CI/CD options and the **.github/workflows/deploy-backend.yml** workflow.
