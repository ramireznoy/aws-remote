# Remote Control — AWS CodePipeline Manager

## What This Is

A web UI for managing AWS CodePipeline deployments across shared UAT environments (uat1–uat5). Developers pick an environment, enter a branch, select repos, and deploy everything with one click — then monitor progress in real time. Sends Microsoft Teams notifications on deploy start.

## Tech Stack

- **Frontend**: React 18 + Tabler UI (v1.0.0-beta20) + Tabler Icons via CDN. Babel standalone for JSX — no bundler, no build step.
- **Backend**: Node.js + Express. AWS SDK v3 (`@aws-sdk/client-codepipeline`, `@aws-sdk/credential-providers`).
- **Real-time**: Socket.IO for WebSocket-based pipeline status updates (replaces HTTP polling).
- **Auth**: Local AWS CLI profiles / SSO sessions (fromIni). No credentials stored in the app.
- **Notifications**: Microsoft Teams Workflow webhooks with Adaptive Cards (FactSet format). Browser notifications for pipeline state changes.

## Project Structure

```
remote-control/
├── package.json
├── server.js                  # Minimal Express entry point (32 lines)
├── config.json                # User-editable: environments, repos, pipeline patterns, AWS config
├── CLAUDE.md
├── lib/                       # Backend modules (organized, testable)
│   ├── config/
│   │   └── config.js          # loadConfig, saveConfig, getClient (AWS client factory)
│   ├── services/
│   │   ├── aws-pipeline.js    # AWS CodePipeline operations (getPipelineStatuses, updateBranch, trigger, stop)
│   │   ├── developer.js       # detectDeveloper (git user.name / OS username)
│   │   └── teams.js           # buildNotifyText, notifyTeams (MS Teams Adaptive Cards)
│   ├── routes/
│   │   ├── index.js           # registerRoutes (imports all route modules)
│   │   ├── config.js          # GET/PUT /api/config, GET /api/profiles
│   │   ├── developer.js       # GET /api/developer
│   │   ├── credentials.js     # GET /api/validate-credentials
│   │   ├── pipelines.js       # GET /api/pipelines/:env, GET /api/status
│   │   ├── deploy.js          # POST /api/deploy, POST /api/notify-message
│   │   └── actions.js         # POST /api/trigger, POST /api/stop
│   └── websocket/
│       └── pipeline-monitor.js # initializeWebSocket, subscription tracking, polling (5s interval)
└── public/
    ├── index.html             # Entry point, all CDN imports (React, Tabler, Socket.IO)
    ├── css/styles.css         # Custom styles (only what Tabler doesn't provide)
    └── js/
        ├── app.js             # Root component: routing, navbar, theme toggle, credential validation
        ├── components/
        │   └── components.js  # Reusable UI: Toast, Modal, StatusBadge, StageIndicator, PageHeader, etc.
        ├── hooks/
        │   └── use-deploy.js  # Deploy state hook: branches, overrides, WebSocket subscriptions
        ├── pages/
        │   ├── deploy.js      # Single-env deploy UI: branch input, repo checklist, pipeline status cards
        │   ├── multi-env-deploy.js # Multi-env deploy UI: deploy same branch to multiple environments
        │   └── settings.js    # Settings: AWS config, Teams webhook, repo/pipeline pattern management
        └── utils/
            ├── api.js         # Fetch helper (plain JS, no JSX)
            ├── websocket.js   # WebSocket client wrapper for Socket.IO (event bus pattern)
            └── helpers.js     # timeAgo, execColorMap (status → Tabler colors)
```

## Key Patterns & Conventions

- **Follow the RBAC editor** at `../gfs-saas-core/resources/rbac/editor/` for UI patterns (navbar structure, routing, CSS, icon sizing).
- **Tabler-first CSS**: Only add custom styles when Tabler genuinely doesn't provide what's needed. Never override Tabler defaults for sizing, spacing, or typography.
- **Icon sizing** (3 tiers from RBAC editor): `.ti` default 1.1rem, `.icon-nav` 1.25rem, `.icon-hero` 3rem.
- **Navbar** matches RBAC editor exactly: `navbar-toggler`, `navbar-brand-autodark`, `collapse navbar-collapse` with id, `nav-link-icon`/`nav-link-title`.
- **Routing**: pushState-based (no React Router). `parseRoute()` in app.js, `popstate` listener. Three routes: `/deploy`, `/multi-env`, `/settings`.
- **Three-page design**: Deploy (single environment), Multi-Env (deploy to multiple environments), Settings (AWS config, repos, webhooks).
- **Config `{env}` placeholder**: Pipeline names in config.json use `{env}` which gets replaced at runtime (e.g., `{env}-user-service` → `uat1-user-service`).
- **Input sizing**: All form controls use default Tabler size (no `form-control-sm` or `form-select-sm`).
- **Developer name**: Auto-detected from `git config user.name` / OS username. Not stored in config.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config` | Return config.json |
| PUT | `/api/config` | Update config.json |
| GET | `/api/profiles` | List AWS CLI profiles |
| GET | `/api/validate-credentials` | Validate AWS credentials for current profile |
| GET | `/api/developer` | Auto-detected developer name |
| POST | `/api/deploy` | Update pipeline source branches + trigger + notify Teams |
| POST | `/api/trigger` | Trigger (re-run) a single pipeline without changing branch |
| POST | `/api/stop` | Stop a running pipeline execution |
| GET | `/api/status` | Get pipeline execution status (fallback for WebSocket initial load) |

## WebSocket Events

Real-time pipeline status updates via Socket.IO (replaces HTTP polling):

| Event | Direction | Description |
|-------|-----------|-------------|
| `pipeline:subscribe` | Client → Server | Subscribe to status updates for specific pipelines. Server sends initial status immediately. |
| `pipeline:unsubscribe` | Client → Server | Unsubscribe from pipeline status updates |
| `pipeline:status` | Server → Client | Pipeline status update (sent on subscribe and every 5 seconds for subscribed pipelines) |
| `connect` | Server → Client | WebSocket connected (triggers re-subscription to pipelines) |
| `disconnect` | Server → Client | WebSocket disconnected |

**How it works:**
1. Frontend subscribes to pipelines when user selects repos (via `WebSocketClient.subscribePipelines()`)
2. Server joins socket to room `pipeline:{name}` and sends initial status immediately
3. Server polls AWS CodePipeline every 5 seconds and broadcasts updates to subscribed rooms
4. Frontend handles updates via `handleStatusUpdate()` — merges new statuses, triggers browser notifications
5. On reconnect, frontend automatically re-subscribes to all active pipelines
6. Optimistic UI updates for trigger/stop actions (shows immediate feedback, confirms with real status after 2s)

**Pipeline Status States:**
- **Succeeded**: All stages completed successfully
- **Failed**: At least one stage failed
- **InProgress**: At least one stage is running (or Stopping)
- **Stopped**: User manually stopped the pipeline
- **Canceled**: Execution was canceled or superseded by newer execution
- **Idle**: Pipeline has never been run or all stages are idle
- **Error**: Failed to fetch pipeline status from AWS
- **Unknown**: Mixed states that don't match expected patterns (rare)

**Browser Notifications:**
- Automatically requests notification permission on page load
- Sends desktop notifications when pipelines transition to Succeeded or Failed
- Toast notifications when all monitored pipelines complete (success/failure summary)

## Running

```bash
npm install
npm start        # node server.js on port 9001
npm run dev      # node --watch server.js (auto-restart on file changes)
```

Open [http://localhost:9001](http://localhost:9001) in your browser.
