# Compound Engineering Workflows

> **Quick Start:** New to this project? Read [critical-patterns.md](../docs/solutions/patterns/critical-patterns.md) first.
> **Technical Architecture:** For the complete system architecture, see [docs/architecture/compound-system.md](../docs/architecture/compound-system.md).

## Purpose

This directory contains workflow definitions that orchestrate the agent's compound engineering process. Workflows provide structured, repeatable sequences for planning, implementing, reviewing, and documenting work.

## Components

| Category | Workflows |
|----------|-----------|
| **Core Loop** | `/explore`, `/specs`, `/plan-compound`, `/plan_review`, `/work`, `/review-compound`, `/compound`, `/housekeeping`, `/cycle` |
| **Todo / Triage** | `/triage`, `/triage-sprint`, `/resolve_todo` |
| **Code Review** | `/resolve_pr`, `/plan_review`, `/review-compound` |
| **Architecture / Context** | `/adr`, `/map-codebase`, `/doc`, `/kit-setup` |
| **Release** | `/changelog`, `/release-docs`, `/deploy-docs` |
| **Debugging** | `/report-bug`, `/reproduce-bug` |
| **Skills & Extensions** | `/create-agent-skill`, `/heal-skill`, `/generate_command`, `/skill-review` |
| **Maintenance** | `/housekeeping`, `/compound_health`, `/promote_pattern` |

## Component Details

### 🔴 Critical Workflows

| Workflow | Purpose | When to Use |
|----------|---------|-------------|
| `plan-compound.md` | Transform features into structured plans with security & pattern checks | Before significant work |
| `work.md` | Execute work plans systematically while maintaining quality | During implementation |
| `review-compound.md` | Multi-pass code review (Security via MCP, Perf, Architecture) | After work complete |
| `compound.md` | Document reusable knowledge to compound project capability | After solving problems |

### 🟡 Supporting Workflows

| Workflow | Purpose |
|----------|---------|
| `explore.md` | Deep investigation, best practices, and systematic analysis |
| `specs.md` | Create and manage specifications for multi-session initiatives |
| `housekeeping.md` | Pre-push cleanup to archive completed items |
| `triage.md` | Prioritize findings from code reviews |

## Core Loop

```
/explore (optional) → /specs (large) → /plan-compound (per phase) → /plan_review → /work → /review-compound → /compound → /housekeeping → repeat
```

| Command | When | Purpose |
|---------|------|---------|
| `/explore` | Before planning | Deep investigation, best practices, multi-order analysis |
| `/specs` | Major initiatives | Create structured specification with phases |
| `/plan-compound` | Before sig. work | Transform descriptions into well-structured project plans |
| `/plan_review` | Pre-execution | Review implementation plans for quality and completeness |
| `/work` | Implementation | Execute work plans systematically while maintaining quality |
| `/review-compound`| Post-work | Perform comprehensive multi-pass code review with MCP security |
| `/compound` | Post-solution | Document reusable knowledge to compound project capability |
| `/cycle` | Small tasks | Orchestrate full "plan → review → work → review → compound" lifecycle |
| `/housekeeping` | Pre-push | Archive completed work, validate repo health |

## Support Commands

### Todos & Triage
| Command | Purpose |
|---------|---------|
| `/triage` | Triage and prioritize findings from code reviews |
| `/triage-sprint` | Batch process pending todos to unblock triage bottlenecks |
| `/resolve_todo` | Resolve multiple todo items efficiently |

### Code Review & Quality
| Command | Purpose |
|---------|---------|
| `/resolve_pr` | Handle PR comments and review feedback efficiently |
| `/plan_review` | Review implementation plans for quality |
| `/review-compound` | Perform multi-pass code review with security, performance, & architecture checks |

### Architecture & Context
| Command | Purpose |
|---------|---------|
| `/adr` | Create a new Architecture Decision Record |
| `/map-codebase` | Map existing codebase architecture, tech stack, and conventions |
| `/doc` | Update folder-level documentation and component changelogs |
| `/kit-setup` | Interactive project setup wizard creating context files |

### Release & Docs
| Command | Purpose |
|---------|---------|
| `/changelog` | Generate changelog entries from commits |
| `/release-docs` | Prepare release documentation |
| `/deploy-docs` | Deploy documentation updates |

### Debugging
| Command | Purpose |
|---------|---------|
| `/report-bug` | Report bugs with structured reproduction steps |
| `/reproduce-bug` | Reproduce reported bugs systematically |

### Skills & Extensions
| Command | Purpose |
|---------|---------|
| `/create-agent-skill` | Create new skills for extending agent capabilities |
| `/heal-skill` | Diagnose and fix broken skills |
| `/generate_command` | Create new workflow commands dynamically |
| `/skill-review` | Weekly review of potential new agent skills discovered from usage |

### Maintenance & Health
| Command | Purpose |
|---------|---------|
| `/compound_health` | Check the improved Compound System's health and usage metrics |
| `/promote_pattern` | Promote a recurring issue to a critical pattern |

### Platform-Specific
| Command | Purpose |
|---------|---------|
| `/xcode-test` | Run Xcode tests for iOS applications |

### Modular Skills
| Skill | Purpose | Entry Point |
|-------|---------|-------------|
| `session-resume` | Establish session state | `skills/session-resume/SKILL.md` |
| `compound-docs` | Search/Document solutions | `skills/compound-docs/SKILL.md` |
| `file-todos` | Manage file-based tasks | `skills/file-todos/SKILL.md` |
| `code-review` | Systematic quality gates | `skills/code-review/SKILL.md` |
| `testing` | Unified test patterns | `skills/testing/SKILL.md` |
| `debug` | Structured root cause analysis | `skills/debug/SKILL.md` |

---

## Before You Start Any Work

### 1. Resume Session (STRICTLY REQUIRED)

Always run this first when starting a new conversation:
```bash
# Read and follow the checklist
cat skills/session-resume/SKILL.md
```

### 2. Search Existing Solutions

```bash
# Check if this problem was solved before
grep -r "{keywords}" docs/solutions/

# Check critical patterns
cat docs/solutions/patterns/critical-patterns.md
```

### 3. Check Pending Work

```bash
# Any active specs?
ls docs/specs/*/README.md 2>/dev/null | grep -v templates

# Any ready todos?
ls todos/*-ready-*.md 2>/dev/null

# Any in-progress plans?
ls plans/*.md 2>/dev/null
```

---

## Directory Structure

```
.agent/workflows/     # You are here - all workflow commands
docs/solutions/       # Persistent knowledge base
├── patterns/         # Critical patterns (READ FIRST)
├── schema.yaml       # Solution validation schema
└── {categories}/     # Categorized solutions
docs/explorations/    # Deep investigations & research
skills/               # Modular capabilities
plans/                # Implementation plans from /plan
└── archive/          # Completed plans
todos/                # Work items from /review, /triage
└── archive/          # Completed todos
docs/specs/           # Multi-session specifications
└── archive/          # Completed specs
```

---

## Key Principles

1. **Search before solving** - Check `docs/solutions/` and `docs/explorations/`
2. **Document after solving** - Run `/compound` when you fix something
3. **Follow patterns** - Reference `critical-patterns.md`
4. **Create todos for deferred work** - Don't just document in artifacts
5. **Use conventional commits** - Enables changelog automation
6. **Housekeeping before push** - Run `/housekeeping` to archive completed work

---

## Changelog

### 2026-01-24
- Added Purpose, Components, and Component Details sections
- Restructured for documentation validation compliance

### 2025-12-20
- Added modular skills section
- Updated core loop documentation
