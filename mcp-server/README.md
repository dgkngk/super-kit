# Super-Kit MCP Server

This is a Model Context Protocol (MCP) server that exposes the agents, skills, and workflows of **Super-Kit** to any compatible AI assistant (Cline, Cursor, Gemini, etc.).

By installing this MCP server, your AI agent can dynamically list, read, and load the specific operational contexts it needs on the fly, without needing massive system prompts.

## Available Tools

- **`list_superkit_assets`**: Lists all available agents, skills (tech/meta), and workflows in the Super-Kit repository.
- **`load_superkit_agent`**: Loads the system instructions and guidelines for a specific specialist agent (e.g., `data-engineer`).
- **`load_superkit_skill`**: Loads the skill instructions (`SKILL.md`) for a specific category and skill (e.g., category: `tech`, name: `react-best-practices`).
- **`load_superkit_workflow`**: Loads the instructions for a specific slash-command workflow (e.g., `work`, `explore`).

## Installation

```bash
cd super-kit/mcp-server
npm install
npm run build
```

## Configuring in AI Platforms

### Cline (VS Code)
Add the following to your `cline_mcp_settings.json`:
```json
{
  "mcpServers": {
    "superkit": {
      "command": "node",
      "args": ["/absolute/path/to/super-kit/mcp-server/build/index.js"]
    }
  }
}
```

### Cursor / Windsurf
Go to Settings -> Features -> MCP Servers.
Add a new stdio server:
- Name: `superkit`
- Command: `node /absolute/path/to/super-kit/mcp-server/build/index.js`

## How it works
The server reads directly from the parent `super-kit` directory, resolving paths safely to prevent traversal attacks. It automatically parses and returns the Markdown contents of the structural elements.
