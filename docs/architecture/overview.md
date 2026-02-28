# Super-Kit Architecture Overview

Super-Kit is a robust, dynamic context management system for AI coding agents. Combining Gemini-Kit and Ag-Kit, it facilitates a T-Shaped AI Team logic mapped closely to modern software engineering workflows.

## The Core Concept: The T-Shaped AI Team

Instead of giving an AI a generic personality to "code securely and performantly," Super-Kit assigns dedicated specializations that map to real-world roles:
- **Core Engineering Team**: Focuses on the development loop, version control, PR reviews, and TDD checks. The `coder`, `tester`, `reviewer`, `scout`, `orchestrator`, and `planner` fall under this roof.
- **Domain Specialists**: Deliver niche expertise. E.g., a `frontend-specialist` is explicitly told to focus on UX/UI complexity and accessibility, whereas a `database-architect` will analyze ORM overheads, migrations, and index optimization.

A T-shaped dynamic guarantees that general engineering processes are uniformly applied (via global rules like `SUPERKIT.md`) while domain logic is correctly constrained (via localized agent instructions).

## Modular Hierarchy

1. **`SUPERKIT.md`**: The brain of the operation. AI agents ingest this. This file directs them to the roles and schemas located in `/agents` and `/workflows`.
2. **`/.core/`**: Core scripts and universal mandates independent of specific engines. Includes automated workflows like checklists for performance.
3. **`/agents/`**: Distinct personality instructions and guardrails for individual agents (`database-architect`, `quant-developer`, `scout`, etc).
4. **`/skills/`**: Tactical "what to execute and how" instructions. Separated into `tech` (React, Next.js, Node.js paradigms) and `meta` (project-management practices, documentation persistence frameworks).
5. **`/workflows/`**: Structured loops the agent can execute step-by-step. The most critical is the Compound Loop: `/plan -> /explore -> /work -> /review -> /compound`.

## Persistent Context via the `Compound Loop`

Super-Kit thrives on long-lived projects where context evaporation is typical. Tools like `/compound` force the AI to document specific problems overcome into the `/docs/solutions/` directory.

### Session Resume
Upon a new AI session, the agent initializes the `session-resume` skill. This prompts it to read past documented state, checkpoints, or TODO logs to regain a structural understanding of the project right where the previous session halted.

## The MCP Server
Housed in `/src`, the Super-Kit MCP Server leverages the Official Model Context Protocol SDK to dynamically expose standard directory reads to IDEs operating with LLMs. Using simple node endpoints, Cursor or Windsurf can directly fetch specific agent behaviors, removing the need for 50-page copy-paste prompts.
