# Super-Kit

Super-Kit is a modular repository containing instructions, workflows, skills, and specializations for AI coding agents. By structuring AI agent contexts into individual files, it allows large language model agents to load specific knowledge on the fly instead of relying on massive and bloated static system prompts.

🔗 **GitHub Repository:** [https://github.com/dgkngk/super-kit](https://github.com/dgkngk/super-kit)

## Directory Structure
- `agents/`: Contains instructions and guidelines for specialized AI roles (e.g., `data-engineer`).
- `skills/`: Contains technology-specific or meta skills (patterns, best practices) the agent can load dynamically (e.g., `react-best-practices`).
- `workflows/`: Contains step-by-step interactive slash-commands to guide the AI workflow (e.g., `/plan`, `/explore`).
- `src/`: The Model Context Protocol (MCP) server that exposes all these assets directly to compatible AI platforms.

## Providing the Kit to Your AI

The easiest way to power up your agent with this toolkit is to use the included MCP server.

You can launch it directly using `npx`:

```bash
npx -y superkit-mcp-server
```

## Available Tools

- **`list_superkit_assets`**: Lists all available agents, skills (tech/meta), and workflows in the Super-Kit repository.
- **`load_superkit_agent`**: Loads the system instructions and guidelines for a specific specialist agent (e.g., `data-engineer`).
- **`load_superkit_skill`**: Loads the skill instructions (`SKILL.md`) for a specific category and skill (e.g., category: `tech`, name: `react-best-practices`).
- **`load_superkit_workflow`**: Loads the instructions for a specific slash-command workflow (e.g., `work`, `explore`).

## Manual Installation and Configuration

If you cloned this repository locally, you can build and use the MCP server directly:

```bash
cd super-kit
npm install
npm run build
```

### Configuring in AI Platforms

#### Cline / Roo (VS Code)
Add the following to your `cline_mcp_settings.json`:
```json
{
  "mcpServers": {
    "superkit": {
      "command": "node",
      "args": ["/absolute/path/to/super-kit/build/index.js"]
    }
  }
}
```

#### Cursor / Windsurf
Go to Settings -> Features -> MCP Servers.
Add a new stdio server:
- Name: `superkit`
- Command: `node /absolute/path/to/super-kit/build/index.js`

## How it works
The built-in MCP server reads directly from the `super-kit` directory, resolving paths safely to prevent traversal attacks. It automatically parses and returns the Markdown contents of the structural elements so your AI agent always has the right context in mind.
