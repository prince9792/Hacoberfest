# Tool Doctor

Tool Doctor is a repository monitoring dashboard backed by a Flask GraphQL API and PostgreSQL. It includes clearly labeled sample repositories and read-only checks for public GitHub repositories.

Connect your GitHub account, then choose one of its public repositories from the Integrations page—there is no need to paste a repository URL. Tool Doctor stores timestamped evidence for repository availability, README presence, the latest GitHub Actions run, and the latest release when available. Failed checks create findings; a later passing check resolves them. Findings can also be managed in the dashboard, and imported repositories can be manually rechecked or removed from the workspace.

The background monitor rechecks imported repositories every 24 hours by default. Set `MONITOR_INTERVAL_SECONDS` to change the interval (minimum one hour, in whole-minute increments). The checks only read public GitHub metadata; they do not clone or execute source code, access private repositories, modify GitHub, or provide a complete health/security assessment.

## Run the full stack

Docker Compose starts the web app, Flask API, PostgreSQL, Redis, and the scheduled monitor:

```powershell
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). The GraphQL endpoint is [http://localhost:5000/graphql](http://localhost:5000/graphql), and `/healthz` reports PostgreSQL and Redis availability. The initial database setup inserts clearly labeled sample repositories for the landing-page preview.

The home page is a responsive, video-backed introduction; use **Explore your workspace** to open the dashboard. Register with a name, email, mobile number, and password. You can also sign in with a one-time code or configured GitHub/GitLab OAuth app.

## Authentication setup

Authentication is enabled by default and protects the workspace API. For Compose, copy `.env.example` to `.env` and set a unique `AUTH_SECRET` (at least 32 characters). For example, in PowerShell:

```powershell
Copy-Item .env.example .env
```

Replace the `AUTH_SECRET` placeholder in `.env` with a unique random value of at least 32 characters before running `docker compose up --build`. For cross-site web/API deployments, set `AUTH_COOKIE_SAMESITE=None` and `AUTH_COOKIE_SECURE=true` (HTTPS is required). To enable GitLab token encryption, generate a Fernet key after installing API requirements, then put it in `AUTH_ENCRYPTION_KEY`:

```powershell
uv run --python .venv\Scripts\python.exe -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

One-time email codes require `SMTP_HOST` and `SMTP_FROM`; authenticated SMTP can be configured with `SMTP_USERNAME` and `SMTP_PASSWORD`. Phone codes require a Twilio account SID, auth token, and sending number. Delivery providers are optional until the user selects their channel.

### Administrator account

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` to bootstrap the administrator during database initialization. Use a unique password with at least 12 characters; do not commit `.env` or share the password. Optional `ADMIN_NAME` and `ADMIN_MOBILE` set the profile details. The administrator signs in at `/login` like other users and is redirected to `/admin`, where registered account profiles and roles are visible. The bootstrap credentials are applied when the API's `init-db` command runs; changing `ADMIN_PASSWORD` and restarting/reinitializing updates that account's password. Public registration always creates a standard user and cannot assign admin rights.

### Developer accounts

Registration at `/register` collects full name, email, mobile number in international format (for example `+14155550123`), and a password of at least 12 characters. Organization and job title are optional. Passwords are stored as salted password hashes, never plaintext. Email/password login is at `/login`; OTP and OAuth login remain available.

For OAuth, create GitHub and/or GitLab OAuth applications and set the corresponding client ID and secret in `.env`. Configure their callback URLs as:

- `http://localhost:5000/auth/oauth/github/callback`
- `http://localhost:5000/auth/oauth/gitlab/callback`

Set `PUBLIC_API_URL` to the public API origin and `WEB_ORIGIN` to the web app origin when deployed. Set `AUTH_COOKIE_SECURE=true` behind HTTPS. GitHub OAuth requests identity-only scopes; after linking, Tool Doctor lists the account's public owned repositories using the public GitHub API. Private GitHub repositories are neither listed nor accessed. GitLab uses read-only OAuth scopes and can be linked to a Tool Doctor account; GitLab repository monitoring is not implemented yet.

Email/phone one-time codes remain available as an alternative login. First-time OTP sign-in creates an account using the verified email or phone channel.

## Run the web app locally

Requires Node.js 20 or later:

```powershell
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_URL` to the Flask GraphQL endpoint if it differs from `http://localhost:5000/graphql`. Without a running API, sign-in and dashboard requests display an explicit connection error.

## Run the API locally

Requires Python 3.12+, uv, Docker Desktop, PostgreSQL, and Redis. Start the database services and then run the API commands in PowerShell:

```powershell
docker compose up -d postgres redis
$env:DATABASE_URL = "postgresql+psycopg://tooldoctor:tooldoctor@127.0.0.1:15432/tooldoctor"
$env:REDIS_URL = "redis://localhost:6379/0"
$env:WEB_ORIGIN = "http://localhost:3000"
uv venv --python 3.12
uv pip install --python .venv\Scripts\python.exe -r apps/api/requirements.txt
uv run --python .venv\Scripts\python.exe flask --app apps.api.app init-db
uv run --python .venv\Scripts\python.exe flask --app apps.api.app run --port 5000
```

Before starting the local API, also set `AUTH_SECRET`, `WEB_ORIGIN`, and any SMTP, Twilio, or OAuth values you want to use. `AUTH_REQUIRED=false` is available only for local development and tests; do not use it for a shared or deployed service.

For scheduled checks during local development, run the monitor in a second PowerShell terminal with the same environment variables:

```powershell
uv run --python .venv\Scripts\python.exe apps\api\monitor.py
```

## GraphQL

The GraphQL API exposes `tools`, `tool(id: ID!)`, `findings`, and `monitorIntervalSeconds`. Mutations include `importPublicRepository(fullName: String!)`, `recheckPublicRepository(id: ID!)`, `setFindingStatus(id: ID!, status: String!)`, and `removePublicRepository(id: ID!)`. Rechecking saves a new check-run record and updates finding lifecycle state. Sample records cannot be removed through the dashboard.

Seeded repository records and their health scores are illustrative, shared, read-only sample data, not live assessments. Imported repositories and findings are scoped to the signed-in account. GitHub import reads public metadata only; checks do not clone or execute source code. GitHub webhooks, GitLab repository monitoring, Wikimedia, Codeberg, Bitbucket, Gitea/Forgejo adapters, audit history, and approval-gated external actions are not implemented. Redis is currently used for dependency health reporting.
