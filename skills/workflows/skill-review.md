---
description: Weekly review of potential new agent skills discovered from usage patterns
---

# /skill-review - Process Skill Suggestions

Systematically review and promote suggested skills to formal capabilities.

> **Why review skills?** The system automatically suggests new skills based on user requests (e.g., "run tests", "check logs"). Reviewing these suggestions allows the agent to evolve its capabilities organically.

## When To Use

- Weekly (Mondays) as part of system health checks
- When `skill_suggestions.csv` grows large (>50 lines)
- Before creating a new skill manually

---

## Workflow

### Step 0: Search Before Solving

```bash
// turbo
Call MCP `call_tool_logger_manager` { action: "logWorkflow", name: "/skill-review", outcome: "success" }
Call MCP `call_tool_compound_manager` { action: "search", terms: [ "skill patterns" "agent capabilities"] }
Call MCP `call_tool_logger_manager` { action: "logSkill", name: "compound-docs", outcome: "workflow" }
```

---

### Step 1: Analyze Suggestions

1. **Check suggestion volume:**
   ```bash
   wc -l .agent/logs/skill_suggestions.csv
   ```

2. **View unique suggestions:**
   ```bash
   cut -d',' -f1 .agent/logs/skill_suggestions.csv | sort | uniq -c | sort -nr | head -20
   ```

3. **Identify candidates:**
   Look for high-frequency requests that aren't yet skills.
   - *Example:* "run_tests" (15 times) → Candidate for `testing` skill (or finding why it's not used)
   - *Example:* "deploy_app" (8 times) → Candidate for `deployment` skill

---

### Step 2: Validate Candidates

For each top candidate:

1. **Check if it already exists:**
   ```bash
   grep -r "{keyword}" skills/
   ```
   *If it exists but isn't being used: Investigate discoverability.*

2. **Check for existing solutions:**
   ```bash
   Call MCP `call_tool_compound_manager` { action: "search", terms: [ "{candidate name}"] }
   ```

---

### Step 3: Promote or Archive

#### Option A: Promote to New Skill
If a clear gap exists:

1. Run `/create-agent-skill`
2. Name it clearly (e.g., `deployment`, `database-migration`)
3. Implement core patterns

#### Option B: Alias to Existing Skill
If it's a synonym for an existing skill:

1. Add keywords to the existing `SKILL.md` description
2. Update `.agent/workflows/README.md` to reference it

#### Option C: Archive (Low Value)
If it's noise or one-off:
- Ignore it.

---

### Step 4: Maintenance

**Rotate the log file:**

> [!IMPORTANT]
> Clear the suggestions log after review to reset the signal-to-noise ratio.

```bash
# Append to archive
cat .agent/logs/skill_suggestions.csv >> .agent/logs/skill_suggestions_archive.csv

# Clear active log
printf "suggestion,context,count\n" > .agent/logs/skill_suggestions.csv
```

---

### Phase 5: Completion & Handoff

#### Step 1: Establish Terminal UI State

```javascript
await task_boundary({
  TaskName: "[COMPLETED] Skill Review",
  TaskStatus: "Suggestions processed. Offering next steps.",
  Mode: "VERIFICATION",
  TaskSummary: "Reviewed top skill suggestions. Promoted X, Archived Y. Cleared suggestions log."
});
```

#### Step 2: Mandatory Handoff

```bash
✓ Skill review complete

Next steps:
1. /create-agent-skill - If you identified a new skill to build
2. /housekeeping - If finished
```
