#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
} from "@modelcontextprotocol/sdk/types.js";
import * as path from "path";
import * as fs from "fs/promises";
import { fileURLToPath } from "url";
import { z } from "zod";
import { manageAutoPreview } from "./tools/autoPreview.js";
import { manageSession } from "./tools/sessionManager.js";
import { runChecklist } from "./tools/checklist.js";
import { runVerifyAll } from "./tools/verifyAll.js";
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
        },
    }
);

// Helper function to read directory contents, tracking if they are directories or files
async function listDirectorySafe(dirPath: string): Promise<string[]> {
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        return entries.map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name));
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

server.setRequestHandler(CallToolRequestSchema, async (request) => {
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
            const res = await runChecklist(args.projectPath, args.url, args.skipPerformance);
            return { content: [{ type: "text", text: res }] };
        }
        if (request.params.name === "call_tool_verify_all") {
            const args = request.params.arguments as any;
            const res = await runVerifyAll(args.projectPath, args.url, args.skipE2E, args.stopOnFail);
            return { content: [{ type: "text", text: res }] };
        }
        if (request.params.name === "list_superkit_assets") {
            const agentsPath = path.join(superKitRoot, "agents");
            const skillsTechPath = path.join(superKitRoot, "skills", "tech");
            const skillsMetaPath = path.join(superKitRoot, "skills", "meta");
            const workflowsPath = path.join(superKitRoot, "workflows");

            const agents = await listDirectorySafe(agentsPath);
            const techSkills = await listDirectorySafe(skillsTechPath);
            const metaSkills = await listDirectorySafe(skillsMetaPath);
            const workflows = await listDirectorySafe(workflowsPath);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(
                            {
                                agents: agents.map((a) => a.replace(".md", "")),
                                skills: {
                                    tech: techSkills.map((s) => s.replace("/", "")),
                                    meta: metaSkills.map((s) => s.replace("/", "")),
                                },
                                workflows: workflows.map((w) => w.replace(".md", "")),
                            },
                            null,
                            2
                        ),
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
            const args = request.params.arguments as { category: string; skillName: string };
            if (!args.category || !args.skillName) throw new Error("Missing category or skillName");

            const baseDir = path.join(superKitRoot, "skills", args.category, args.skillName);
            const safePath = getSafePath(path.join(superKitRoot, "skills"), path.join(args.category, args.skillName, "SKILL.md"));

            if (!safePath) throw new Error("Invalid skill path");

            try {
                const content = await fs.readFile(safePath, "utf-8");
                return { content: [{ type: "text", text: content }] };
            } catch (e) {
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
            const args = request.params.arguments as { workflowName: string };
            if (!args.workflowName) throw new Error("Missing workflowName");

            const workflowFile = `${args.workflowName}.md`;
            const baseDir = path.join(superKitRoot, "workflows");
            const safePath = getSafePath(baseDir, workflowFile);

            if (!safePath) throw new Error("Invalid workflow path");

            const content = await fs.readFile(safePath, "utf-8");
            return { content: [{ type: "text", text: content }] };
        }

        throw new Error(`Unknown tool: ${request.params.name}`);
    } catch (error: any) {
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
