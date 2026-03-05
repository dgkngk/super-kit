# Compound System Architecture

> **Core Principle**: Each unit of engineering work should make subsequent units of work easier—not harder.

## Overview

The Compound System transforms Super-Kit from a session-to-session amnesiac into a learning partner that compounds its capabilities over time.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      COMPOUND SYSTEM FLOW                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   🔍 EXPLORE        📋 PLAN          ⚙️ WORK          👀 REVIEW     │
│   Deep research   Create plan    Implement        Validate         │
│        │               │              │               │             │
│        └───────────────┴──────────────┴───────────────┘             │
│                                │                                    │
│                                ▼                                    │
│                        📚 COMPOUND                                  │
│                    Document solution                                │
│                                │                                    │
│                                ▼                                    │
│                    ┌───────────────────┐                           │
│                    │  KNOWLEDGE BASE   │◄──────────────────┐       │
│                    │  docs/solutions/  │                   │       │
│                    └───────────────────┘                   │       │
│                                │                           │       │
│                                ▼                           │       │
│                        🧹 HOUSEKEEPING                     │       │
│                      Archive & cleanup                     │       │
│                                │                           │       │
│                                └───────────────────────────┘       │
│                                        (Next session)               │
└─────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Knowledge Base (`docs/solutions/`)

Persistent storage for solved problems:

```
docs/solutions/
├── schema.yaml              # Validation schema
├── solution-template.md     # Template for new solutions
├── patterns/
│   └── critical-patterns.md # 23 anti-patterns
└── {category}/
    └── {solution}.md        # Individual solutions
```

**Key features:**
- YAML frontmatter for searchability
- Categories mapped to problem types
- Schema validation ensures consistency

### 2. Skills System (`skills/`)

Modular capabilities that agents can invoke:

| Skill | Purpose |
|-------|---------|
| `session-resume` | Restore context at session start |
| `compound-docs` | Search and document solutions |
| `file-todos` | Manage file-based tasks |
| `code-review` | Systematic quality gates |
| `testing` | Unified test patterns |
| `debug` | Structured root cause analysis |

### 3. Workflows (`skills/workflows/`)

32 structured workflows for systematic development:

**Core Loop:**
- `/explore` → Deep investigation
- `/plan` → Create implementation plan
- `/work` → Execute plan
- `/review` → Validate changes
- `/compound` → Document solutions
- `/housekeeping` → Archive and cleanup

### 4. MCP Tools

All automation is provided through MCP tools:

| Category | MCP Tool |
|----------|----------|
| Search | `call_tool_compound_manager` { action: "search" } |
| Health | `call_tool_compound_manager` { action: "dashboard" / "health" } |
| Todos | `call_tool_todo_manager` { action: "create" / "done" } |
| Validation | `call_tool_docs_manager` { action: "validate" } |
| Metrics | `call_tool_logger_manager` { action: "logSkill" / "logWorkflow" } |

### 5. Telemetry (`docs/agents/logs/`)

Track system health and usage:

```
docs/agents/
└── logs/
    ├── compound_usage.log     # Search usage
    └── workflow_usage.log     # Workflow invocations
```

## The Compound Loop

```
/explore → /plan → /work → /review → /compound → /housekeeping → repeat
```

1. **Explore**: Research before deciding (optional, for complex problems)
2. **Plan**: Create detailed implementation plan
3. **Work**: Execute the plan systematically
4. **Review**: Validate changes meet criteria
5. **Compound**: Document the solution for future reference
6. **Housekeeping**: Archive completed work, maintain clean state

## Integration with Super-Kit

### Learning System Bridge

Super-Kit's `kit_save_learning` + Compound's Knowledge Base:

| Super-Kit | Compound System |
|------------|-----------------|
| `kit_save_learning` | Quick preference capture |
| `docs/solutions/` | Detailed solution documentation |
| Session-scoped | Project-persistent |

### Agent Behaviors

Agents should:
1. **Search before solving**: MCP `call_tool_compound_manager` { action: "search" }
2. **Document after solving**: `/compound` workflow
3. **Check health daily**: MCP `call_tool_compound_manager` { action: "dashboard" }
4. **Resume context**: Read `skills/session-resume/SKILL.md`

## Health Monitoring

```bash
# Daily quick check
Call MCP `call_tool_compound_manager` { action: "dashboard" }

# Weekly deep check
Call MCP `call_tool_compound_manager` { action: "health" }
```

**Target**: Grade B or higher

## References

- [Critical Patterns](../solutions/patterns/critical-patterns.md)
- [Schema](../solutions/schema.yaml)
- [Workflows README](../../skills/workflows/README.md)
