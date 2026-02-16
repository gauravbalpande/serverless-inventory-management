# CI/CD for Cloud Inventory

## Option A: Amplify Hosting (frontend) – automatic on push

1. Connect your Git repo to Amplify: **Amplify Console → New app → Host web app**.
2. Set **Root directory** to `frontend` (or use the build spec below).
3. Add env vars in Amplify: `API_BASE_URL`, `COGNITO_*` (or bake into `config.js` at build time).
4. Every push to the connected branch triggers a build and deploy.

### Build spec (optional)

If you put this as `amplify.yml` in the **repo root** and set "Root" to the repo root, Amplify will use it. Otherwise set "Root" to `frontend` and use "No build" (static only).

```yaml
version: 1
frontend:
  phases:
    build:
      commands: []
  artifacts:
    baseDirectory: frontend
    files:
      - '**/*'
  cache:
    paths: []
```

For build-time config injection (env → config.js), add in `build.commands`:

```yaml
  phases:
    build:
      commands:
        - cp frontend/config.sample.js frontend/config.js
        - sed -i "s|API_BASE_URL.*|API_BASE_URL: '$API_BASE_URL',|" frontend/config.js
        # repeat for COGNITO_* if you set them in Amplify env
```

---

## Option B: GitHub Actions – backend (SAM) deploy

Use this to deploy the **backend** (Lambda, API Gateway, DynamoDB, etc.) on push or on demand.

1. In GitHub: **Settings → Secrets and variables → Actions**.
2. Add: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and optionally `AWS_REGION`.
3. Commit the workflow below.

See: `.github/workflows/deploy-backend.yml` (created in repo).

---

## Option C: Full CI (frontend + backend)

- **Frontend**: Amplify (Option A) – deploys on every push to `main`.
- **Backend**: GitHub Actions (Option B) – deploy SAM on push to `main` or when `backend/**` changes.

After backend deploy, copy the new API URL from stack outputs and update Amplify env var `API_BASE_URL` (or run a small script that updates it via Amplify API).
