# Tool Doctor — React Application

Tool Doctor is a repository health monitoring dashboard built as a fast, responsive React single-page application powered by Vite, TypeScript, and Tailwind CSS.

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
- **Configurable Monitor Polling**:
  - Background evaluation cycle settings (1h, 6h, 12h, 24h).
  - Diagnostic health indicators for persistent store, cache, and polling workers.

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Bundler**: Vite 6
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Audio**: Web Audio API ambient chord synthesizer
- **Storage**: Browser-backed persistent workspace store with GitHub Public API adapter

## Getting Started

```bash
npm install
npm run dev
```

The application starts on [http://localhost:3000](http://localhost:3000).
