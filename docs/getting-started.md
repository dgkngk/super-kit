# Getting Started with Super-Kit

Super-Kit is a model-agnostic and agent-agnostic toolkit providing highly structured engineering loops, granular domain expertise, and dynamic role-based workflows context. 

## The Concept
Rather than loading a single massive "system prompt" covering all engineering practices and tech stack instructions, Super-Kit dynamically manages knowledge context in chunks called **Agents**, **Skills**, and **Workflows**. You integrate Super-Kit's `SUPERKIT.md` rulebook into your AI coding tool of choice, which will then use the provided tools (or Model Context Protocol server capabilities) to dynamically fetch details.

## Running the MCP Server
Super-Kit is distributed with a built-in Model Context Protocol (MCP) server for easy integration.

To run the server without installation:
```bash
npx -y superkit-mcp-server
```

If you have cloned the repository locally:
```bash
cd super-kit
npm install
npm run build
npm start
```

## Configuring Your AI Client

Here's how to integrate the MCP server into popular AI clients.

### Cline / Roo (VS Code extensions)
Edit the `cline_mcp_settings.json` or `roo_mcp_settings.json` file:
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

### Cursor / Windsurf
1. Navigate to your editor's **Settings -> Features -> MCP Servers**.
2. Click **Add New Server** with stdio transport.
3. Configure as:
   - **Name**: `superkit`
   - **Command**: `node /absolute/path/to/super-kit/build/index.js`
4. Use `.cursorrules` or `.windsurfrules` and point it to: `Read the super-kit/SUPERKIT.md file closely and act accordingly`.

### General Agents / Aider
For non-MCP tools, simply point the agent to the `SUPERKIT.md` file initially. The AI will read the main file, and execute commands to read `/agents`, `/skills`, or `/workflows` specific to the task given. 
Example with Aider:
```bash
aider --message "Read path/to/super-kit/SUPERKIT.md for your system instructions before proceeding."
```

## The T-Shaped Team
Once configured, ask your AI to take on a specific persona! e.g.:
> "Act as the `frontend-specialist`. Update our React dashboard."

The AI will intelligently use the `list_superkit_assets` and `load_superkit_agent` to embody the correct instructions and behaviors.
