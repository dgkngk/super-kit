---
description: Check the improved Compound System's health and usage metrics.
---

# /compound_health - System Health Check

Use this workflow weekly to ensure the Compound System is actually working.

## Workflow

### Step 0: Search & Log

```bash
// turbo
Call MCP `call_tool_logger_manager` { action: "logWorkflow", name: "/compound_health", outcome: "success" }
Call MCP `call_tool_compound_manager` { action: "search", terms: [ "system health"] }
```

### Step 1: Run Health Dashboard

```bash
Call MCP `call_tool_compound_manager` { action: "health" }
```

### Step 2: Analyze Metrics

**Coverage:**
- **Target:** >50%
- **Action if Low:** Commit to running `/compound-search` before every `/plan`.

**Usage:**
- **Target:** >3 invocations/week
- **Action if Low:** Remind yourself to use the scripts!

**Staleness:**
- **Action:** Any solution not referenced in >6 months -> Review for deprecation.

### Step 3: Maintenance

1. **Fix Orphans**: Run `Call MCP call_tool_compound_manager { action: "updateRef" }` on solutions you know you've used recently.
2. **Promote Patterns**: If new pattern candidates are identified, run `/compound`.

### Step 4: Record Status

Add an entry to `docs/solutions/changelog.md` (or equivalent) noting the health stats.

### Phase 5: Completion & Handoff

#### Step 1: Establish Terminal UI State

```javascript
await task_boundary({
  TaskName: "[COMPLETED] System Health Check",
  TaskStatus: "Health checked and recorded. Offering next steps.",
  Mode: "VERIFICATION",
  TaskSummary: "Completed system health check. Grade: {grade}, Coverage: {coverage}%."
});
```

#### Step 2: Mandatory Handoff

```bash
✓ Health check complete

Next steps:
1. /housekeeping - Fix any issues found
2. /plan - Plan improvements to lower technical debt
```

---

## References

- [Health Script](Call MCP `call_tool_compound_manager` { action: "health" })
