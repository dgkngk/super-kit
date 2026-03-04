import * as fs from 'fs/promises';
import * as path from 'path';
export async function getNextTodoId(projectPath = '.') {
    const todosDir = path.join(projectPath, 'todos');
    const archiveDir = path.join(todosDir, 'archive');
    let maxId = 0;
    const findMaxIdInDir = async (dir) => {
        try {
            const files = await fs.readdir(dir);
            for (const file of files) {
                if (file.endsWith('.md')) {
                    const match = file.match(/^(\d+)-/);
                    if (match) {
                        const id = parseInt(match[1], 10);
                        if (id > maxId)
                            maxId = id;
                    }
                }
            }
        }
        catch (e) {
            // Directory might not exist
        }
    };
    await findMaxIdInDir(todosDir);
    await findMaxIdInDir(archiveDir);
    maxId += 1;
    return maxId.toString().padStart(3, '0');
}
export async function createTodo(priority, title, problemStatement, criteriaArgs = [], projectPath = '.') {
    const todosDir = path.join(projectPath, 'todos');
    await fs.mkdir(todosDir, { recursive: true });
    const nextId = await getNextTodoId(projectPath);
    const sanitizedDesc = title.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '').substring(0, 50);
    const filename = `${nextId}-pending-${priority}-${sanitizedDesc}.md`;
    const filePath = path.join(todosDir, filename);
    const dateStr = new Date().toISOString().split('T')[0];
    let content = `---
status: pending
priority: ${priority}
issue_id: "${nextId}"
tags: [generated, cleanup]
dependencies: []
---

# ${title}

## Problem Statement

**What's broken/missing:**
${problemStatement}

**Impact:**
This issue currently affects the system quality or functionality and needs to be addressed.

## Findings
- **Status:** Identified during workflow execution.
- **Priority:** ${priority}
- **System Impact:** This item is tracked to ensure continuous improvement of the codebase. Addressing it will contribute to overall system stability and feature completeness. The findings section provides context on origin and importance.

## Recommended Action
Implement the solution according to the acceptance criteria below.

## Acceptance Criteria
`;
    for (const criteria of criteriaArgs) {
        content += `- [ ] ${criteria}\n`;
    }
    content += `

## Work Log

### ${dateStr} - Created

**By:** Agent
**Actions:**
- Auto-generated via createTodo MCP tool

## Notes
Source: Workflow automation
`;
    await fs.writeFile(filePath, content);
    return `✅ Created todo: ${filePath}\n   ID: ${nextId}\n   Priority: ${priority}\n   Title: ${title}`;
}
async function updateTodoStatus(todoFile, newStatus, force = false, projectPath = '.') {
    const fullPath = path.resolve(projectPath, todoFile);
    try {
        await fs.access(fullPath);
    }
    catch {
        throw new Error(`❌ File not found: ${todoFile}`);
    }
    let content = await fs.readFile(fullPath, 'utf8');
    const statusMatch = content.match(/^status:\s*(.+)$/m);
    const currentStatus = statusMatch ? statusMatch[1].trim() : 'unknown';
    if (newStatus === 'in-progress') {
        if (/^(done|deferred|rejected)$/.test(currentStatus)) {
            if (!force) {
                throw new Error(`❌ Error: Todo is already in terminal state: ${currentStatus}\nUse force to bypass.`);
            }
        }
    }
    else if (newStatus === 'done' || newStatus === 'complete') {
        if (content.match(/-\s*\[\s*\]/)) {
            if (!force) {
                throw new Error(`❌ Error: Unchecked items found in checklist.\nAll acceptance criteria must be checked before marking a todo as ${newStatus}.`);
            }
        }
    }
    // Replace status
    content = content.replace(/^status:\s*.*$/m, `status: ${newStatus}`);
    const basename = path.basename(todoFile);
    const dir = path.dirname(fullPath);
    // Parse the ID and Priority
    const idMatch = basename.match(/^(\d+)-/);
    const id = idMatch ? idMatch[1] : '000';
    const pattern = /^(\d+)-[a-z-]+-(p[0123])-(.+)\.md$/;
    const match = basename.match(pattern);
    let priority = 'p3';
    let desc = basename;
    if (match) {
        priority = match[2];
        desc = match[3];
    }
    else {
        // Fallback robust extraction
        const pMatch = basename.match(/(p[0123])/);
        if (pMatch)
            priority = pMatch[1];
        // Remove known prefixes
        desc = basename.replace(/^(\d+)-/, '').replace(new RegExp(`^[a-z-]+-${priority}-`), '').replace(/\.md$/, '');
    }
    const newName = `${id}-${newStatus}-${priority}-${desc}.md`;
    const newPath = path.join(dir, newName);
    if (fullPath !== newPath) {
        try {
            await fs.access(newPath);
            throw new Error(`❌ Collision: ${newPath} already exists`);
        }
        catch (err) {
            if (err.code !== 'ENOENT')
                throw err;
        }
    }
    await fs.writeFile(newPath, content);
    if (fullPath !== newPath) {
        await fs.unlink(fullPath);
    }
    let icon = '✅';
    if (newStatus === 'in-progress')
        icon = '🏁';
    return `${icon} ${newStatus === 'in-progress' ? 'Started' : (newStatus === 'done' ? 'Done' : 'Completed')}: ${newName}`;
}
export async function startTodo(todoFile, force = false, projectPath = '.') {
    return updateTodoStatus(todoFile, 'in-progress', force, projectPath);
}
export async function doneTodo(todoFile, force = false, projectPath = '.') {
    return updateTodoStatus(todoFile, 'done', force, projectPath);
}
export async function completeTodo(todoFile, force = false, projectPath = '.') {
    return updateTodoStatus(todoFile, 'complete', force, projectPath);
}
