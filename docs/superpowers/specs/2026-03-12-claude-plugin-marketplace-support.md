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

## Architecture

### Required Plugin Files

```
super-kit/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata (required by Claude Code)
├── .mcp.json                # MCP server auto-configuration
├── hooks/
│   └── hooks.json           # Session-start SUPERKIT.md injection
├── agents/                  # Existing — no changes needed
├── commands/                # Existing — no changes needed (served via MCP)
├── skills/                  # Existing — frontmatter standardization needed
└── SUPERKIT.md              # Existing — already slimmed to 89 lines
```

### `.claude-plugin/plugin.json`

Required by Claude Code to recognise the repo as a plugin. Minimal metadata.

```json
{
  "name": "super-kit",
  "description": "Super Engineer Team — a full AI engineering team for Claude Code. Includes 19 specialized agents (planner, coder, tester, reviewer, debugger and more), 69 skills, slash commands, and an MCP server with semantic context search.",
  "author": {
    "name": "Super-Kit"
  }
}
```

### `.mcp.json`

Tells Claude Code to register `superkit-mcp-server` automatically on install. Uses `npx -y` so no global install is required.

```json
{
  "superkit": {
    "command": "npx",
    "args": ["-y", "superkit-mcp-server@latest"]
  }
}
```

### `hooks/hooks.json`

Injects SUPERKIT.md as a system-reminder at every session start. `${CLAUDE_PLUGIN_ROOT}` resolves to the plugin's install path. Output of the command is injected as context.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "cat \"${CLAUDE_PLUGIN_ROOT}/SUPERKIT.md\"",
            "async": false
          }
        ]
      }
    ]
  }
}
```

SUPERKIT.md was slimmed to 89 lines in a previous session. Session-start injection cost is minimal.

## Skill Frontmatter Standardization

### Problem

69 SKILL.md files exist across `skills/tech/` and `skills/meta/`. The plugin skill browser requires each skill to have `name`, `description`, and optionally `version` in YAML frontmatter. Many skills already have frontmatter in super-kit's existing format; all need `version: 1.0.0` added and descriptions verified.

### Frontmatter Format

```yaml
---
name: skill-name
description: When to use this skill — trigger conditions, keywords, topic areas.
allowed-tools: Read, Write, Edit, Glob, Grep   # optional, super-kit extension
version: 1.0.0
---
```

The `description` field drives discovery. It should describe activation conditions, not just the skill's domain. Example:

- ❌ `"API design principles"`
- ✅ `"API design principles and decision-making. REST vs GraphQL vs tRPC selection, response formats, versioning, pagination."`

### Scope

All 69 SKILL.md files in `skills/tech/*/SKILL.md` and `skills/meta/*/SKILL.md`:
- Files with existing frontmatter: add `version: 1.0.0`, verify description quality
- Files missing frontmatter entirely: add complete frontmatter block

The nested directory structure (`skills/tech/api-patterns/SKILL.md`) is compatible with Claude Code's recursive SKILL.md scanner — no restructuring needed.

## README Updates

Add a "Claude Code Plugin" section near the top of README.md:

```markdown
## Install as Claude Code Plugin

1. Open Claude Code → `/plugin` → **Discover** → **Add source**
2. Enter: `github:YOUR_USERNAME/super-kit`
3. Install: `/plugin install super-kit@super-kit`

This configures the MCP server automatically and makes all skills, agents, and commands available.

**Requirements:** Node.js 18+ (for `npx superkit-mcp-server@latest`)
```

## What Users Get After Install

| Feature | How it works |
|---------|-------------|
| MCP server | `.mcp.json` → `npx -y superkit-mcp-server@latest` auto-registered |
| 69 skills | Discoverable in `/skills` browser via SKILL.md frontmatter |
| 19 agents | Available via `load_superkit_agent` MCP tool |
| Session context | `hooks/hooks.json` injects SUPERKIT.md at start |
| Slash commands | Served via MCP GetPromptRequestSchema (`/plan`, `/work`, `/brainstorm`, etc.) |
| Semantic search | `search_context`, `recall_memory` MCP tools from context management system |

## File Changeset

| Action | Path | Notes |
|--------|------|-------|
| Create | `.claude-plugin/plugin.json` | 8 lines |
| Create | `.mcp.json` | 6 lines |
| Create | `hooks/hooks.json` | 16 lines |
| Modify | 69 × `skills/**/SKILL.md` | Add `version: 1.0.0`, fix descriptions |
| Modify | `README.md` | Add plugin install section |

## Out of Scope

- Converting `.toml` commands to plugin markdown format — they are served via MCP and work fine as-is
- Submitting to `anthropics/claude-plugins-official` — that requires Anthropic approval; this spec covers making the repo self-installable first
- Agent frontmatter standardization — the plugin `agents/` format is undocumented; existing `.md` files work via `load_superkit_agent` MCP tool

## Success Criteria

- [ ] A fresh Claude Code install can add the repo as a marketplace source
- [ ] `/plugin install super-kit@super-kit` completes without error
- [ ] MCP server appears in active servers after install
- [ ] At least 10 skills appear in the `/skills` browser
- [ ] SUPERKIT.md content appears in session-start system-reminder
- [ ] All 142 existing tests still pass
