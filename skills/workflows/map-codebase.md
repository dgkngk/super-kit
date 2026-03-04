---
description: (Brownfield) Map existing codebase architecture, tech stack, and conventions to ensure AI logic integrates smoothly.
---

# /map-codebase - Codebase Mapping Workflow

Explore your existing application to document and structure its architecture, technology stack, testing conventions, and primary concerns. These foundational documents allow you and specialized agents to safely operate inside complex, pre-existing ("brownfield") codebases.

> **Why map the codebase?** Writing code in an existing project without understanding its structure leads to duplicated patterns, fragmented architecture, and broken tests.

## When To Use

- **New Developer/Agent Onboarding:** First step when bringing an agent into a mature project.
- **Before Major Refactors:** Taking a snapshot of the current state before altering the foundations.
- **Project Documentation Sync:** After significant time has passed or dependencies have evolved.

---

## Workflow

### Step 1: Run Sub-Task Planners in Parallel

You will invoke multiple agents sequentially or in parallel using the `orchestrator` to generate specific documents:

#### 1. Analyze Tech Stack and Integrations
Use `explorer-agent` to analyze package files (e.g., package.json, requirements.txt, Cargo.toml), config files, and core application endpoints.
- **Output:** `.planning/codebase/STACK.md` and `.planning/codebase/INTEGRATIONS.md`

#### 2. Analyze Architecture and Structure
Use `code-archaeologist` to analyze the directory structures, entry points, import patterns, and key abstractions across the project.
- **Output:** `.planning/codebase/ARCHITECTURE.md` and `.planning/codebase/STRUCTURE.md`

#### 3. Analyze Quality and Conventions
Use `qa-automation-engineer` or `test-engineer` to read `.eslintrc`, `.prettierrc`, `jest.config.js`, and analyze common design patterns across `src/`.
- **Output:** `.planning/codebase/CONVENTIONS.md` and `.planning/codebase/TESTING.md`

#### 4. Map Out Concerns
Use `penetration-tester` or `performance-optimizer` to map large files, scattered FIXME/TODO tags, fragile abstractions, and technical debt.
- **Output:** `.planning/codebase/CONCERNS.md`

### Step 2: Ensure Path Formatting

> [!IMPORTANT]
> **File Paths are Mandatory:** All generated mapping documents (`STACK.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`, etc.) MUST use absolute or exact relative markdown file paths (e.g., `src/services/user.ts`), formatted with backticks. Vague descriptions like "User Service" are not actionable.

### Step 3: Integrate with Project Knowledge

Ensure the mapped output is linked in the master README, `GEMINI.md`, or the primary planner file so future workflows (`/plan-compound`, `/work`) automatically ingest the conventions.

### Step 4: Validate

Ensure these files do NOT include:
- Passwords or tokens.
- Content from `.env` files.
- Proprietary or encrypted keys.

Check that all 4 dimensions (Tech, Arch, Quality, Concerns) exist in the `.planning/codebase/` output directory.

---

## Output Template References

When writing these documents, use the following structural guidelines:

- **STACK.md**: Languages, Runtime, Frameworks, Key Dependencies, Platform Requirements.
- **ARCHITECTURE.md**: Pattern Overview, Layers, Data Flow, Key Abstractions, Entry Points.
- **CONVENTIONS.md**: Naming Patterns, Code Style, Error Handling, Logging, Comment Guidelines.
- **CONCERNS.md**: Tech Debt, Known Bugs, Fragile Areas, Test Coverage Gaps.

## Completion

```bash
✓ Codebase mapped into .planning/codebase/

Next steps:
1. /plan-compound - Start planning features using these new conventions
2. /review - Review the identified technical debt (CONCERNS.md)
```
