#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import * as path from "path";
import * as fs from "fs/promises";
import * as toml from "@iarna/toml";
import { fileURLToPath } from "url";
import { manageAutoPreview } from "./tools/autoPreview.js";
import { manageSession } from "./tools/sessionManager.js";
import { runChecklist } from "./tools/checklist.js";
import { runVerifyAll } from "./tools/verifyAll.js";
import { logSkill, logWorkflow, rotateLogs } from "./tools/loggerTools.js";
import { getNextTodoId, createTodo, startTodo, doneTodo, completeTodo } from "./tools/todoTools.js";
import { compoundSearch, updateSolutionRef, validateCompound, auditStateDrift, suggestSkills, compoundHealth, compoundDashboard, compoundMetrics } from "./tools/compoundTools.js";
import { bootstrapFolderDocs, checkDocsFreshness, discoverUndocumentedFolders, validateFolderDocs } from "./tools/docsTools.js";
import { generateChangelog, validateChangelog, archiveCompleted, prePushHousekeeping } from "./tools/gitTools.js";
import { validateSpecConsistency, completePlan, validateArchitecture, syncSpec, updateSpecPhase } from "./tools/archTools.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const superKitRoot = path.resolve(__dirname, "../");
const server = new Server({
    name: "superkit-mcp-server",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
        prompts: {},
    },
});
// Helper function to read directory contents, tracking if they are directories or files
async function listDirectorySafe(dirPath) {
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        return entries.map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name));
    }
    catch (err) {
        return [];
    }
}
// Ensure safe path resolution to prevent traversal
function getSafePath(basePath, relativePath) {
    // Normalize and resolve
    const resolvedPath = path.resolve(basePath, relativePath);
    // Check if it starts with the basePath
    if (!resolvedPath.startsWith(basePath)) {
        return null; // Path traversal detected
    }
    return resolvedPath;
}
const TOOLS = [
    {
        name: "call_tool_auto_preview",
        description: "Manages (start/stop/status) the local development server for previewing the application.",
        inputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["start", "stop", "status"] },
                port: { type: "number", default: 3000 }
            },
            required: ["action"],
        }
    },
    {
        name: "call_tool_session_manager",
        description: "Analyzes project state, detects tech stack, tracks file statistics, and provides a summary.",
        inputSchema: {
            type: "object",
            properties: {
                command: { type: "string", enum: ["status", "info"] },
                path: { type: "string", default: "." }
            },
            required: ["command"],
        }
    },
    {
        name: "call_tool_checklist",
        description: "Orchestrates validation scripts in priority order for incremental validation during development.",
        inputSchema: {
            type: "object",
            properties: {
                projectPath: { type: "string", default: "." },
                url: { type: "string" },
                skipPerformance: { type: "boolean", default: false }
            },
            required: ["projectPath"]
        }
    },
    {
        name: "call_tool_verify_all",
        description: "Runs COMPLETE validation including all checks + performance + E2E for deployment.",
        inputSchema: {
            type: "object",
            properties: {
                projectPath: { type: "string", default: "." },
                url: { type: "string" },
                skipE2E: { type: "boolean", default: false },
                stopOnFail: { type: "boolean", default: false }
            },
            required: ["projectPath", "url"]
        }
    },
    {
        name: "call_tool_logger_manager",
        description: "Manages tool logging operations (skills, workflows, log rotation)",
        inputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["logSkill", "logWorkflow", "rotateLogs"] },
                name: { type: "string" },
                outcome: { type: "string" },
                projectPath: { type: "string", default: "." }
            },
            required: ["action", "projectPath"]
        }
    },
    {
        name: "call_tool_todo_manager",
        description: "Manages todos (nextId, create, start, done, complete)",
        inputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["nextId", "create", "start", "done", "complete"] },
                title: { type: "string" },
                description: { type: "string" },
                priority: { type: "number" },
                todoId: { type: "string" },
                force: { type: "boolean", default: false },
                projectPath: { type: "string", default: "." }
            },
            required: ["action", "projectPath"]
        }
    },
    {
        name: "call_tool_compound_manager",
        description: "Manages compound knowledge capabilities (search, updateRef, validate, auditDrift, suggestSkills, health, dashboard, metrics)",
        inputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["search", "updateRef", "validate", "auditDrift", "suggestSkills", "health", "dashboard", "metrics"] },
                terms: { type: "array", items: { type: "string" } },
                files: { type: "array", items: { type: "string" } },
                fix: { type: "boolean", default: false },
                force: { type: "boolean", default: false },
                projectPath: { type: "string", default: "." }
            },
            required: ["action", "projectPath"]
        }
    },
    {
        name: "call_tool_docs_manager",
        description: "Manages documentation (bootstrap, freshness, discover, validate)",
        inputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["bootstrap", "freshness", "discover", "validate"] },
                folder: { type: "string" },
                skipDocs: { type: "boolean", default: false },
                strict: { type: "boolean", default: false },
                targetFolders: { type: "array", items: { type: "string" } },
                projectPath: { type: "string", default: "." }
            },
            required: ["action", "projectPath"]
        }
    },
    {
        name: "call_tool_git_manager",
        description: "Manages git and housekeeping tasks (changelog, validateChangelog, archive, housekeeping)",
        inputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["changelog", "validateChangelog", "archive", "housekeeping"] },
                applyFix: { type: "boolean", default: false },
                projectPath: { type: "string", default: "." }
            },
            required: ["action", "projectPath"]
        }
    },
    {
        name: "call_tool_arch_manager",
        description: "Manages architecture and specs tasks (validateSpecs, completePlan, validateArch, syncSpec, updatePhase)",
        inputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["validateSpecs", "completePlan", "validateArch", "syncSpec", "updatePhase"] },
                planFile: { type: "string" },
                force: { type: "boolean", default: false },
                specDir: { type: "string" },
                specName: { type: "string" },
                phaseNum: { type: "string" },
                status: { type: "string" },
                projectPath: { type: "string", default: "." }
            },
            required: ["action", "projectPath"]
        }
    },
    {
        name: "list_superkit_assets",
        description: "Lists all available agents, skills, and workflows in the Super-Kit repository.",
        inputSchema: {
            type: "object",
            properties: {},
            required: [],
        },
    },
    {
        name: "load_superkit_agent",
        description: "Loads the instruction markdown for a specific specialist agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentName: {
                    type: "string",
                    description: "The name of the agent to load (e.g., 'data-engineer'). Do not include .md.",
                },
            },
            required: ["agentName"],
        },
    },
    {
        name: "load_superkit_skill",
        description: "Loads the skill index (SKILL.md) or specific reference file for a skill.",
        inputSchema: {
            type: "object",
            properties: {
                category: {
                    type: "string",
                    description: "The category of the skill (e.g., 'tech', 'meta', 'workflows').",
                },
                skillName: {
                    type: "string",
                    description: "The name of the skill directory (e.g., 'react-best-practices').",
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
                    description: "The name of the workflow (e.g., 'plan', 'explore'). Do not include .md.",
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
        const prompts = [];
        for (const file of commandsFiles) {
            if (file.endsWith(".toml")) {
                const filePath = path.join(commandsPath, file);
                const content = await fs.readFile(filePath, "utf-8");
                try {
                    const parsed = toml.parse(content);
                    const description = parsed?.description || `Command ${file}`;
                    prompts.push({
                        name: file.replace(".toml", ""),
                        description: description,
                    });
                }
                catch (e) {
                    console.error(`Failed to parse TOML ${file}:`, e);
                }
            }
        }
        return { prompts };
    }
    catch (err) {
        console.error("Error listing prompts:", err.message);
        return { prompts: [] };
    }
});
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const promptName = request.params.name;
    const commandFile = `${promptName}.toml`;
    const basePath = path.join(superKitRoot, "commands");
    const safePath = getSafePath(basePath, commandFile);
    if (!safePath) {
        throw new Error("Invalid prompt requested");
    }
    try {
        const content = await fs.readFile(safePath, "utf-8");
        const parsed = toml.parse(content);
        const promptText = parsed?.prompt || `Execute the ${promptName} command.`;
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
    }
    catch (error) {
        throw new Error(`Prompt not found or invalid format: ${promptName}`);
    }
});
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        if (request.params.name === "call_tool_auto_preview") {
            const args = request.params.arguments;
            const res = await manageAutoPreview(args.action, args.port);
            return { content: [{ type: "text", text: res }] };
        }
        if (request.params.name === "call_tool_session_manager") {
            const args = request.params.arguments;
            const res = await manageSession(args.command, args.path);
            return { content: [{ type: "text", text: res }] };
        }
        if (request.params.name === "call_tool_checklist") {
            const args = request.params.arguments;
            const res = await runChecklist(args.projectPath, args.url, args.skipPerformance);
            return { content: [{ type: "text", text: res }] };
        }
        if (request.params.name === "call_tool_verify_all") {
            const args = request.params.arguments;
            const res = await runVerifyAll(args.projectPath, args.url, args.skipE2E, args.stopOnFail);
            return { content: [{ type: "text", text: res }] };
        }
        if (request.params.name === "call_tool_logger_manager") {
            const args = request.params.arguments;
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
            const args = request.params.arguments;
            let res = "";
            if (args.action === "nextId")
                res = String(await getNextTodoId(args.projectPath));
            else if (args.action === "create")
                res = await createTodo(args.title, args.description, args.priority, args.projectPath);
            else if (args.action === "start")
                res = await startTodo(args.todoId, args.force, args.projectPath);
            else if (args.action === "done")
                res = await doneTodo(args.todoId, args.force, args.projectPath);
            else if (args.action === "complete")
                res = await completeTodo(args.todoId, args.force, args.projectPath);
            return { content: [{ type: "text", text: res }] };
        }
        if (request.params.name === "call_tool_compound_manager") {
            const args = request.params.arguments;
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
            const args = request.params.arguments;
            let res = "";
            if (args.action === "bootstrap")
                res = await bootstrapFolderDocs(args.folder, args.projectPath);
            else if (args.action === "freshness")
                res = await checkDocsFreshness(args.skipDocs, args.projectPath);
            else if (args.action === "discover")
                res = await discoverUndocumentedFolders(args.projectPath);
            else if (args.action === "validate")
                res = await validateFolderDocs(args.strict, args.targetFolders || [], args.projectPath);
            return { content: [{ type: "text", text: res }] };
        }
        if (request.params.name === "call_tool_git_manager") {
            const args = request.params.arguments;
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
            const args = request.params.arguments;
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
                res = await updateSpecPhase(args.specName, String(args.phaseNum), args.status, args.projectPath);
            return { content: [{ type: "text", text: res }] };
        }
        if (request.params.name === "list_superkit_assets") {
            const agentsPath = path.join(superKitRoot, "agents");
            const skillsTechPath = path.join(superKitRoot, "skills", "tech");
            const skillsMetaPath = path.join(superKitRoot, "skills", "meta");
            const workflowsPath = path.join(superKitRoot, "skills", "workflows");
            const commandsPath = path.join(superKitRoot, "commands");
            const agents = await listDirectorySafe(agentsPath);
            const techSkills = await listDirectorySafe(skillsTechPath);
            const metaSkills = await listDirectorySafe(skillsMetaPath);
            const workflows = await listDirectorySafe(workflowsPath);
            const commands = await listDirectorySafe(commandsPath);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            agents: agents.map((a) => a.replace(".md", "")),
                            skills: {
                                tech: techSkills.map((s) => s.replace("/", "")),
                                meta: metaSkills.map((s) => s.replace("/", "")),
                            },
                            workflows: workflows.map((w) => w.replace(".md", "")),
                            commands: commands.map((c) => c.replace(".toml", "")),
                        }, null, 2),
                    },
                ],
            };
        }
        if (request.params.name === "load_superkit_agent") {
            const args = request.params.arguments;
            if (!args.agentName)
                throw new Error("Missing agentName");
            const agentFile = `${args.agentName}.md`;
            const baseDir = path.join(superKitRoot, "agents");
            const safePath = getSafePath(baseDir, agentFile);
            if (!safePath)
                throw new Error("Invalid agent path");
            const content = await fs.readFile(safePath, "utf-8");
            return { content: [{ type: "text", text: content }] };
        }
        if (request.params.name === "load_superkit_skill") {
            const args = request.params.arguments;
            if (!args.category || !args.skillName)
                throw new Error("Missing category or skillName");
            const baseDir = path.join(superKitRoot, "skills", args.category, args.skillName);
            const safePath = getSafePath(path.join(superKitRoot, "skills"), path.join(args.category, args.skillName, "SKILL.md"));
            if (!safePath)
                throw new Error("Invalid skill path");
            try {
                const content = await fs.readFile(safePath, "utf-8");
                return { content: [{ type: "text", text: content }] };
            }
            catch (e) {
                // If SKILL.md isn't there, just return the directory context if we can.
                const fallbackSafePath = getSafePath(path.join(superKitRoot, "skills"), path.join(args.category, args.skillName));
                if (fallbackSafePath) {
                    const items = await listDirectorySafe(fallbackSafePath);
                    return { content: [{ type: "text", text: `SKILL.md not found. Directory contains: ${items.join(', ')}` }] };
                }
                throw e;
            }
        }
        if (request.params.name === "load_superkit_workflow") {
            const args = request.params.arguments;
            if (!args.workflowName)
                throw new Error("Missing workflowName");
            const workflowFile = `${args.workflowName}.md`;
            const baseDir = path.join(superKitRoot, "skills", "workflows");
            const safePath = getSafePath(baseDir, workflowFile);
            if (!safePath)
                throw new Error("Invalid workflow path");
            const content = await fs.readFile(safePath, "utf-8");
            return { content: [{ type: "text", text: content }] };
        }
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error executing tool: ${error.message}` }],
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
