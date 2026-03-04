# Commands

This directory contains all **custom slash commands** for the Super-Kit extension. Commands are defined as TOML files and automatically loaded by the AI agent client.

## Overview

Commands extend Super-Kit's capabilities by providing specialized prompts for specific tasks. Each command file follows the TOML format with `description` and `prompt` fields.

## Command Categories

| Category | Commands | Purpose |
|----------|----------|---------|
| **Planning** | `plan`, `brainstorm` | Create implementation plans |
| **Coding** | `code`, `fix`, `debug`, `fullstack` | Write and debug code |
| **Review** | `review`, `review-pr`, `pr` | Code review and PR management |
| **Documentation** | `docs`, `doc-rules`, `help` | Documentation tasks |
| **Project** | `project`, `pm`, `status` | Project management |
| **Git** | `git`, `session` | Git and session management |
| **Research** | `research`, `scout`, `scout-ext` | Codebase exploration |
| **Content** | `content`, `copywrite`, `chat` | Content creation |
| **Database** | `db` | Database operations |
| **Design** | `design` | UI/UX design tasks |
| **Testing** | `test` | Testing and QA |
| **Tools** | `mcp`, `skill`, `screenshot`, `video` | Tool integrations |

## Components

| Component | Purpose | Status |
|-----------|---------|--------|
| `ask.toml` | General Q&A with context | ✅ Active |
| `brainstorm.toml` | Creative ideation | ✅ Active |
| `chat.toml` | Conversational interactions | ✅ Active |
| `code.toml` | Code implementation | ✅ Active |
| `code-preview.toml` | Code preview mode | ✅ Active |
| `content.toml` | Content creation | ✅ Active |
| `cook.toml` | Execute plans step-by-step | ✅ Active |
| `copywrite.toml` | Marketing copy | ✅ Active |
| `db.toml` | Database operations | ✅ Active |
| `debug.toml` | Debugging assistance | ✅ Active |
| `design.toml` | UI/UX design | ✅ Active |
| `dev-rules.toml` | Development rules loader | ✅ Active |
| `do.toml` | Quick task execution | ✅ Active |
| `doc-rules.toml` | Documentation rules | ✅ Active |
| `docs.toml` | Documentation management | ✅ Active |
| `fix.toml` | Bug fixing | ✅ Active |
| `fullstack.toml` | Full-stack development | ✅ Active |
| `git.toml` | Git operations | ✅ Active |
| `help.toml` | Help and guidance | ✅ Active |
| `integrate.toml` | Integration tasks | ✅ Active |
| `journal.toml` | Session journaling | ✅ Active |
| `kit-setup.toml` | Project setup wizard | ✅ Active |
| `mcp.toml` | MCP server management | ✅ Active |
| `orchestration.toml` | Multi-agent orchestration | ✅ Active |
| `plan.toml` | Implementation planning | ✅ Active |
| `pm.toml` | Project management | ✅ Active |
| `pr.toml` | Pull request creation | ✅ Active |
| `project.toml` | Project context | ✅ Active |
| `research.toml` | Research tasks | ✅ Active |
| `review-pr.toml` | PR review | ✅ Active |
| `review.toml` | Code review | ✅ Active |
| `scout-ext.toml` | Extended codebase exploration | ✅ Active |
| `scout.toml` | Codebase scout | ✅ Active |
| `screenshot.toml` | Screenshot capture | ✅ Active |
| `session.toml` | Session management | ✅ Active |
| `skill.toml` | Skill creation | ✅ Active |
| `status.toml` | Status reporting | ✅ Active |
| `team.toml` | Team coordination | ✅ Active |
| `test.toml` | Testing tasks | ✅ Active |
| `ticket.toml` | Issue/ticket management | ✅ Active |
| `use.toml` | Use existing patterns | ✅ Active |
| `video.toml` | Video processing | ✅ Active |
| `watzup.toml` | Quick status check | ✅ Active |
| `workflow.toml` | Workflow management | ✅ Active |

## TOML Structure

Each command file follows this structure:

```toml
description = "Brief description shown in command list"

prompt = '''
# Command Name

{{args}} - User input passed to the command

## Instructions
...
'''
```

### String Types

- **Basic string** (`"""..."""`): Processes escape sequences
- **Literal string** (`'''...'''`): Raw content, no escape processing (preferred for complex prompts with code blocks)

> [!NOTE]
> Use literal strings (`'''`) when your prompt contains nested markdown code blocks to avoid TOML parsing issues.

## Usage

```bash
# In Gemini CLI
/command-name [arguments]

# Examples
/plan Add user authentication
/code Implement login form
/review @src/auth/login.ts
```

## Changelog

### 2026-01-24
- Fixed TOML parsing failure in `docs.toml` by switching from basic strings (`"""`) to literal strings (`'''`) - Issue #9

---

## References

- [Gemini CLI Commands Documentation](https://ai.google.dev/gemini-api/docs/gemini-cli)
- [TOML Specification](https://toml.io/en/)
