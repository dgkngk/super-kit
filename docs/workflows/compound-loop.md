# Compound Engineering Loop & Workflows

Super-Kit operates efficiently through well-defined step-by-step Standard Operating Procedures (SOPs) known as **Workflows**. Workflows establish an AI-native engineering lifecycle.

AI Coding Systems operate best under constraints and sequential logic paths. Monolithic multi-step requests lead to confusion and hallucinated syntax errors. Super-Kit's `Compound Loop` fixes this.

## The Compound Engineering Loop

The primary operating directive for building sustainable software within Super-Kit follows a rigorous sequence:

### `/explore` → `/plan` → `/work` → `/review` → `/compound`

1. **`/explore`** (Reconnaissance)
   - Do not open files blindly. Scan the codebase using `tree` structures, architectural docs, or dependency trees. Gather context before touching code.
   - Result: Clear understanding of the impact radius of the task.

2. **`/plan`** (Architecture & Strategy)
   - Construct a sequence of operations and determine necessary constraints. Write technical boundary logic.
   - Result: A technical implementation plan ready for coding.

3. **`/work`** (Execution)
   - Follow the `/plan` instruction. Rely on **Domain Specialists** combined with local **Tech Skills** (e.g. asking the `frontend-specialist` to apply `react-best-practices` to implement the plan).
   - Result: The code is written efficiently according to project patterns.

4. **`/review`** (Quality Assurance)
   - Audit the code using specialized CI checks (or the built-in MCP verification suite) assessing test coverage, performance characteristics, API security, and TS/Linters consistency.
   - Result: Hardened, production-ready code.

5. **`/compound`** (Knowledge Persistence)
   - The final, most crucial step. Document what was learned, what broke during debugging, and the eventual solution.
   - Result: Saved solutions placed in `docs/solutions/`. Over time, this transforms into a localized LLM "brain" ensuring recurrent bugs or design mistakes are never made twice across independent sessions.

## Auxiliary Workflows

Super-Kit includes multiple helper workflows targeting routine technical situations, mapped in `workflows/`:

- **`triage`**: To interpret and manage a new GitHub issue or error dump.
- **`report-bug`**: Generate robust tracking docs.
- **`resolve_todo`**: Contextually clear up technical debt efficiently.
- **`housekeeping`**: Refactoring and lint operations for a clean branch.
- **`deploy-docs`**: Triggers infrastructure pipelines for document hosting.
- **`create-agent-skill`**: Standardizes the creation of new `skills/` within Super-Kit to upgrade the AI team over time.

## Utilizing Workflows in Platforms

An AI paired with Super-Kit will accept 'slash commands' out of the box. Merely typing `/compound` in Claude or Cursor directs the agent to load the respective file from `/workflows/compound.md` using the MCP tool, which structures the exact output formatting right then and there.
