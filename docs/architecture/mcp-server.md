# Super-Kit MCP Server

The Super-Kit internal Model Context Protocol (MCP) server enables AI models working on a codebase to natively access Super-Kit components (agents, skills, workflows, checklists, preview functionality) seamlessly through exposed API tooling.

## MCP Protocol Overview

Super-Kit operates as an MCP runtime interface, meaning compatible LLMs (`Claude`, `Windsurf`, `Cursor`, `Roo`, etc) do not need to process multi-megabyte monolithic prompts containing system logic. Instead, the `superkit` MCP server exposes an array of small, context-aware functional commands.

## Architecture & Codebase integration
All logic resides fundamentally under `src/tools/`.

The primary entry point (`src/index.ts`) initializes an MCP StdIO Server bridging LLM intent to local TS filesystem logic mapping against Super-Kit domains (`/agents`, `/skills`, `/workflows`).

## Exposed Tools

1. **`list_superkit_assets`**: 
   - Dynamically surveys local `.md` elements across directories. 
   - Gives the AI agents a menu to pick specific personas or task patterns without overwhelming their context window limits.

2. **`load_superkit_agent`**:
   - Accepts an agent identity (like `frontend-specialist`, `database-architect`, `quant-developer`). 
   - Automatically loads that profile's strict system directives and rule boundaries (from `/agents/*`).

3. **`load_superkit_skill`**:
   - Supplies the AI agent with specific technical nuances. E.g., `tech` -> `react-best-practices` instructs the bot on idiomatic custom Hooks syntax, or `meta` -> `compound-docs` pushes knowledge resolution loops. 

4. **`load_superkit_workflow`**:
   - Exposes standard operation loops like `/plan`, `/explore` or `/compound`. Instructs the agent on how to manage engineering lifecycle transitions correctly.

5. **`call_tool_checklist`** *(Under /src/tools/validators)*:
   - Validates CI/CD quality gates across files locally. It replaces arbitrary BASH script logic with Typescript AST validations, testing heuristics, web performance metrics, and a full-featured UX accessibility audit via Puppeteer/Playwright.

6. **`call_tool_verify_all`**:
   - The deployment-ready aggregate function to rigorously inspect PR structures locally.

7. **`call_tool_auto_preview`**:
   - Orchestrates local host status monitoring and preview rendering of development bundles.

8. **`call_tool_session_manager`**:
   - An intelligent checkpointing system that assesses the physical state of the project, enumerating current branch information, file stats, and technical tech-stack auto-detection.

## Security

Path traversal prevention strategies and boundary isolations are rigorously applied. All Super-Kit assets are loaded specifically relative to the context directory boundary map.
