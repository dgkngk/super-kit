---
description: Generate changelog entries from commits. Use before releases.
---

# /changelog - Generate Changelog

Create changelog entries from git history automatically using conventional commits.

## Workflow

### Step 0: Search & Log

```bash
// turbo
Call MCP `call_tool_logger_manager` { action: "logWorkflow", name: "/changelog", outcome: "success" }
Call MCP `call_tool_compound_manager` { action: "search", terms: [ "changelog generation"] }
```

### Step 1: Run Generation Script

```bash
npm run changelog:gen
```

This script will:
1. Find the latest git tag
2. Parse all commits since that tag
3. Group them by type (feat, fix, docs, etc.)
4. Prepend a new entry to `CHANGELOG.md`

### Step 2: Review and Edit

Open `CHANGELOG.md` and review the generated entry:

- [ ] Check for duplicate entries
- [ ] Improve descriptions where needed
- [ ] Group breaking changes under a "BREAKING CHANGES" section if not auto-detected

### Step 3: Commit Changes

```bash
git add CHANGELOG.md
git commit -m "docs: update changelog"
```

### Phase 5: Completion & Handoff

#### Step 1: Establish Terminal UI State

```javascript
await task_boundary({
  TaskName: "[COMPLETED] Generate Changelog",
  TaskStatus: "Changelog generated. Offering next steps.",
  Mode: "VERIFICATION",
  TaskSummary: "Generated changelog for versions {versions}."
});
```

#### Step 2: Mandatory Handoff

```bash
✓ Changelog updated

Next steps:
1. /release-docs - Prepare release documentation
2. /housekeeping - Cleanup before push
```

---

## References

- Implementation: `Call MCP `call_tool_git_manager` { action: "changelog" }`
- Version documentation: `/release-docs`
