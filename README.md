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
