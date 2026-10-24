# Tool Doctor

Tool Doctor is a repository health monitoring dashboard built with a React single-page application and a Flask API scaffold.

## Features

- **Responsive Landing Page**: Video-backed introduction, harmonic ambient synthesizer using Web Audio API, responsive navigation, and direct workspace access.
- **Signal Center & Overview**: Aggregated health scores, live check run stream, repository overview cards, and key health indicators.
- **Repository Management**:
  - Filter repositories by health status (`healthy`, `attention`, `critical`) and provider (`sample`, `github`).
  - Search by name, owner, or repository slug.
  - Signal check runs for repository availability, README presence, GitHub Actions CI execution, and latest release cadence.
  - Manual on-demand recheck with live evaluation against public GitHub APIs.
  - Inspection drawer displaying complete check history and raw evidence logs.
  - Removal of imported repositories (with protection for sample repositories).
- **Findings Lifecycle Management**:
  - Track open and resolved findings.
  - Filter by status and severity (`critical`, `high`, `medium`, `low`).
  - View observed evidence and toggle resolution status.
- **Integrations**:
  - GitHub integration: Import any public repository via `owner/repo` with real-time metadata evaluation.
  - Quick-import suggestions for popular open-source packages.
  - GitLab OAuth identity connection status and roadmap overview.
- **Administrator Console**:
  - User and identity overview.
  - Role toggling between Administrator and Developer.
  - Workspace telemetry and monitor status.
- **Authentication**:
  - Developer registration and sign-in.
  - One-time verification code (OTP) support for email and mobile.
  - Quick demo sign-in shortcuts for testing developer and admin roles.
- **About page**: Project purpose, current capabilities, and implementation status.
- **Configurable Monitor Polling**:
  - Background evaluation cycle settings (1h, 6h, 12h, 24h).
  - Diagnostic health indicators for persistent store, cache, and polling workers.

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Bundler**: Vite 6
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Audio**: Web Audio API ambient chord synthesizer
- **Backend**: Flask application factory and versioned API foundation
- **Storage**: The current dashboard uses browser-backed storage; persistent server-side storage is not configured yet.

The Flask backend currently provides a health endpoint and a provider-adapter contract. Existing dashboard features are not yet connected to the backend.

## Getting Started

Create your local environment file from the safe template:

```powershell
Copy-Item .env.example .env
```

Edit `.env` with your local service settings. Generate new `AUTH_SECRET` and
`AUTH_ENCRYPTION_KEY` values before using authentication or storing credentials.
Do not commit `.env` or use credentials that have been shared in chat.

Start the Flask API in one terminal:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment, then install and run the API:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m flask --app app:create_app run --debug --port 5000
```

On macOS or Linux, activate with `source .venv/bin/activate`.

Start the React frontend in another terminal from the repository root:

```bash
npm install
npm run dev
```

The frontend starts on [http://localhost:3000](http://localhost:3000). The Flask API is available at `http://localhost:5000/api/health`; Vite proxies frontend `/api` requests to it during development.

The frontend includes `/login`, `/register`, and `/about` routes. Authentication is currently a browser-side demo and is not connected to Flask; do not enter real credentials.

### Provider and service configuration

Flask loads the `.env` settings when started through the Flask CLI. These settings
are parsed into application configuration; PostgreSQL, Redis, SMTP, Twilio, GitLab,
OAuth, and admin bootstrap services are not connected yet. GitHub OAuth credentials
are not the same as a GitHub API token.

The Flask API can fetch public GitHub repository metadata at
`GET /api/providers/github/repositories/<owner>/<repository>`. Set
`GITHUB_API_TOKEN` to an optional fine-grained token to raise GitHub API limits.
The endpoint does not perform OAuth or persist imported repositories.
