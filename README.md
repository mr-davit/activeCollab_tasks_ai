# ActiveCollab Task CLI (AI-Native)

[![npm version](https://img.shields.io/npm/v/@mr-davit/activecollab-task-cli.svg)](https://www.npmjs.com/package/@mr-davit/activecollab-task-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> The AI-friendly CLI for ActiveCollab. Designed so humans and AI agents (Copilot, Cursor, ChatGPT) can manage tasks reliably with structured JSON output and generated context.

---

## Install
```bash
npm install -g @mr-davit/activecollab-task-cli
```

## Quick Start
1) Set your token: `export AC_API_TOKEN=your_token`
2) Initialize project: `ac-task init`

## Why AI-Native?
`ac-task init` generates an Agent Guide with user IDs and task list IDs so AI tools can act without guessing. Add `--format json` to any command for structured output.

## Core Commands
- `ac-task auth setup` — configure base URL and token
- `ac-task init` — generate project guide + agent instructions
- `ac-task list` — smart dashboard (my open tasks by default)
- `ac-task show <id>` — task details + subtasks
- `ac-task create <name>` — create task (plain text auto-converted to HTML)
- `ac-task update <id>` — update fields
- `ac-task update-status <id> <done|open>` — toggle completion
- `ac-task comment <id> <text>` — add comment (plain text → HTML)
- `ac-task log <id> <hours>` — log time (supports job type)
- `ac-task delete <id>` — delete with confirmation (use --force to skip)

## JSON Everywhere
Use `--format json` on any command for LLM-friendly output.

## SSL / Self-Hosted
If your server has an expired/self-signed cert, `auth setup` will offer to disable verification and persist that choice.

## License
MIT © 2025 Daviti
# ac-task

A CLI tool for interacting with ActiveCollab, designed for both humans and LLM agents.

## Installation

```bash
npm install -g ac-task
```

## Setup

1. Set your ActiveCollab API token as an environment variable:
   ```bash
   export AC_API_TOKEN=your_api_token_here
   ```

2. Run the setup command:
   ```bash
   ac-task auth setup
   ```

3. Follow the interactive prompts to configure your connection.

## Usage

### Authentication Commands

```bash
# Configure ActiveCollab connection
ac-task auth setup

# Check current authentication status
ac-task auth whoami

# Get JSON output (for LLM agents)
ac-task auth whoami --format json
```

### Output Formats

The CLI supports two output formats:

- `human` (default): Colored, formatted output for terminal use
- `json`: Structured JSON output for programmatic use and LLM agents

Use `--format json` or `-f json` to get JSON output.

## Configuration

### Global Configuration

Located at `~/.ac-task/config.json`:

```json
{
  "base_url": "https://app.activecollab.com/123456",
  "token_env_var": "AC_API_TOKEN",
  "cached_user_id": 4,
  "cached_user_name": "Your Name"
}
```

### Project Configuration

Create a `.ac-task.json` file in your project root:

```json
{
  "project_id": 12,
  "defaults": {
    "lookahead_days": 7
  }
}
```

The CLI will automatically find this file when run from any subdirectory of the project.

## Error Handling

When using `--format json`, all errors are returned as structured JSON:

```json
{
  "error": {
    "type": "AUTH_ERROR",
    "code": 401,
    "message": "Authentication failed",
    "details": "The API token is invalid or expired."
  }
}
```

Error types:
- `CONFIGURATION_ERROR`: Missing or invalid configuration
- `AUTH_ERROR`: Authentication/authorization failures
- `API_ERROR`: ActiveCollab API errors
- `NETWORK_ERROR`: Connection issues
- `VALIDATION_ERROR`: Invalid input
- `UNKNOWN_ERROR`: Unexpected errors

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development
npm run dev
```

## License

MIT
