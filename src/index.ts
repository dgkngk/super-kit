#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  Prompt,
} from "@modelcontextprotocol/sdk/types.js";
import * as path from "path";
import * as fs from "fs/promises";
import * as toml from "@iarna/toml";
import { fileURLToPath } from "url";
import { z } from "zod";
import { manageAutoPreview } from "./tools/autoPreview.js";
import { manageSession } from "./tools/sessionManager.js";
import { runChecklist } from "./tools/checklist.js";
import { runVerifyAll } from "./tools/verifyAll.js";
import { logSkill, logWorkflow, rotateLogs } from "./tools/loggerTools.js";
import {
  getNextTodoId,
  createTodo,
  startTodo,
  doneTodo,
  completeTodo,
} from "./tools/todoTools.js";
import {
  compoundSearch,
  updateSolutionRef,
  validateCompound,
  auditStateDrift,
  suggestSkills,
  compoundHealth,
  compoundDashboard,
  compoundMetrics,
} from "./tools/compoundTools.js";
import {
  bootstrapFolderDocs,
  checkDocsFreshness,
  discoverUndocumentedFolders,
  validateFolderDocs,
} from "./tools/docsTools.js";
import {
  generateChangelog,
  validateChangelog,
  archiveCompleted,
  prePushHousekeeping,
} from "./tools/gitTools.js";
import {
  validateSpecConsistency,
  completePlan,
  validateArchitecture,
  syncSpec,
  updateSpecPhase,
} from "./tools/archTools.js";
import {
  list_project_agents,
  list_project_skills,
  list_project_workflows,
  load_project_agent_file,
  load_project_skill_file,
  load_project_workflow_file,
} from "./tools/ProjectAssets.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const superKitRoot = path.resolve(__dirname, "../");

const server = new Server(
  {
    name: "superkit-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
    },
  },
);

// Helper function to read directory contents, tracking if they are directories or files
async function listDirectorySafe(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map((entry: any) =>
      entry.isDirectory() ? `${entry.name}/` : entry.name,
    );
  } catch (err) {
    return [];
  }
}

// Ensure safe path resolution to prevent traversal
function getSafePath(basePath: string, relativePath: string): string | null {
  // Normalize and resolve
  const resolvedPath = path.resolve(basePath, relativePath);
  // Check if it starts with the basePath
  if (!resolvedPath.startsWith(basePath)) {
    return null; // Path traversal detected
  }
  return resolvedPath;
}

const TOOLS: Tool[] = [
  {
    name: "call_tool_auto_preview",
    description:
      "Manages (start/stop/status) the local development server for previewing the application.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["start", "stop", "status"] },
        port: { type: "number", default: 3000 },
      },
      required: ["action"],
    },
  },
  {
    name: "call_tool_session_manager",
    description:
      "Analyzes project state, detects tech stack, tracks file statistics, and provides a summary.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", enum: ["status", "info"] },
        path: { type: "string", default: "." },
      },
      required: ["command"],
    },
  },
  {
    name: "call_tool_checklist",
    description:
      "Orchestrates validation scripts in priority order for incremental validation during development.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", default: "." },
        url: { type: "string" },
        skipPerformance: { type: "boolean", default: false },
      },
      required: ["projectPath"],
    },
  },
  {
    name: "call_tool_verify_all",
    description:
      "Runs COMPLETE validation including all checks + performance + E2E for deployment.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", default: "." },
        url: { type: "string" },
        skipE2E: { type: "boolean", default: false },
        stopOnFail: { type: "boolean", default: false },
      },
      required: ["projectPath", "url"],
    },
  },
  {
    name: "call_tool_logger_manager",
    description:
      "Manages tool logging operations (skills, workflows, log rotation)",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["logSkill", "logWorkflow", "rotateLogs"],
        },
        name: { type: "string" },
        outcome: { type: "string" },
        projectPath: { type: "string", default: "." },
      },
      required: ["action", "projectPath"],
    },
  },
  {
    name: "call_tool_todo_manager",
    description: "Manages todos (nextId, create, start, done, complete)",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["nextId", "create", "start", "done", "complete"],
        },
        title: { type: "string" },
        description: { type: "string" },
        priority: { type: "string" },
        criteria: { type: "array", items: { type: "string" } },
        todoId: { type: "string" },
        force: { type: "boolean", default: false },
        projectPath: { type: "string", default: "." },
      },
      required: ["action", "projectPath"],
    },
  },
  {
    name: "call_tool_compound_manager",
    description:
      "Manages compound knowledge capabilities (search, updateRef, validate, auditDrift, suggestSkills, health, dashboard, metrics)",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [
            "search",
            "updateRef",
            "validate",
            "auditDrift",
            "suggestSkills",
            "health",
            "dashboard",
            "metrics",
          ],
        },
        terms: { type: "array", items: { type: "string" } },
        files: { type: "array", items: { type: "string" } },
        fix: { type: "boolean", default: false },
        force: { type: "boolean", default: false },
        projectPath: { type: "string", default: "." },
      },
      required: ["action", "projectPath"],
    },
  },
  {
    name: "call_tool_docs_manager",
    description:
      "Manages documentation (bootstrap, freshness, discover, validate)",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["bootstrap", "freshness", "discover", "validate"],
        },
        folder: { type: "string" },
        skipDocs: { type: "boolean", default: false },
        strict: { type: "boolean", default: false },
        targetFolders: { type: "array", items: { type: "string" } },
        projectPath: { type: "string", default: "." },
      },
      required: ["action", "projectPath"],
    },
  },
  {
    name: "call_tool_git_manager",
    description:
      "Manages git and housekeeping tasks (changelog, validateChangelog, archive, housekeeping)",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["changelog", "validateChangelog", "archive", "housekeeping"],
        },
        applyFix: { type: "boolean", default: false },
        projectPath: { type: "string", default: "." },
      },
      required: ["action", "projectPath"],
    },
  },
  {
    name: "call_tool_arch_manager",
    description:
      "Manages architecture and specs tasks (validateSpecs, completePlan, validateArch, syncSpec, updatePhase)",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [
            "validateSpecs",
            "completePlan",
            "validateArch",
            "syncSpec",
            "updatePhase",
          ],
        },
        planFile: { type: "string" },
        force: { type: "boolean", default: false },
        specDir: { type: "string" },
        specName: { type: "string" },
        phaseNum: { type: "string" },
        status: { type: "string" },
        projectPath: { type: "string", default: "." },
      },
      required: ["action", "projectPath"],
    },
  },
  {
    name: "list_superkit_assets",
    description:
      "Lists all available agents, skills, and workflows in the Super-Kit repository.",
    inputSchema: {
      type: "object",
      properties: {
        scope: {
          type: "string",
          enum: ["global", "project", "all"],
          default: "global",
          description:
            "Which scope to list: 'global' (superkit package assets), 'project' (.agents/ folder assets), or 'all' (merged with source labels on every entry).",
        },
        projectPath: {
          type: "string",
          description:
            "Project root path used when scope includes 'project'. Defaults to process.cwd().",
        },
      },
      required: [],
    },
  },
  {
    name: "list_project_assets",
    description:
      "Lists project-scoped agents, skills, and workflows from the .agents/ folder in the given project directory. Falls back to process.cwd() if no projectPath is given.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description:
            "Absolute path to the project root. Defaults to process.cwd().",
        },
      },
      required: [],
    },
  },
  {
    name: "load_project_agent",
    description:
      "Loads a project-scoped agent markdown file from {projectPath}/.agents/agents/{agentName}.md",
    inputSchema: {
      type: "object",
      properties: {
        agentName: {
          type: "string",
          description: "Agent name without .md extension.",
        },
        projectPath: {
          type: "string",
          description:
            "Absolute path to the project root. Defaults to process.cwd().",
        },
      },
      required: ["agentName"],
    },
  },
  {
    name: "load_project_skill",
    description:
      "Loads a project-scoped skill's SKILL.md from {projectPath}/.agents/skills/{category}/{skillName}/SKILL.md",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Skill category: 'tech' or 'meta'.",
        },
        skillName: {
          type: "string",
          description: "Skill directory name.",
        },
        projectPath: {
          type: "string",
          description:
            "Absolute path to the project root. Defaults to process.cwd().",
        },
      },
      required: ["category", "skillName"],
    },
  },
  {
    name: "load_project_workflow",
    description:
      "Loads a project-scoped workflow markdown file from {projectPath}/.agents/workflows/{workflowName}.md",
    inputSchema: {
      type: "object",
      properties: {
        workflowName: {
          type: "string",
          description: "Workflow name without .md extension.",
        },
        projectPath: {
          type: "string",
          description:
            "Absolute path to the project root. Defaults to process.cwd().",
        },
      },
      required: ["workflowName"],
    },
  },
  {
    name: "load_superkit_agent",
    description:
      "Loads the instruction markdown for a specific specialist agent.",
    inputSchema: {
      type: "object",
      properties: {
        agentName: {
          type: "string",
          description:
            "The name of the agent to load (e.g., 'data-engineer'). Do not include .md.",
        },
      },
      required: ["agentName"],
    },
  },
  {
    name: "load_superkit_skill",
    description:
      "Loads the skill index (SKILL.md) or specific reference file for a skill.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description:
            "The category of the skill (e.g., 'tech', 'meta', 'workflows').",
        },
        skillName: {
          type: "string",
          description:
            "The name of the skill directory (e.g., 'react-best-practices').",
        },
      },
      required: ["category", "skillName"],
    },
  },
  {
    name: "load_superkit_workflow",
    description: "Loads the instructions for a specific workflow.",
    inputSchema: {
      type: "object",
      properties: {
        workflowName: {
          type: "string",
          description:
            "The name of the workflow (e.g., 'plan', 'explore'). Do not include .md.",
        },
      },
      required: ["workflowName"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  try {
    const commandsPath = path.join(superKitRoot, "commands");
    const commandsFiles = await fs.readdir(commandsPath);
    const prompts: Prompt[] = [];

    for (const file of commandsFiles) {
      if (file.endsWith(".toml")) {
        const filePath = path.join(commandsPath, file);
        const content = await fs.readFile(filePath, "utf-8");
        try {
          const parsed = toml.parse(content) as any;
          const description = parsed?.description || `Command ${file}`;
          prompts.push({
            name: file.replace(".toml", ""),
            description: description,
            arguments: [
              {
                name: "args",
                description: "Arguments to pass to the command",
                required: false,
              },
            ],
          });
        } catch (e) {
          console.error(`Failed to parse TOML ${file}:`, e);
        }
      }
    }
    return { prompts };
  } catch (err: any) {
    console.error("Error listing prompts:", err.message);
    return { prompts: [] };
  }
});

export function apply_prompt_args(
  promptText: string,
  userArgs: string,
): string {
  // Substitute {{#if args}} ... {{else}} ... {{/if}} Handlebars blocks
  promptText = promptText.replace(
    /\{\{#if args\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_: string, ifBlock: string, elseBlock: string) =>
      userArgs.trim() ? ifBlock : elseBlock,
  );

  // Substitute {{#if args}} ... {{/if}} blocks (no else branch)
  promptText = promptText.replace(
    /\{\{#if args\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_: string, ifBlock: string) => (userArgs.trim() ? ifBlock : ""),
  );

  // Substitute all {{args}} occurrences with the actual user-provided args
  promptText = promptText.replace(/\{\{args\}\}/g, userArgs);

  return promptText;
}

server.setRequestHandler(GetPromptRequestSchema, async (request: any) => {
  const promptName = request.params.name;
  const userArgs: string = request.params.arguments?.args ?? "";
  const commandFile = `${promptName}.toml`;
  const basePath = path.join(superKitRoot, "commands");
  const safePath = getSafePath(basePath, commandFile);

  if (!safePath) {
    throw new Error("Invalid prompt requested");
  }

  try {
    const content = await fs.readFile(safePath, "utf-8");
    const parsed = toml.parse(content) as any;
    let promptText = parsed?.prompt || `Execute the ${promptName} command.`;

    promptText = apply_prompt_args(promptText, userArgs);

    // Resolve @{path} includes from super-kit package root
    const includePattern = /@\{([^}]+)\}/g;
    let match;
    while ((match = includePattern.exec(promptText)) !== null) {
      const includePath = match[1];
      const resolvedPath = getSafePath(superKitRoot, includePath);
      if (resolvedPath) {
        try {
          const includeContent = await fs.readFile(resolvedPath, "utf-8");
          promptText = promptText.replace(match[0], includeContent);
        } catch {
          promptText = promptText.replace(
            match[0],
            `[File not found: ${includePath}]`,
          );
        }
      }
    }

    // Load SUPERKIT.md for systematic inclusion
    const superKitPath = path.join(superKitRoot, "SUPERKIT.md");
    const superKitContent = await fs.readFile(superKitPath, "utf-8");

    return {
      description: parsed?.description || `Loaded command: ${promptName}`,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `[SYSTEM INSTRUCTIONS - Follow these strictly]\n\n${superKitContent}\n\n[USER TASK]\n\n${promptText}`,
          },
        },
      ],
    };
  } catch (error) {
    throw new Error(`Prompt not found or invalid format: ${promptName}`);
  }
});

server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  try {
    if (request.params.name === "call_tool_auto_preview") {
      const args = request.params.arguments as any;
      const res = await manageAutoPreview(args.action, args.port);
      return { content: [{ type: "text", text: res }] };
    }
    if (request.params.name === "call_tool_session_manager") {
      const args = request.params.arguments as any;
      const res = await manageSession(args.command, args.path);
      return { content: [{ type: "text", text: res }] };
    }
    if (request.params.name === "call_tool_checklist") {
      const args = request.params.arguments as any;
      const res = await runChecklist(
        args.projectPath,
        args.url,
        args.skipPerformance,
      );
      return { content: [{ type: "text", text: res }] };
    }
    if (request.params.name === "call_tool_verify_all") {
      const args = request.params.arguments as any;
      const res = await runVerifyAll(
        args.projectPath,
        args.url,
        args.skipE2E,
        args.stopOnFail,
      );
      return { content: [{ type: "text", text: res }] };
    }
    if (request.params.name === "call_tool_logger_manager") {
      const args = request.params.arguments as any;
      let res = "";
      if (args.action === "logSkill")
        res = await logSkill(args.name, args.outcome, args.projectPath);
      else if (args.action === "logWorkflow")
        res = await logWorkflow(args.name, args.outcome, args.projectPath);
      else if (args.action === "rotateLogs")
        res = await rotateLogs(args.projectPath);
      return { content: [{ type: "text", text: res }] };
    }
    if (request.params.name === "call_tool_todo_manager") {
      const args = request.params.arguments as any;
      let res = "";
      if (args.action === "nextId")
        res = String(await getNextTodoId(args.projectPath));
      else if (args.action === "create")
        res = await createTodo(
          String(args.priority ?? "p3"),
          args.title,
          args.description,
          args.criteria || [],
          args.projectPath,
        );
      else if (args.action === "start")
        res = await startTodo(args.todoId, args.force, args.projectPath);
      else if (args.action === "done")
        res = await doneTodo(args.todoId, args.force, args.projectPath);
      else if (args.action === "complete")
        res = await completeTodo(args.todoId, args.force, args.projectPath);
      return { content: [{ type: "text", text: res }] };
    }
    if (request.params.name === "call_tool_compound_manager") {
      const args = request.params.arguments as any;
      let res = "";
      if (args.action === "search")
        res = await compoundSearch(args.terms || [], args.projectPath);
      else if (args.action === "updateRef")
        res = await updateSolutionRef(args.files || [], args.projectPath);
      else if (args.action === "validate")
        res = await validateCompound(args.projectPath);
      else if (args.action === "auditDrift")
        res = await auditStateDrift(args.projectPath, args.fix);
      else if (args.action === "suggestSkills")
        res = await suggestSkills(args.projectPath);
      else if (args.action === "health")
        res = await compoundHealth(args.projectPath);
      else if (args.action === "dashboard")
        res = await compoundDashboard(args.projectPath);
      else if (args.action === "metrics")
        res = await compoundMetrics(args.projectPath, args.force);
      return { content: [{ type: "text", text: res }] };
    }
    if (request.params.name === "call_tool_docs_manager") {
      const args = request.params.arguments as any;
      let res = "";
      if (args.action === "bootstrap")
        res = await bootstrapFolderDocs(args.folder, args.projectPath);
      else if (args.action === "freshness")
        res = await checkDocsFreshness(args.skipDocs, args.projectPath);
      else if (args.action === "discover")
        res = await discoverUndocumentedFolders(args.projectPath);
      else if (args.action === "validate")
        res = await validateFolderDocs(
          args.strict,
          args.targetFolders || [],
          args.projectPath,
        );
      return { content: [{ type: "text", text: res }] };
    }
    if (request.params.name === "call_tool_git_manager") {
      const args = request.params.arguments as any;
      let res = "";
      if (args.action === "changelog")
        res = await generateChangelog(args.projectPath);
      else if (args.action === "validateChangelog")
        res = await validateChangelog(args.projectPath);
      else if (args.action === "archive")
        res = await archiveCompleted(args.projectPath, args.applyFix);
      else if (args.action === "housekeeping")
        res = await prePushHousekeeping(args.projectPath, args.applyFix);
      return { content: [{ type: "text", text: res }] };
    }
    if (request.params.name === "call_tool_arch_manager") {
      const args = request.params.arguments as any;
      let res = "";
      if (args.action === "validateSpecs")
        res = await validateSpecConsistency(args.projectPath);
      else if (args.action === "completePlan")
        res = await completePlan(args.planFile, args.force, args.projectPath);
      else if (args.action === "validateArch")
        res = await validateArchitecture(args.projectPath);
      else if (args.action === "syncSpec")
        res = await syncSpec(args.specDir, args.projectPath);
      else if (args.action === "updatePhase")
        res = await updateSpecPhase(
          args.specName,
          String(args.phaseNum),
          args.status,
          args.projectPath,
        );
      return { content: [{ type: "text", text: res }] };
    }

    if (request.params.name === "list_superkit_assets") {
      const args = request.params.arguments as
        | { scope?: string; projectPath?: string }
        | undefined;
      const scope = args?.scope ?? "global";
      const projectPath = args?.projectPath;

      const agentsPath = path.join(superKitRoot, "agents");
      const skillsTechPath = path.join(superKitRoot, "skills", "tech");
      const skillsMetaPath = path.join(superKitRoot, "skills", "meta");
      const workflowsPath = path.join(superKitRoot, "skills", "workflows");
      const commandsPath = path.join(superKitRoot, "commands");

      // Build global asset lists (used for scope "global" or "all")
      let globalData: object | null = null;
      if (scope !== "project") {
        const agents = await listDirectorySafe(agentsPath);
        const techSkills = await listDirectorySafe(skillsTechPath);
        const metaSkills = await listDirectorySafe(skillsMetaPath);
        const workflows = await listDirectorySafe(workflowsPath);
        const commands = await listDirectorySafe(commandsPath);

        if (scope === "global") {
          // Original backward-compatible format — no source labels
          globalData = {
            agents: agents.map((a) => a.replace(".md", "")),
            skills: {
              tech: techSkills.map((s) => s.replace("/", "")),
              meta: metaSkills.map((s) => s.replace("/", "")),
            },
            workflows: workflows.map((w) => w.replace(".md", "")),
            commands: commands.map((c) => c.replace(".toml", "")),
          };
        } else {
          // "all" scope — include source labels on every entry
          globalData = {
            agents: agents.map((a) => ({
              name: a.replace(".md", ""),
              source: "global",
            })),
            skills: {
              tech: techSkills.map((s) => ({
                name: s.replace("/", ""),
                source: "global",
              })),
              meta: metaSkills.map((s) => ({
                name: s.replace("/", ""),
                source: "global",
              })),
            },
            workflows: workflows.map((w) => ({
              name: w.replace(".md", ""),
              source: "global",
            })),
            commands: commands.map((c) => ({
              name: c.replace(".toml", ""),
              source: "global",
            })),
          };
        }
      }

      // Build project asset lists (used for scope "project" or "all")
      let projectData: object | null = null;
      if (scope !== "global") {
        const [projAgents, projSkills, projWorkflows] = await Promise.all([
          list_project_agents(projectPath),
          list_project_skills(projectPath),
          list_project_workflows(projectPath),
        ]);
        projectData = {
          agents: projAgents.map((a) => ({ name: a, source: "project" })),
          skills: {
            tech: projSkills.tech.map((s) => ({ name: s, source: "project" })),
            meta: projSkills.meta.map((s) => ({ name: s, source: "project" })),
          },
          workflows: projWorkflows.map((w) => ({ name: w, source: "project" })),
        };
      }

      // Compose the final response payload
      let payload: object;
      if (scope === "global") {
        payload = globalData!;
      } else if (scope === "project") {
        payload = projectData!;
      } else {
        // "all" — deep-merge both lists
        const g = globalData as any;
        const p = projectData as any;
        payload = {
          agents: [...g.agents, ...p.agents],
          skills: {
            tech: [...g.skills.tech, ...p.skills.tech],
            meta: [...g.skills.meta, ...p.skills.meta],
          },
          workflows: [...g.workflows, ...p.workflows],
          commands: g.commands,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    }

    if (request.params.name === "load_superkit_agent") {
      const args = request.params.arguments as { agentName: string };
      if (!args.agentName) throw new Error("Missing agentName");

      const agentFile = `${args.agentName}.md`;
      const baseDir = path.join(superKitRoot, "agents");
      const safePath = getSafePath(baseDir, agentFile);

      if (!safePath) throw new Error("Invalid agent path");

      const content = await fs.readFile(safePath, "utf-8");
      return { content: [{ type: "text", text: content }] };
    }

    if (request.params.name === "load_superkit_skill") {
      const args = request.params.arguments as {
        category: string;
        skillName: string;
      };
      if (!args.category || !args.skillName)
        throw new Error("Missing category or skillName");

      const baseDir = path.join(
        superKitRoot,
        "skills",
        args.category,
        args.skillName,
      );
      const safePath = getSafePath(
        path.join(superKitRoot, "skills"),
        path.join(args.category, args.skillName, "SKILL.md"),
      );

      if (!safePath) throw new Error("Invalid skill path");

      try {
        const content = await fs.readFile(safePath, "utf-8");
        return { content: [{ type: "text", text: content }] };
      } catch (e) {
        // If SKILL.md isn't there, just return the directory context if we can.
        const fallbackSafePath = getSafePath(
          path.join(superKitRoot, "skills"),
          path.join(args.category, args.skillName),
        );
        if (fallbackSafePath) {
          const items = await listDirectorySafe(fallbackSafePath);
          return {
            content: [
              {
                type: "text",
                text: `SKILL.md not found. Directory contains: ${items.join(", ")}`,
              },
            ],
          };
        }
        throw e;
      }
    }

    if (request.params.name === "load_superkit_workflow") {
      const args = request.params.arguments as { workflowName: string };
      if (!args.workflowName) throw new Error("Missing workflowName");

      const workflowFile = `${args.workflowName}.md`;
      const baseDir = path.join(superKitRoot, "skills", "workflows");
      const safePath = getSafePath(baseDir, workflowFile);

      if (!safePath) throw new Error("Invalid workflow path");

      const content = await fs.readFile(safePath, "utf-8");
      return { content: [{ type: "text", text: content }] };
    }

    if (request.params.name === "list_project_assets") {
      const args = request.params.arguments as
        | { projectPath?: string }
        | undefined;
      const projectPath = args?.projectPath;

      const [agents, skills, workflows] = await Promise.all([
        list_project_agents(projectPath),
        list_project_skills(projectPath),
        list_project_workflows(projectPath),
      ]);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                source: "project",
                agents: agents.map((a) => ({ name: a, source: "project" })),
                skills: {
                  tech: skills.tech.map((s) => ({
                    name: s,
                    source: "project",
                  })),
                  meta: skills.meta.map((s) => ({
                    name: s,
                    source: "project",
                  })),
                },
                workflows: workflows.map((w) => ({
                  name: w,
                  source: "project",
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    if (request.params.name === "load_project_agent") {
      const args = request.params.arguments as {
        agentName: string;
        projectPath?: string;
      };
      if (!args.agentName) throw new Error("Missing agentName");

      const content = await load_project_agent_file(
        args.agentName,
        args.projectPath,
      );
      return { content: [{ type: "text", text: content }] };
    }

    if (request.params.name === "load_project_skill") {
      const args = request.params.arguments as {
        category: string;
        skillName: string;
        projectPath?: string;
      };
      if (!args.category || !args.skillName)
        throw new Error("Missing category or skillName");

      const content = await load_project_skill_file(
        args.category,
        args.skillName,
        args.projectPath,
      );
      return { content: [{ type: "text", text: content }] };
    }

    if (request.params.name === "load_project_workflow") {
      const args = request.params.arguments as {
        workflowName: string;
        projectPath?: string;
      };
      if (!args.workflowName) throw new Error("Missing workflowName");

      const content = await load_project_workflow_file(
        args.workflowName,
        args.projectPath,
      );
      return { content: [{ type: "text", text: content }] };
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  } catch (error: any) {
    return {
      content: [
        { type: "text", text: `Error executing tool: ${error.message}` },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Super-Kit MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
