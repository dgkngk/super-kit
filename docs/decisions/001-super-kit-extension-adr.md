# ADR-001: Integration of Advanced Specialized Agents and Strict Phase Workflows

## Context
The default `super-kit` includes a robust foundation of standard agents (such as `frontend-specialist`, `backend-specialist`, `database-architect`) and simple compounding knowledge mechanisms. However, as the complexity of user projects scales—especially when working with legacy/brownfield applications or requiring rigorous QA and security assurances—the basic agents lose focus. Furthermore, our original execution loops lacked a formal testing validation requirement prior to implementation. 

We possess alternative repositories (`antigravity-god-mode` and `get-shit-done`) containing advanced specialist agents and rigid milestone/phase-based workflows.

## Decision
We are augmenting the native `super-kit` ecosystem with the following assets:
1. **Agent Additions:** Migrated `code-archaeologist`, `penetration-tester`, `performance-optimizer`, `qa-automation-engineer`, and `devops-engineer` to `/agents`.
2. **Workflow: `map-codebase.md`:** A new workflow ported from GSD for mapping existing projects to prevent blind modifications of large architectures.
3. **Nyquist Validation Layer:** We have updated the `plan-compound.md` workflow to mandate the definition of automated tests (the Nyquist Validation Layer) mapped to Acceptance Criteria *before* execution.
4. **Boundary Enforcements:** We have explicitly defined the boundaries for the new agents within the `/agents/orchestrator.md` protocol to ensure agents do not overwrite files in competing domains (e.g. `penetration-tester` exclusively handles feature tests, `code-archaeologist` handles documentation/mapping).

## Consequences
### Positive
- **Specialized Execution:** Reduced cognitive load on general-purpose agents. We now have dedicated agents to audit security and CI/CD pipelines.
- **Improved Test Reliability:** The Nyquist validation forces test-command definitions as part of the planning phase, leading to highly testable architectures.
- **Brownfield Safety:** `map-codebase` will establish strict convention snapshots before major tasks, preventing arbitrary restructuring of older projects.

### Negative
- **Decision Overhead:** The orchestrator must now select from 20+ specialized agents rather than ~14.
- **Workflow Friction:** Mandating validation bindings slows down basic "cowboy coding" prototypes—though this is a deliberate trade-off for higher quality codebase compounding.

## Status
Accepted

## Date
2026-03-02
