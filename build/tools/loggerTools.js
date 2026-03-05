import * as fs from 'fs/promises';
import * as path from 'path';
function getLogDir(projectPath = '.') {
    return path.join(projectPath, 'docs', 'agents', 'logs');
}
export async function logSkill(skill, trigger = 'manual', context = '', projectPath = '.') {
    // Format timestamp like 2026-03-04T00:12:42Z (ISO 8601 without milliseconds)
    const timestamp = new Date().toISOString().replace(/\.[0-9]{3}Z$/, 'Z');
    const logDir = getLogDir(projectPath);
    await fs.mkdir(logDir, { recursive: true });
    const logLine = `${timestamp}|${skill}|${trigger}|${context}\n`;
    await fs.appendFile(path.join(logDir, 'skill_usage.log'), logLine);
    return `Successfully logged skill usage for ${skill}`;
}
export async function logWorkflow(workflow, session = '', projectPath = '.') {
    const timestamp = new Date().toISOString().replace(/\.[0-9]{3}Z$/, 'Z');
    if (!session) {
        session = Math.floor(Date.now() / 1000).toString();
    }
    const logDir = getLogDir(projectPath);
    await fs.mkdir(logDir, { recursive: true });
    const logLine = `${timestamp}|${workflow}|${session}\n`;
    await fs.appendFile(path.join(logDir, 'workflow_usage.log'), logLine);
    return `Successfully logged workflow usage for ${workflow}`;
}
export async function rotateLogs(projectPath = '.', retentionDays = 90) {
    const logDir = getLogDir(projectPath);
    try {
        const stats = await fs.stat(logDir);
        if (!stats.isDirectory())
            return 'Log directory does not exist.';
    }
    catch {
        return 'Log directory does not exist.';
    }
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffTimestamp = cutoffDate.toISOString().replace(/\.[0-9]{3}Z$/, 'Z');
    let count = 0;
    const files = await fs.readdir(logDir);
    let output = `🔄 Rotating logs older than ${retentionDays} days...\n`;
    for (const file of files) {
        if (file.endsWith('_usage.log')) {
            const filePath = path.join(logDir, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split('\n');
            let origLines = 0;
            const newLines = [];
            for (const line of lines) {
                if (!line.trim())
                    continue;
                origLines++;
                const timestamp = line.split('|')[0];
                if (timestamp >= cutoffTimestamp) {
                    newLines.push(line);
                }
            }
            if (origLines !== newLines.length) {
                const diff = origLines - newLines.length;
                await fs.writeFile(filePath, newLines.join('\n') + (newLines.length > 0 ? '\n' : ''));
                output += `  - Pruned ${diff} lines from ${file}\n`;
                count++;
            }
        }
    }
    if (count === 0) {
        output += `  (No logs needed rotation)\n`;
    }
    return output.trim();
}
