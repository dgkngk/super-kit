# Super-Kit Architecture

> Comprehensive AI Agent Capability Expansion Toolkit - Merged from Gemini-Kit and Ag-Kit

---

## 📋 Overview

Super-Kit is a model-agnostic and agent-agnostic toolkit designed to provide a highly structured engineering loop alongside granular domain expertise. It merges the dynamic workflows of Gemini-Kit with the deep role-based specificities of Ag-Kit.

- **Super Engineers & Domain Specialists** - A T-shaped team of AI personas.
- **Categorized Skills** - Technical knowledge, meta-engineering, and workflow instructions.
- **Unified Workflows** - Slash command procedures driving the Compound Engineering Loop.

---

## 🏗️ Directory Structure

```plaintext
super-kit/
├── ARCHITECTURE.md          # This file
├── SUPERKIT.md              # Global rules and activation protocol
├── .core/                   # Core engine-independent logic
│   ├── rules/               # Universal mandates (e.g., clean-code, security-first)
├── agents/                  # The T-Shaped AI Team Personas
├── skills/                  # The Knowledge Modules
│   ├── meta/                # Session-resume, compound-docs, file-todos (from gemini-kit)
│   ├── tech/                # Node.js, React, Python, Prisma (from ag-kit)
│   └── workflows/           # TDD, CI/CD, Code Review checklists
└── workflows/               # Slash commands and lifecycle loops
```

---

## 🤖 Agents

Super-Kit provides a T-Shaped AI team: a core engineering team focused on process, supported by deep domain specialists.

### Core Team (Process Execution)
- `planner`: Creates detailed implementation plans.
- `scout`: Explores the codebase and resolves dependencies.
- `coder`: Writes clean, efficient code following patterns.
- `tester`: Writes unit tests and ensures quality.
- `reviewer`: Suggests improvements and ensures security.
- `git-manager`: Manages version control operations.
- `orchestrator`: Coordinates complex, multi-agent tasks.

### Domain Specialists (Context & Logic)
- `database-architect`: Database schema, scaling, and ORM usage (Prisma, SQL).
- `security-auditor`: Comprehensive security audits, OWASP checks.
- `frontend-specialist`: React, Next.js, and complex UI/UX architectures.
- `backend-specialist`: API layers, microservices, and Node.js/Python servers.
- `ui-designer`: Visual layouts, animations, and Tailwind integrations.

### Fintech Specialists
- `data-engineer`: ETL pipelines, data scaling, idempotency.
- `quant-developer`: Financial modeling, backtesting engines, and low-latency systems.

*(Note: Generic tasks invoke the `coder`, who leverages `database-architect` and `quant-developer` knowledge contextually.)*

---

## 🧩 Skills

Skills are context blocks loaded by Agents based on the active task.

### Tech Skills (`skills/tech/`)
Contains granular knowledge bases for specific tools (e.g., `react-best-practices`, `api-patterns`, `python-patterns`, `docker-expert`).

### Meta Skills (`skills/meta/`)
Contains lifecycle operation patterns (e.g., `session-resume`, `compound-docs`, `file-todos`) to ensure knowledge is carried across sessions.

---

## 🔄 Workflows

Workflows are standard operating procedures invoked via slash commands (e.g. `/plan`, `/work`, `/compound`, `/explore`).

### The Compound Loop
The primary operating directive for building sustainable software:
`/explore` → `/plan` → `/work` → `/review` → `/compound`

1. **Explore**: Investigate the codebase and gather requirements.
2. **Plan**: Write the task boundaries and solution architecture.
3. **Work**: The Core Team executes code generation.
4. **Review**: Automated auditing via `src/tools/checklist.ts`.
5. **Compound**: Output reusable solutions to `docs/solutions/`.

## ⚙️ Usage & Agnosticism

Super-Kit is designed to be injected into any agentic platform (Cline, Cursor, Gemini, Aider, GitHub Copilot). 
The entry point is reading `SUPERKIT.md` to establish global rules. 

### How to Point Changing Agents to the Entrypoint:

- **Standard Agents**: Reference `@SUPERKIT.md` in your prompt, or set its content as your persistent user rules for the project.
- **Cursor/Windsurf**: Reference `@SUPERKIT.md` in your Composer/Chat, or set the content of `SUPERKIT.md` as your project's `.cursorrules` / `.windsurfrules`.
- **Cline (VS Code)**: Set the content of `SUPERKIT.md` as your custom instructions in the Cline settings, or add an `@SUPERKIT.md` command in your prompt.
- **Gemini / Google AI Studio**: Supply `SUPERKIT.md` as your System Prompt instructions.
- **Aider**: Run aider with the message `aider --message "Read SUPERKIT.md for your system instructions before doing anything else."`

Once the agent has loaded `SUPERKIT.md`, it will follow the instructions to activate the appropriate `@agent` which dynamically reads `SKILL.md` from the relevant directories.
