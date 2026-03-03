---
description: (Compound) Perform comprehensive multi-pass code review with security, performance, and architecture checks.
---

# /review-compound - Comprehensive Code Review

Perform exhaustive code reviews using multi-perspective analysis to catch issues before they ship.

> **Sequential Review:** Unlike parallel agent systems, this review runs sequentially through each review perspective. Focus on depth over breadth.
>
> **Note:** This is the Compound version with multi-pass review. For quick review, use `/review`.


## When To Use

- Before merging any PR
- Self-review before pushing
- After `/work` completion
- When reviewing others' code

---

## Workflow

### Step -1: Resume Context (If New Session)

> [!CAUTION]
> **BLOCKING STEP.** If this is a NEW CONVERSATION, follow the session-resume skill first.

```bash
cat skills/session-resume/SKILL.md
./scripts/log-skill.sh "session-resume" "workflow" "/review"
```

### Step 0: Load Code Review Skill (MANDATORY)

> [!TIP]
> Use the **code-review skill** for checklists, security guards, and reference patterns.

```bash
# Data collection
./scripts/log-workflow.sh "/review" "$$"

cat skills/code-review/SKILL.md
./scripts/log-skill.sh "code-review" "workflow" "/review"
```

### Step 1: Determine Review Target

**Identify what to review:**

| Input | Action |
|-------|--------|
| PR number | `gh pr view {number} --json title,body,files` |
| GitHub URL | Extract PR number, fetch metadata |
| Branch name | `git diff main...{branch}` |
| Empty | Review current branch vs main |

**Setup:**
```bash
# If reviewing a PR, checkout the branch
gh pr checkout {PR_NUMBER}

# Or compare current branch
git diff main --stat
```

### Step 2: Gather Context

Before reviewing, understand:

- [ ] **What changed:** Files modified, lines added/removed
- [ ] **Why it changed:** PR description, linked issues
- [ ] **What's affected:** Dependencies, downstream code

**Prior Knowledge Check:**
> Use search to find similar past issues or patterns.

```bash
./scripts/compound-search.sh "{change type or component keywords}"
```

```bash
# View changed files
git diff main --name-only

# View detailed changes
git diff main
```

### Step 3: Sequential Review Passes

Run through each review perspective sequentially:

---

#### Pass 1: 🔒 Security Review

**Action:** Perform a comprehensive security review utilizing `@mcp:superkit` security analysis capabilities.

- [ ] Use `@mcp:superkit` to execute a security audit on the modified files to check for vulnerabilities.
- [ ] Have you verified there are NO hardcoded secrets?
- [ ] Have you verified Auth guards and Access Controls?
- [ ] If vulnerabilities are found, produce a structured report and actionable recommendations assigning severity using the Security Severity Assessment rubric.

```bash
# Optional manual fallback if @mcp:superkit tools are unavailable for specific checks
grep -rn "eval\|exec\|dangerouslySetInnerHTML" --include="*.ts" --include="*.js" src/
grep -rn "password\|secret\|api_key" --include="*.ts" --include="*.js" src/
```

---

#### Pass 2: ⚡ Performance Review

Check for:
- [ ] Unnecessary re-renders
- [ ] N+1 queries
- [ ] Large bundle sizes

```bash
# Look for loop patterns with async calls
grep -rn "forEach.*await\|map.*await" --include="*.ts" src/
```

---

#### Pass 3: 🏛️ Architecture & Visual Review

Check structural integrity and visual communication:

- [ ] **Single Responsibility:** Each function does one thing?
- [ ] **Dependencies:** Proper layering? No circular deps?
- [ ] **Schematics:** Are complex workflows visually documented (mermaid/diagrams)?
- [ ] **Naming:** Clear, consistent naming?
- [ ] **Patterns:** Following project conventions?
- [ ] **Tests:** Adequate test coverage?

---

#### Pass 4: 💾 Data Integrity Review

Check database and data handling:

- [ ] **Migrations:** Reversible? Production-safe?
- [ ] **Transactions:** Multi-step ops wrapped?
- [ ] **Constraints:** Foreign keys, unique constraints?
- [ ] **Nullability:** Null cases handled?

---

#### Pass 5: 🎯 Simplicity Review

Check for unnecessary complexity:

- [ ] **YAGNI:** Features not needed yet?
- [ ] **Dead Code:** Unused imports, functions?
- [ ] **Over-Engineering:** Simpler solution exists?
- [ ] **Duplication:** Code that should be extracted?

---

#### Pass 6: 🔬 Algorithmic & State Rigor (Scientific Review)

Apply rigorous scientific evaluation to the core logic:

- [ ] **Circular Logic Check:** Are conclusions/states derived independently?
- [ ] **Control Variables:** Are side-effects properly controlled/isolated?
- [ ] **Statistical/Algorithmic Soundness:** Are the algorithms appropriate for the scale? Are edge-cases proven handled?
- [ ] **Reproducibility:** If this fails in production, is there enough logging to perfectly reproduce the state?

---

### Step 4: Stakeholder Perspective Analysis

Think through each stakeholder's view:

| Stakeholder | Key Questions |
|-------------|---------------|
| **Developer** | Is this easy to understand/modify? Can I test this? |
| **Operations** | How do I deploy safely? What metrics available? |
| **End User** | Is it intuitive? Good error messages? |
| **Security** | What's the attack surface? Data protected? |
| **Business** | Does this solve the problem? Any risks? |

### Step 5: Scenario Exploration

Test mental models against edge cases:

- [ ] **Happy Path:** Normal operation works?
- [ ] **Invalid Inputs:** Handles null, empty, malformed?
- [ ] **Boundary Conditions:** Min/max values?
- [ ] **Concurrent Access:** Race conditions?
- [ ] **Failures:** Network issues, timeouts?

### Step 6: Synthesize Findings

Categorize all findings by severity:

**🔴 P1 - Critical (Must fix before merge):**
- Security vulnerabilities
- Data loss risks
- Breaking changes without migration

**🟡 P2 - Important (Should fix):**
- Performance issues
- Missing error handling
- Test coverage gaps

**🔵 P3 - Nice to Have (Consider for follow-up):**
- Style improvements
- Minor refactors
- Documentation updates
- Changelog entry missing (run `npm run changelog:gen`)

### Step 7: Create Actionable Todos & Capture Deferred Work

For each P1/P2 finding, create a todo.

**Crucially, capture DEFERRED WORK here:**
- [ ] Are there P3 items we decided not to do now?
- [ ] Did we reject alternatives that have future value?
- [ ] Are there implementation tasks left over from `/work`?

> [!IMPORTANT]
> **Single Source of Truth.** If you close/reject a PR or defer work for later, that work **must** become a todo file NOW. Do not rely on capturing it later in `/compound`.

```bash
# Create todos using the centralized generator
./scripts/create-todo.sh "p1" "Security: SQL Injection in User Query" \
  "Raw user input is used in database query at src/api/users.ts:45. This enables potential SQL injection attacks allowing unauthorized data access." \
  "Replace raw query with parameterized version" \
  "Add input validation" \
  "Add test case for injection attempt"
```

### Step 8: Generate Review Summary

```markdown
## Peer Review Report: {PR Title}

**Reviewed:** {date}
**Files Changed:** {count}
**Lines:** +{added} / -{removed}

### Summary Statement
Provide a concise overall assessment containing:
- Brief synopsis of the changes
- Overall recommendation (APPROVE, REQUEST_CHANGES, NEEDS_DISCUSSION)
- Key strengths
- Key weaknesses

### Major Comments (Critical/P1)
Critical flaws that must be addressed (security, architectural errors, data loss):
- 1. {Finding 1} - *Suggested fix*
- 2. {Finding 2} - *Suggested fix*

### Minor Comments (P2/P3)
Important to Nice-to-Have improvements (performance, conventions, dead code):
- 1. {Finding 1} - *Suggested fix*
- 2. {Finding 2} - *Suggested fix*

### Questions for Author
Requests for clarification, unstated assumptions, or missing reproduction steps:
- 1. Why was {approach} chosen over {alternative}?
- 2. How are we handling {edge case} in {file}?

### Next Steps
- [ ] Address Major Comments
- [ ] Answer Questions
- [ ] Create follow-up issues for Minor Comments (if deferred)
```

### Step 9: Offer Next Actions

```
✓ Review complete

Findings: {P1_count} critical, {P2_count} important, {P3_count} nice-to-have

What's next?
1. Address findings - Fix critical issues first
2. Approve - No blocking issues found
3. Create follow-up issues - For P3 items
4. Document learnings - Run /compound if found interesting patterns
```

### Step 10: Compound Learning

Before closing the review, ask yourself:

- Did you discover a reusable pattern?
- Did you find a non-obvious solution?
- Would this help future agents/developers?

If **yes** to any → Run `/compound` to document the learning.

**See also:** `skills/compound-docs/SKILL.md` for pattern promotion guidelines.

> [!TIP]
> Reviews often surface insights that aren't captured in the code itself. Don't let them evaporate.

### Step 11: Final Validation Gate

> [!CAUTION]
> **Do not skip.**

Before closing, run:
```bash
./scripts/validate-compound.sh
```

- [ ] Script passed?
- [ ] Deferred work converted to todos?

---

## Quality Guidelines

**Thorough reviews:**
- ✅ Check every changed file
- ✅ Think about edge cases
- ✅ Consider the broader system
- ✅ Provide actionable feedback

**Avoid:**
- ❌ Rubber-stamping without reading
- ❌ Style-only feedback
- ❌ Vague comments ("this could be better")
- ❌ Missing the forest for the trees

---

## References

- Create todos: `todos/` directory
- Document patterns: `/compound`
- Execute fixes: `/work`

---

### Phase 5: Completion & Handoff

#### Step 1: Establish Terminal UI State

> [!IMPORTANT]
> **Visual Completion Signal**
> Call `task_boundary` one last time to signal completion in the user's UI. This prevents the "task" from appearing active after you've finished.

```javascript
await task_boundary({
  TaskName: "[COMPLETED] Review: {PR Title / Target}",
  TaskStatus: "Review complete. Findings categorized. Offering next steps.",
  Mode: "VERIFICATION",
  TaskSummary: "Completed comprehensive review. Identified {P1_count} critical, {P2_count} important, and {P3_count} nice-to-have items."
});
```

#### Step 2: Mandatory Handoff

> [!IMPORTANT]
> **Exit Transition**
> Do not stop here. Choose your next move based on the review outcome.

```bash
✓ Review complete

Findings: {P1_count} critical, {P2_count} important, {P3_count} nice-to-have

Next steps:
1. /triage - Prioritize and plan fixes for P1/P2 findings
2. /work - Start implementing immediate fixes (Self-Review)
3. /housekeeping - Cleanup and archive if no immediate work remains
4. /compound - Document interesting patterns/solutions discovered
```

