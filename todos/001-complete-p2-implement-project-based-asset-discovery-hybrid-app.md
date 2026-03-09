---
status: complete
priority: p2
issue_id: "001"
tags: [generated, cleanup]
dependencies: []
---

# Implement Project-Based Asset Discovery (Hybrid Approach C)

## Problem Statement

**What's broken/missing:**
Add support for project-local `.agents/` folders as a project-scoped asset source. Introduces 4 new MCP tools (list_project_assets, load_project_agent, load_project_skill, load_project_workflow) with CWD fallback, extends list_superkit_assets with scope/projectPath params, and documents the .agents/ convention in SUPERKIT.md.

**Impact:**
This issue currently affects the system quality or functionality and needs to be addressed.

## Findings
- **Status:** Identified during workflow execution.
- **Priority:** p2
- **System Impact:** This item is tracked to ensure continuous improvement of the codebase. Addressing it will contribute to overall system stability and feature completeness. The findings section provides context on origin and importance.

## Recommended Action
Implement the solution according to the acceptance criteria below.

## Acceptance Criteria
- [ ] User can place .agents/agents/my-agent.md in a project and call load_project_agent successfully
- [ ] list_project_assets returns source: project on all entries
- [ ] list_superkit_assets({ scope: 'all' }) returns merged results with source labels
- [ ] list_superkit_assets() with no params is 100% backward compatible
- [ ] Path traversal attempts are rejected by safe_project_path guard
- [ ] When .agents/ does not exist all project tools return empty results without throwing
- [ ] SUPERKIT.md documents the .agents/ convention so models discover it automatically
- [ ] All new functions in ProjectAssets.ts have corresponding unit tests
- [ ] npm run build passes with no TypeScript errors


## Work Log

### 2026-03-09 - Created

**By:** Agent
**Actions:**
- Auto-generated via createTodo MCP tool

## Notes
Source: Workflow automation
