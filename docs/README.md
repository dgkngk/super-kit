# Super-Kit Documentation

Welcome to the Super-Kit documentation! This folder contains detailed information about the Super-Kit project, its architecture, components, and how to use it.

## Table of Contents

- **[Getting Started](getting-started.md)**: How to set up and start using the Super-Kit MCP server with various AI platforms.
- **[Architecture Overview](architecture/overview.md)**: A deep dive into the architecture of the Super-Kit, including its folder structure and the T-shaped AI team concept.
- **[MCP Server details](architecture/mcp-server.md)**: Detailed documentation of the MCP server's implementation, tools, and endpoints.
- **[Compound Engineering Loop](workflows/compound-loop.md)**: How the Super-Kit workflow operates.
- **[Knowledge Base & Solutions](solutions/)**: Historical context, solved problems, and critical patterns.
- **[Architecture Decision Records](decisions/)**: Documentation of major technical decisions made during the project's lifecycle.
- **[Specifications](specs/)**: Detailed multi-session implementation specifications.
- **[Explorations](explorations/)**: Deep research artifacts and studies.

## Project Structure at a Glance
Super-Kit contains:
- **Agents (`/agents`)**: T-shaped AI personas, defining core process engineers and domain specialists.
- **Skills (`/skills`)**: Technical (`tech`) and Meta (`meta`) skills that the agents can dynamically load as context.
- **Workflows (`/workflows`)**: Standard operating procedures executed via slash commands.
- **MCP Server (`/src`)**: The Model Context Protocol server that bridges this context seamlessly into compatible LLM clients like Cursor, Roo, and Google AI Studio.
