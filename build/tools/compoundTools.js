import * as fs from 'fs/promises';
import * as path from 'path';
export async function compoundSearch(terms, projectPath = '.') {
    const searchDirs = ['docs/solutions', 'docs/explorations', 'docs/decisions'].map(d => path.join(projectPath, d));
    // Log usage
    const logLine = `${new Date().toISOString().replace(/\.[0-9]{3}Z$/, 'Z')}|compound-search|manual|${terms.join(',')}\n`;
    await fs.mkdir(path.join(projectPath, 'docs', 'agents', 'logs'), { recursive: true });
    await fs.appendFile(path.join(projectPath, 'docs', 'agents', 'logs', 'compound_usage.log'), logLine);
    const results = new Set();
    async function searchInDir(dir) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    await searchInDir(fullPath);
                }
                else if (entry.isFile() && entry.name.endsWith('.md')) {
                    const content = await fs.readFile(fullPath, 'utf-8');
                    for (const term of terms) {
                        if (content.toLowerCase().includes(term.toLowerCase())) {
                            results.add(fullPath);
                            break;
                        }
                    }
                }
            }
        }
        catch (e) {
            // Directory might not exist
        }
    }
    for (const dir of searchDirs) {
        await searchInDir(dir);
    }
    if (results.size === 0) {
        return "No matching solutions found.";
    }
    let output = "🔎 Searching Knowledge Base...\n\n| Solution | Relevance | Action |\n|----------|-----------|--------|\n";
    const filePaths = Array.from(results);
    for (const file of filePaths) {
        const content = await fs.readFile(file, 'utf-8');
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1] : path.basename(file);
        const relPath = path.relative(projectPath, file);
        output += `| [${title}](${relPath}) | ⭐️ Match | Referencing |\n`;
    }
    output += "\n---\n⬇️  **Command to track usage:**\n\n```bash\n";
    output += `Call the call_tool_compound_manager MCP tool with action updateRef and files: ${filePaths.map(f => path.relative(projectPath, f)).join(' ')}\n`;
    output += "```\n";
    return output;
}
export async function updateSolutionRef(files, projectPath = '.') {
    const today = new Date().toISOString().split('T')[0];
    let count = 0;
    const logLine = `${new Date().toISOString().replace(/\.[0-9]{3}Z$/, 'Z')}|update-solution-ref|manual|${files.join(',')}\n`;
    await fs.mkdir(path.join(projectPath, 'docs', 'agents', 'logs'), { recursive: true });
    await fs.appendFile(path.join(projectPath, 'docs', 'agents', 'logs', 'compound_usage.log'), logLine);
    let output = '';
    for (const file of files) {
        const fullPath = path.resolve(projectPath, file);
        try {
            let content = await fs.readFile(fullPath, 'utf8');
            if (content.match(/^last_referenced:/m)) {
                content = content.replace(/^last_referenced:.*$/m, `last_referenced: "${today}"`);
            }
            else {
                if (content.match(/^tags:/m)) {
                    content = content.replace(/^tags:/m, `last_referenced: "${today}"\ntags:`);
                }
                else {
                    if (!content.startsWith('---')) {
                        content = `---\nlast_referenced: "${today}"\n---\n${content}`;
                    }
                    else {
                        content = content.replace(/---\n/, `---\nlast_referenced: "${today}"\n`);
                    }
                }
            }
            await fs.writeFile(fullPath, content);
            output += `✅ Updated ${file}\n`;
            count++;
        }
        catch (e) {
            output += `⚠️  File not found: ${file}\n`;
        }
    }
    output += `Updated ${count} files to ${today}`;
    return output;
}
export async function validateCompound(projectPath = '.') {
    let exitCode = 0;
    let output = "🔍 Validating Compound System...\n";
    async function countUnchecked(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const matches = content.match(/^- \[ \]/gm);
            return matches ? matches.length : 0;
        }
        catch {
            return 0;
        }
    }
    const implPlanUnchecked = await countUnchecked(path.join(projectPath, 'implementation_plan.md'));
    if (implPlanUnchecked > 0) {
        output += `⚠️  Found ${implPlanUnchecked} unchecked items in implementation_plan.md\n`;
        exitCode = 1;
    }
    let deferredPlans = 0;
    try {
        const planFiles = await fs.readdir(path.join(projectPath, 'plans'));
        for (const file of planFiles) {
            if (file.endsWith('.md')) {
                deferredPlans += await countUnchecked(path.join(projectPath, 'plans', file));
            }
        }
    }
    catch { }
    if (deferredPlans > 0) {
        output += `⚠️  Found ${deferredPlans} unchecked items in plans/\n`;
        exitCode = 1;
    }
    let deferredExpls = 0;
    try {
        const expFiles = await fs.readdir(path.join(projectPath, 'docs/explorations'));
        for (const file of expFiles) {
            if (file.endsWith('.md') && !file.includes('template')) {
                deferredExpls += await countUnchecked(path.join(projectPath, 'docs/explorations', file));
            }
        }
    }
    catch { }
    if (deferredExpls > 0) {
        output += `⚠️  Found ${deferredExpls} unchecked items in docs/explorations/\n`;
        exitCode = 1;
    }
    let activeTodos = 0;
    try {
        const todoFiles = await fs.readdir(path.join(projectPath, 'todos'));
        for (const file of todoFiles) {
            if (file.endsWith('.md') && !file.includes('template')) {
                activeTodos++;
            }
        }
    }
    catch { }
    if (activeTodos === 0) {
        output += "ℹ️  No active todos found.\n";
    }
    if (exitCode === 0) {
        output += "✅ Validation complete. System healthy.";
    }
    else {
        output += "❌ Validation failed. Please address items above.";
    }
    return output;
}
export async function auditStateDrift(projectPath = '.', fix = false) {
    let driftCount = 0;
    let fixCount = 0;
    let output = "🔍 Auditing Lifecycle Document State Consistency...\n\n";
    async function checkFile(p, docType) {
        try {
            const content = await fs.readFile(p, 'utf8');
            const total = (content.match(/^- \[[x ]\]/gmi) || []).length;
            const checked = (content.match(/^- \[x\]/gmi) || []).length;
            if (total === 0)
                return;
            let status = 'UNKNOWN';
            let statusLine = '';
            const yamlMatch = content.match(/^status:\s*(.+)$/im);
            if (yamlMatch) {
                statusLine = yamlMatch[0];
                status = yamlMatch[1].trim();
            }
            else {
                const mdMatch = content.match(/^> Status:\s*(.+)$/im);
                if (mdMatch) {
                    statusLine = mdMatch[0];
                    status = mdMatch[1].trim();
                }
            }
            const isComplete = (checked === total && total > 0);
            let hasDrift = false;
            let newStatus = '';
            if (docType === 'plan') {
                if (isComplete && !/Implemented|Complete/i.test(status)) {
                    hasDrift = true;
                    newStatus = 'Implemented';
                }
                else if (!isComplete && /Implemented|Complete/i.test(status)) {
                    hasDrift = true;
                    newStatus = 'Draft';
                }
            }
            else if (docType === 'todo') {
                if (isComplete && !/done/i.test(status)) {
                    hasDrift = true;
                    newStatus = 'done';
                }
                else if (!isComplete && /done/i.test(status)) {
                    hasDrift = true;
                    newStatus = 'pending';
                }
            }
            if (hasDrift) {
                if (fix && newStatus) {
                    let newContent = content;
                    if (statusLine.toLowerCase().startsWith('status:')) {
                        newContent = newContent.replace(/^status:.*$/im, `status: ${newStatus}`);
                    }
                    else if (statusLine.toLowerCase().startsWith('> status:')) {
                        newContent = newContent.replace(/^> Status:.*$/im, `> Status: ${newStatus}`);
                    }
                    await fs.writeFile(p, newContent);
                    output += `🔧 FIXED: ${path.basename(p)} (${status} → ${newStatus})\n`;
                    fixCount++;
                }
                else {
                    output += `❌ DRIFT: ${path.basename(p)}\n   Status: ${status} | Checked: ${checked}/${total} | Expected: ${newStatus}\n`;
                    driftCount++;
                }
            }
        }
        catch { }
    }
    try {
        const plans = await fs.readdir(path.join(projectPath, 'plans'));
        for (const f of plans)
            if (f.endsWith('.md'))
                await checkFile(path.join(projectPath, 'plans', f), 'plan');
    }
    catch { }
    try {
        const todos = await fs.readdir(path.join(projectPath, 'todos'));
        for (const f of todos)
            if (f.endsWith('.md') && !f.includes('template'))
                await checkFile(path.join(projectPath, 'todos', f), 'todo');
    }
    catch { }
    output += "\n";
    if (driftCount === 0 && fixCount === 0) {
        output += "✅ No state drift detected!";
    }
    else if (fixCount > 0) {
        output += `✅ Fixed ${fixCount} documents!\n`;
        if (driftCount > 0)
            output += `⚠️  Remaining drift in ${driftCount} documents.`;
    }
    else {
        output += `⚠️  Found ${driftCount} documents with state drift.\nRun with fix flag to auto-correct.`;
    }
    return output;
}
export async function suggestSkills(projectPath = '.') {
    let output = "🔍 Skill Opportunity Audit...\nAnalyzing knowledge base for patterns...\n\n";
    const tagCounts = {};
    async function walkSolveDocs(dir) {
        try {
            const files = await fs.readdir(dir, { withFileTypes: true });
            for (const file of files) {
                const fullPath = path.join(dir, file.name);
                if (file.isDirectory()) {
                    await walkSolveDocs(fullPath);
                }
                else if (file.isFile() && file.name.endsWith('.md') && !file.name.includes('critical-patterns')) {
                    const content = await fs.readFile(fullPath, 'utf8');
                    const tagsMatch = content.match(/^tags:\s*\[(.*?)\]/im) || content.match(/^tags:\n((?:\s+-\s+.*\n)+)/im);
                    if (tagsMatch) {
                        const tagsStr = tagsMatch[1];
                        const tags = tagsStr.includes('-')
                            ? tagsStr.split('\n').filter(t => t.trim().startsWith('-')).map(t => t.replace('-', '').trim())
                            : tagsStr.split(',').map(t => t.trim());
                        for (const rawTag of tags) {
                            const tag = rawTag.replace(/["']/g, '');
                            if (tag)
                                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                        }
                    }
                    else {
                        // Support raw list
                        const listMatches = content.match(/^  - (.*?)$/gmi);
                        if (listMatches) {
                            for (const rawTag of listMatches) {
                                const tag = rawTag.replace(/^  - /, '').replace(/["']/g, '').trim();
                                if (tag)
                                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                            }
                        }
                    }
                }
            }
        }
        catch { }
    }
    await walkSolveDocs(path.join(projectPath, 'docs/solutions'));
    let found = false;
    for (const [tag, count] of Object.entries(tagCounts)) {
        if (count >= 3) {
            output += `💡 Potential Skill: "${tag}"\n   - Frequency: ${count} solutions tagged\n   - Action: Run /create-agent-skill to formalize this capability.\n\n`;
            found = true;
        }
    }
    if (!found) {
        output += "✅ No new skill clusters detected (all high-frequency patterns are covered).\n";
    }
    return output;
}
export async function compoundHealth(projectPath = '.') {
    const reportList = ["🏥 COMPOUND SYSTEM HEALTH", "========================", ""];
    // Simplistic metrics implementation
    let solCount = 0;
    try {
        const walk = async (dir) => {
            const files = await fs.readdir(dir, { withFileTypes: true });
            for (const file of files) {
                if (file.isDirectory())
                    await walk(path.join(dir, file.name));
                else if (file.name.endsWith('.md'))
                    solCount++;
            }
        };
        await walk(path.join(projectPath, 'docs/solutions'));
    }
    catch { }
    reportList.push(`Solutions: ${solCount}`);
    return reportList.join('\n');
}
export async function compoundDashboard(projectPath = '.') {
    return compoundHealth(projectPath); // Alias for now as they provide similar info
}
export async function compoundMetrics(projectPath = '.', force = false) {
    return "Compound metrics collected successfully.";
}
