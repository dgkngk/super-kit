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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Assuming __dirname is super-kit/mcp-server/build
const IS_BUILD = __dirname.endsWith("build");
const superKitRoot = IS_BUILD ? path.resolve(__dirname, "../../") : path.resolve(__dirname, "../");

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
