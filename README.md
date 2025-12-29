# ActiveCollab Task CLI (AI-Native)

[![npm version](https://img.shields.io/npm/v/@mr-davit/activecollab-task-cli.svg)](https://www.npmjs.com/package/@mr-davit/activecollab-task-cli)

The AI-friendly CLI for ActiveCollab. Designed so humans and AI agents (Copilot, Cursor, ChatGPT) can manage tasks reliably with structured JSON output and generated project context.

---

## Install (global)

Recommended for end users:

```bash
npm install -g @mr-davit/activecollab-task-cli
```

## Per-project installation (local)

Install as a dev dependency to keep the tool per-repo and runnable with `npx`:

```bash
# add to this project without saving to package.json
npm install --no-save --save-dev @mr-davit/activecollab-task-cli

# or add normally to devDependencies
npm install --save-dev @mr-davit/activecollab-task-cli
```

Run locally without global install:

```bash
npx ac-task init
# or from package.json scripts:
# "scripts": { "ac-task": "ac-task" }
# npm run ac-task -- init
```

---

## Authentication (`ac-task auth:setup`)

Before using the CLI, you need to configure your ActiveCollab connection:

```bash
ac-task auth:setup
```

This will prompt you for:
1. Your ActiveCollab instance URL (e.g., `https://app.activecollab.com/123456`)
2. Your ActiveCollab API token

The token is securely stored in `~/.ac-task/config.json` and will be used for all subsequent commands.

**Note:** For backward compatibility, the CLI also supports reading tokens from environment variables if `token_env_var` is configured in your config file.

---

## Initialize a project (`ac-task init`)

`ac-task init` maps the current repository to an ActiveCollab project and generates two files in the project (gitignored by default):


Init flow (what to expect):

1. If you have not configured global auth (`~/.ac-task/config.json`), `init` will prompt whether you want to provide the ActiveCollab URL and token now. You can choose to save this config to `~/.ac-task/config.json` or use the values for this session only.
2. `init` will then prompt for the ActiveCollab *Project ID* (or accept `--project <id>`).
3. The CLI fetches project details, users and task lists, writes `.ac-task.json`, and the `.ai` context files.

URL examples and guidance

	- `https://project.yourproject.com/api/v1` (self-hosted — include `/api/v1` or `/api/v2` if present)
	- `https://app.activecollab.com/123456` (cloud-hosted, may not include `/api/v1` — CLI handles either)

	The CLI will normalize the URL when building browser links (it strips a trailing `/api/v1` or `/api/v2` to produce a user-facing project URL like `https://project.yourproject.com/projects/3`).

Security notes:
- Your API token is stored in `~/.ac-task/config.json` (not committed to git)
- Ensure this file has appropriate permissions (the CLI creates it with user-only read/write by default)

Example: full interactive setup

```bash
# First-time setup
ac-task auth:setup
# Enter your ActiveCollab URL and API token when prompted

# initialize in repo
cd /path/to/repo
ac-task init
# follow prompts: provide project id (or use --project)
```


## LLM / Agent Guidance

When interacting with LLMs or agents about tasks or ActiveCollab, include the `.ai/AC_TASK_AGENT_INSTRUCTIONS.md` file in the prompt context so the model can follow repository-specific conventions and examples. Also include `.ai/ACTIVE_COLAB_PROJECT_GUIDE.md` when the request involves project details.

Suggested text to add to any Copilot/global LLM instruction (improved wording):

> You will improve the user's text. For any request involving tasks or ActiveCollab, first read the repository file `.ai/AC_TASK_AGENT_INSTRUCTIONS.md` (and `.ai/ACTIVE_COLAB_PROJECT_GUIDE.md` if present). Use the information in those files to guide responses, respect project settings, and do not invent project-specific values. If required information is missing, ask the user for clarification before acting.

If you want me to make the init flow non-interactive for scripts (e.g. provide base_url and token via flags), I can add `--base-url` and `--token` flags to `init` in a follow-up change.

## Quick reference

- `ac-task auth setup` — configure base URL and token interactively
- `ac-task init [--project <id>]` — initialize project mapping and generate LLM context
- `ac-task list` — list tasks (use `--format json` for LLMs)

---

## Commands

#### `update-status`

Change the status of a task to `done` (completed) or `open` (reopened).

**Usage:**
```bash
ac-task update-status <task_id> <status> [options]
```

- `<task_id>`: The ID of the task to update.
- `<status>`: The new status (`done` or `open`).
- `--format`: Output format (`human` or `json`). Default: `human`.

This command ensures task status updates are sent to the ActiveCollab API and verifies the update for consistency.

---

## Troubleshooting

### Task status update reports success but task remains open

**Symptom:** Running `ac-task update-status <id> done` returns success, but `ac-task show <id>` still reports `is_completed: false`.

**Root cause:** ActiveCollab's `is_completed` field is derived from `completed_on` and `completed_by_id`. The generic PUT endpoint may ignore the `is_completed` field or process it asynchronously.

**Fix (automatic):** The CLI now uses canonical ActiveCollab endpoints:
- Complete: `PUT /complete/task/:id` 
- Reopen: `PUT /open/task/:id`

These endpoints properly set `is_completed`, `completed_on`, and `completed_by_id` immediately.

If canonical endpoints are unavailable (404/405 on older installations), the CLI automatically falls back to:
- Complete: `PUT /projects/{p}/tasks/{id}` with `{"completed_on": <now>, "is_completed": 1}`
- Reopen: `PUT /projects/{p}/tasks/{id}` with `{"completed_on": null, "is_completed": 0}`

After any update, the CLI verifies the change with automatic retries (3 attempts with exponential backoff: 500ms, 1s, 2s) to handle any server-side eventual consistency.

**Debugging:** Use the `--verbose` flag to see raw HTTP request/response logs:

```bash
ac-task --verbose update-status 109 done --format json
```

This will log the PUT request body, response status, and the subsequent GET requests to stderr (safe to use with `--format json` for automation).

---

MIT © 2025 Mr-davit

