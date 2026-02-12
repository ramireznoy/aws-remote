# Remote Control — AWS Pipeline Deployment Manager

A web-based control panel for managing AWS CodePipeline deployments across shared UAT environments. Deploy branches, monitor pipeline status in real-time, and get instant notifications — all from one simple interface.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 📋 What Is This?

Remote Control is a local web application that helps developers:
- **Deploy code** to UAT environments (uat1, uat2, uat3, etc.) with one click
- **Monitor pipeline status** in real-time via WebSocket updates
- **Manage multiple repos** simultaneously across different environments
- **Get notifications** when pipelines finish (success or failure)
- **Switch branches** quickly without leaving the browser

Think of it as a mission control dashboard for your AWS CodePipeline infrastructure.

---

## ✅ Prerequisites

Before you start, make sure you have:

### 1. **Node.js** (v16 or higher)
```bash
node --version  # Should show v16.x.x or higher
```

### 2. **AWS CLI** configured with valid profiles
Remote Control uses your local AWS CLI profiles for authentication. You need:
- AWS CLI installed and configured (`aws configure`)
- Valid AWS credentials with CodePipeline permissions
- SSO sessions active (if using AWS SSO)

**Test your AWS access:**
```bash
aws codepipeline list-pipelines --profile your-profile-name
```

### 3. **Access to AWS CodePipeline**
Your AWS IAM user/role must have permissions for:
- `codepipeline:GetPipeline`
- `codepipeline:UpdatePipeline`
- `codepipeline:StartPipelineExecution`
- `codepipeline:StopPipelineExecution`
- `codepipeline:GetPipelineState`
- `codepipeline:ListPipelineExecutions`
- `codepipeline:ListPipelines`

---

## 🚀 Installation

### Step 1: Clone or navigate to the project
```bash
cd /path/to/remote-control
```

### Step 2: Install dependencies
```bash
npm install
```

That's it! No build steps, no bundlers — just Node.js dependencies.

---

## ⚙️ Configuration

Remote Control uses a `config.json` file to map your repositories to AWS CodePipeline names. You'll need to set this up before first use.

### Step 1: Create or edit `config.json`

The file should look like this:

```json
{
  "awsProfile": "your-aws-profile-name",
  "awsRegion": "us-east-1",
  "teamsWebhook": "https://your-teams-webhook-url.com/...",
  "environments": ["uat1", "uat2", "uat3", "uat4", "uat5"],
  "repos": [
    {
      "name": "user-service",
      "pipelineName": "{env}-user-service"
    },
    {
      "name": "order-service",
      "pipelineName": "{env}-order-service"
    },
    {
      "name": "payment-service",
      "pipelineName": "{env}-payment-service"
    }
  ]
}
```

### Configuration Fields

| Field | Description | Required |
|-------|-------------|----------|
| `awsProfile` | AWS CLI profile name to use for authentication | Yes |
| `awsRegion` | AWS region where your pipelines are located | Yes |
| `teamsWebhook` | Microsoft Teams webhook URL for notifications | No |
| `environments` | List of environment names (e.g., uat1, uat2) | Yes |
| `repos` | Array of repositories and their pipeline mappings | Yes |

### Understanding Pipeline Name Patterns

The `{env}` placeholder in `pipelineName` gets replaced with the actual environment name at runtime:

**Example:**
- Pattern: `{env}-user-service`
- Environment: `uat1`
- Result: `uat1-user-service` ✅

This allows one repo configuration to work across all environments.

### Step 2: Update repos to match your pipelines

List your AWS CodePipeline names:
```bash
aws codepipeline list-pipelines --profile your-profile-name
```

Then add each repo/pipeline pair to the `repos` array in `config.json`.

**Pro Tip:** You can also edit the configuration directly from the Settings page in the web UI!

---

## 🎮 Usage

### Starting the Server

```bash
npm start
```

You should see:
```
Remote Control running at http://localhost:9001
```

Open [http://localhost:9001](http://localhost:9001) in your browser.

**For development with auto-restart:**
```bash
npm run dev
```

---

## 📖 Using the Interface

### 1. **Deploy Page** (Single Environment)

Deploy to one environment at a time:

1. **Select an environment** from the dropdown (uat1, uat2, etc.)
2. **Enter a branch name** (e.g., `feature/new-login`)
3. **Select repos** to deploy (checkboxes)
4. **Click "Deploy & Notify"**

The system will:
- Update each pipeline's source branch configuration
- Trigger the pipeline execution
- Send a Teams notification (if configured)
- Monitor pipeline status in real-time

**Branch Overrides:**
- Click the pencil icon next to any repo to set a different branch for just that repo
- Useful when you need to deploy different branches of different services

### 2. **Multi-Env Page** (Multiple Environments)

Deploy the same branch to multiple environments simultaneously:

1. **Enter a default branch** (e.g., `develop`)
2. **Select repos** to deploy
3. **Select environments** (uat1, uat2, uat3, etc.)
4. **Click "Deploy to X env(s)"**

All selected pipelines will be triggered in parallel across all selected environments.

### 3. **Settings Page**

Configure Remote Control:
- Switch AWS profiles
- Update AWS region
- Add/edit/delete repository mappings
- Set Microsoft Teams webhook URL

Changes are saved to `config.json` automatically.

---

## 🔔 Real-Time Monitoring

Once you trigger deployments, Remote Control automatically:

- **Subscribes to pipeline updates** via WebSocket
- **Shows live status** for each pipeline (InProgress, Succeeded, Failed, etc.)
- **Updates stage progress** in real-time (Source → Build → Deploy)
- **Sends browser notifications** when pipelines finish
- **Shows summary toasts** when all monitored pipelines complete

### Pipeline Status Badges

| Status | Meaning |
|--------|---------|
| 🟢 **Succeeded** | All stages completed successfully |
| 🔴 **Failed** | At least one stage failed |
| 🔵 **InProgress** | Pipeline is currently running |
| 🟡 **Stopped** | Manually stopped by user |
| 🟡 **Canceled** | Execution was canceled or superseded |
| ⚪ **Idle** | Pipeline has never run or is waiting |
| 🟠 **Error** | Failed to fetch status from AWS |

### Pipeline Actions

- **▶️ Trigger (Re-run)**: Start a new pipeline execution without changing the branch
- **⏹️ Stop**: Halt a currently running pipeline execution

---

## 🔐 AWS Credentials

Remote Control uses your **local AWS CLI profiles** for authentication. It does **NOT** store credentials.

### Using AWS SSO

If you use AWS SSO, make sure your session is active:

```bash
aws sso login --profile your-profile-name
```

Sessions expire periodically — if you see credential errors, re-run `aws sso login`.

### Switching Profiles

You can switch between AWS profiles in the Settings page or by editing `config.json`.

The navbar shows your current credential status:
- 🟢 **Green badge**: Credentials valid
- 🔴 **Red badge**: Credentials invalid or expired
- 🔵 **Blue badge**: Validating credentials...

---

## 🔧 Troubleshooting

### "AWS credentials invalid" error

**Solution:** Refresh your AWS credentials
```bash
aws sso login --profile your-profile-name
```

### Pipelines not updating after trigger

**Solution:** Check the browser console for WebSocket connection errors. Refresh the page to re-establish the connection.

### "Pipeline not found" error

**Solution:** Verify the pipeline name pattern in `config.json` matches your actual pipeline names in AWS:
```bash
aws codepipeline list-pipelines --profile your-profile-name
```

### Port 9001 already in use

**Solution:** Change the port in `server.js` or kill the process using port 9001:
```bash
lsof -ti:9001 | xargs kill -9
```

### Teams notifications not working

**Solution:** Verify your Teams webhook URL is correct in Settings. Test it manually:
```bash
curl -H "Content-Type: application/json" -d '{"text":"Test"}' YOUR_WEBHOOK_URL
```

---

## 🌐 Browser Compatibility

Remote Control works best in modern browsers:
- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+

WebSocket support is required for real-time updates.

---

## 📦 What's Under the Hood

### Frontend Architecture
- **React 18** (no build step — Babel standalone transpiles JSX in browser)
- **UI Framework**: Tabler UI v1.0.0-beta20 + Tabler Icons
- **Real-time**: WebSocket via Socket.IO client
- **File Structure**:
  - `pages/` - Three main views (deploy, multi-env-deploy, settings)
  - `components/` - Reusable UI components (shared across pages)
  - `utils/` - API client, WebSocket wrapper, helper functions
  - `hooks/` - Custom React hooks (useDeploy for state management)

### Backend Architecture
- **Node.js + Express** (minimal server entry point - 32 lines)
- **Socket.IO** for WebSocket real-time updates
- **AWS SDK v3**: `@aws-sdk/client-codepipeline`
- **Auth**: Local AWS CLI profiles (fromIni) - no credentials stored
- **Organized Structure**:
  - `lib/config/` - Configuration management and AWS client factory
  - `lib/services/` - Business logic (AWS operations, Teams notifications, developer detection)
  - `lib/routes/` - API endpoint handlers (organized by domain)
  - `lib/websocket/` - WebSocket event handlers and pipeline polling

No database, no authentication layer, no build step — just you, your AWS credentials, and your pipelines.

### Code Organization Benefits
- **Modular Backend**: Services and routes are cleanly separated, making it easy to:
  - Test individual modules in isolation
  - Reuse AWS pipeline logic in other tools (e.g., CLI scripts)
  - Add new API endpoints without touching existing code
  - Understand the codebase at a glance
- **Organized Frontend**: Clear separation between pages, components, and utilities
- **Single Responsibility**: Each file has one job (config management, Teams notifications, pipeline operations, etc.)
- **Maintainable**: Server.js reduced from 568 lines to 32 lines — all logic extracted to focused modules

---

## 🚦 Current Features

- ✅ Single-environment deployments
- ✅ Multi-environment parallel deployments
- ✅ Real-time pipeline status monitoring
- ✅ Browser notifications
- ✅ Microsoft Teams notifications
- ✅ Pipeline trigger/stop actions
- ✅ Per-repo branch overrides
- ✅ Dark mode support
- ✅ AWS credential validation

---

## 🔮 Future Enhancements

*(Placeholder for upcoming features)*

- 🔄 Pipeline execution history view
- 📊 Deployment analytics and metrics
- 🔍 Advanced filtering and search
- 📝 Lambda function invocation with streaming logs
- 🖥️ SSH/shell command execution with real-time output
- 👥 Multi-user collaboration features
- 📱 Mobile-responsive improvements

Stay tuned!

---

## 📄 License

MIT License — see LICENSE file for details.

---

## 🤝 Contributing

This is an internal tool, but suggestions and improvements are welcome! Open an issue or submit a pull request.

---

## 💬 Need Help?

- Check the **Troubleshooting** section above
- Review `CLAUDE.md` for technical architecture details
- Ask your team's DevOps or platform team

---

**Happy Deploying! 🚀**
