# Claude Code Plugin Marketplace Support — Design Spec

**Date:** 2026-03-12
**Status:** Approved for implementation

## Goal

Make super-kit installable as a single Claude Code plugin. Users add the GitHub repo as a marketplace source and run one install command to get the full super-kit experience: MCP server auto-configured, 69 skills discoverable in the skill browser, 19 agents available, SUPERKIT.md injected at session start, and all slash commands working.

## Background

Claude Code's plugin system (discovered by inspecting `~/.claude/plugins/`) supports two marketplace models:

- **Multi-plugin marketplace** — a GitHub repo acting as a directory of plugins (`anthropics/claude-plugins-official`)
- **Single-plugin repo** — the GitHub repo IS the plugin (`thedotmack/claude-mem`)

We use the **single-plugin repo** model. It is simpler and appropriate for super-kit's cohesive scope.

When a user adds `github:USERNAME/super-kit` as a marketplace source, they install via:
```
/plugin install super-kit@USERNAME
```
The `@USERNAME` is the marketplace identifier (GitHub username/org), not the repo name. This matches the observed pattern: `claude-mem@thedotmack` comes from `thedotmack/claude-mem`.

## Architecture

### Required Plugin Files

```
super-kit/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata (required by Claude Code)
├── .mcp.json                # MCP server auto-configuration
├── hooks/
│   ├── hooks.json           # Hook event definitions
│   ├── run-hook.cmd         # Cross-platform Windows/Unix wrapper
│   └── session-start        # Bash script: reads SUPERKIT.md, outputs JSON
├── agents/                  # Existing — no changes needed
├── commands/                # Existing — no changes needed (served via MCP)
├── skills/                  # Existing — frontmatter standardization needed
└── SUPERKIT.md              # Target: slimmed to <100 lines (see Prerequisites)
```

### `.claude-plugin/plugin.json`

```json
{
  "name": "super-kit",
  "version": "1.3.0",
  "description": "Super Engineer Team — a full AI engineering team for Claude Code. Includes 19 specialized agents (planner, coder, tester, reviewer, debugger and more), 69 skills, slash commands, and an MCP server with semantic context search.",
  "author": {
    "name": "Super-Kit"
  },
  "repository": "https://github.com/YOUR_USERNAME/super-kit",
  "license": "MIT"
}
```

### `.mcp.json`

The `mcpServers` wrapper and `"type": "stdio"` are required (observed in `claude-mem`'s `.mcp.json`). Uses `npx -y` so no global install is required.

```json
{
  "mcpServers": {
    "superkit": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "superkit-mcp-server@latest"]
    }
  }
}
```

### `hooks/hooks.json`

Defines the SessionStart event. Matcher `"startup|clear|compact"` is the pattern used by real plugins. Uses the cross-platform `run-hook.cmd` wrapper (required for Windows).

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" session-start",
            "async": false
          }
        ]
      }
    ]
  }
}
```

### `hooks/run-hook.cmd`

Cross-platform polyglot script (same pattern as superpowers plugin). On Windows, it finds bash (Git Bash, MSYS2) and delegates. On Unix, it executes the script directly. Exits silently if no bash found — the plugin still works without the context injection.

```bash
: << 'CMDBLOCK'
@echo off
REM Cross-platform polyglot wrapper for hook scripts.

if "%~1"=="" (
    echo run-hook.cmd: missing script name >&2
    exit /b 1
)

set "HOOK_DIR=%~dp0"

if exist "C:\Program Files\Git\bin\bash.exe" (
    "C:\Program Files\Git\bin\bash.exe" "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)
if exist "C:\Program Files (x86)\Git\bin\bash.exe" (
    "C:\Program Files (x86)\Git\bin\bash.exe" "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)
where bash >nul 2>nul
if %ERRORLEVEL% equ 0 (
    bash "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)
exit /b 0
CMDBLOCK

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_NAME="$1"
shift
exec bash "${SCRIPT_DIR}/${SCRIPT_NAME}" "$@"
```

### `hooks/session-start`

Bash script that reads SUPERKIT.md, escapes it for JSON embedding, and outputs the structure Claude Code expects. Both `hookSpecificOutput.additionalContext` (Claude Code) and `additional_context` (Cursor) fields are handled based on environment detection.

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

superkit_content=$(cat "${PLUGIN_ROOT}/SUPERKIT.md" 2>/dev/null || echo "")

escape_for_json() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

content_escaped=$(escape_for_json "$superkit_content")

if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "${content_escaped}"
  }
}
EOF
else
  cat <<EOF
{
  "additional_context": "${content_escaped}"
}
EOF
fi
```

## Skill Frontmatter Standardization

### Problem

69 SKILL.md files exist across `skills/tech/` and `skills/meta/`. The plugin skill browser requires `name` and `description` in YAML frontmatter. The `version` field is **not required** (the superpowers plugin's 36 skills have no `version` field and work correctly). Only `name` and `description` matter for discoverability.

### Required Frontmatter Fields

```yaml
---
name: skill-name
description: When to use this skill — trigger conditions, keywords, topic areas.
allowed-tools: Read, Write, Edit, Glob, Grep   # optional, keep if already present
---
```

### Scope

All 69 SKILL.md files in `skills/tech/*/SKILL.md` and `skills/meta/*/SKILL.md`:
- Files already having `name` + `description` frontmatter: **no changes needed**
- Files missing frontmatter or missing `description`: add/complete the frontmatter block

The `description` field drives discovery. It must describe activation conditions:
- ❌ `"API design principles"`
- ✅ `"API design and decision-making. REST vs GraphQL vs tRPC selection, response formats, versioning, pagination."`

The nested directory structure (`skills/tech/api-patterns/SKILL.md`) is compatible with Claude Code's recursive SKILL.md scanner — no restructuring needed.

## README Updates

Add a "Claude Code Plugin" section near the top of README.md:

```markdown
## Install as Claude Code Plugin

1. Open Claude Code → `/plugin` → **Discover** → **Add source**
2. Enter: `github:YOUR_USERNAME/super-kit`
3. Install: `/plugin install super-kit@YOUR_USERNAME`

This configures the MCP server automatically and makes all skills, agents, and commands available.

**Requirements:** Node.js 18+ (for `npx superkit-mcp-server@latest`)
```

## Prerequisites

**SUPERKIT.md must be slimmed before or as part of this implementation.** The current master branch has SUPERKIT.md at 198 lines. The context management feature branch (`feature/context-management-rag`) slims it to 89 lines. This branch must be merged first, OR the slimming work must be included in this implementation.

A 198-line SUPERKIT.md injected at every session start is undesirable. Target: under 100 lines.

## What Users Get After Install

| Feature | How it works |
|---------|-------------|
| MCP server | `.mcp.json` → `npx -y superkit-mcp-server@latest` auto-registered |
| 69 skills | Discoverable in `/skills` browser via SKILL.md frontmatter |
| 19 agents | Available via `load_superkit_agent` MCP tool |
| Session context | `hooks/session-start` injects SUPERKIT.md at startup |
| Slash commands | Served via MCP GetPromptRequestSchema (`/plan`, `/work`, `/brainstorm`, etc.) |
| Semantic search | `search_context`, `recall_memory` MCP tools (from context management feature) |

## File Changeset

| Action | Path | Notes |
|--------|------|-------|
| Create | `.claude-plugin/plugin.json` | Plugin metadata |
| Create | `.mcp.json` | MCP server with `mcpServers` wrapper + `type: stdio` |
| Create | `hooks/hooks.json` | SessionStart hook definition |
| Create | `hooks/run-hook.cmd` | Cross-platform Windows/Unix wrapper |
| Create | `hooks/session-start` | Bash script outputting `hookSpecificOutput.additionalContext` JSON |
| Modify | Skills missing `name`/`description` frontmatter | Add/complete frontmatter |
| Modify | `README.md` | Add plugin install section with correct `@USERNAME` syntax |
| Prerequisite | Merge `feature/context-management-rag` | Provides slimmed SUPERKIT.md |

## Out of Scope

- Converting `.toml` commands to plugin markdown format — they work via MCP as-is
- Submitting to `anthropics/claude-plugins-official` — requires Anthropic approval; this spec covers making the repo self-installable first
- Agent frontmatter standardization — plugin `agents/` format is undocumented; existing `.md` files work via `load_superkit_agent` MCP tool
- Adding `version: 1.0.0` to all skills — not required by Claude Code's skill browser

## Success Criteria

- [ ] `.claude-plugin/plugin.json`, `.mcp.json`, all hook files exist and are valid
- [ ] `hooks/session-start` outputs valid JSON with `hookSpecificOutput.additionalContext`
- [ ] A fresh install registers `superkit` in the MCP server list
- [ ] At least 10 skills appear in the `/skills` browser after install
- [ ] SUPERKIT.md content appears in session-start system-reminder
- [ ] All existing tests pass (no regressions)
- [ ] README install instructions use correct `@USERNAME` syntax
