import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import { auditStateDrift } from "./compoundTools.js";
import { checkDocsFreshness, validateFolderDocs } from "./docsTools.js";

function runGit(cmd: string, cwd: string): string {
    try {
        return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
        return '';
    }
}

export async function generateChangelog(projectPath: string = '.'): Promise<string> {
    const typeMap: Record<string, { emoji: string, title: string }> = {
        feat: { emoji: '✨', title: 'Features' },
        fix: { emoji: '🐛', title: 'Bug Fixes' },
        docs: { emoji: '📚', title: 'Documentation' },
        perf: { emoji: '⚡', title: 'Performance' },
        refactor: { emoji: '♻️', title: 'Refactoring' },
        test: { emoji: '🧪', title: 'Testing' },
        chore: { emoji: '🔧', title: 'Maintenance' },
        build: { emoji: '🏗️', title: 'Build System' },
        ci: { emoji: '👷', title: 'CI' }
    };

    const lastTag = runGit('git describe --tags --abbrev=0 2>/dev/null', projectPath);
    const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
    const logOutput = runGit(`git log ${range} --pretty=format:"%h|%s|%an|%ad" --date=short`, projectPath);

    if (!logOutput) {
        return 'No commits found. Nothing to update.';
    }

    const commits = logOutput.split('\n').map(line => {
        const [hash, subject, author, date] = line.split('|');
        return { hash, subject, author, date };
    });

    const categorized: Record<string, any[]> = {};
    const sortOrder = ['feat', 'fix', 'docs', 'perf', 'refactor', 'test', 'chore', 'other'];

    commits.forEach(commit => {
        const match = commit.subject.match(/^(\w+)(?:\(([^)]+)\))?: (.+)$/);
        const type = match ? match[1] : 'other';
        const typeKey = typeMap[type] ? type : 'other';

        if (!categorized[typeKey]) categorized[typeKey] = [];
        categorized[typeKey].push({
            type: match ? match[1] : 'other',
            scope: match ? match[2] : null,
            message: match ? match[3] : commit.subject,
            hash: commit.hash
        });
    });

    const today = new Date().toISOString().split('T')[0];
    let markdown = `## [Unreleased] - ${today}\n\n`;

    sortOrder.forEach(type => {
        if (categorized[type] && categorized[type].length > 0) {
            const header = typeMap[type] ? `${typeMap[type].emoji} ${typeMap[type].title}` : 'Other Changes';
            markdown += `### ${header}\n`;
            categorized[type].forEach((item: any) => {
                const scope = item.scope ? `**${item.scope}:** ` : '';
                markdown += `- ${scope}${item.message} (${item.hash})\n`;
            });
            markdown += '\n';
        }
    });

    const changelogPath = path.join(projectPath, 'CHANGELOG.md');
    let content = '';
    try {
        content = await fs.readFile(changelogPath, 'utf8');
    } catch {
        content = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';
    }

    const newContent = content.startsWith('# Changelog')
        ? content.replace(/# Changelog.*?\n\n/s, (match) => match + markdown)
        : markdown + content;

    await fs.writeFile(changelogPath, newContent);
    return `✅ Changelog updated at ${changelogPath}`;
}

export async function validateChangelog(projectPath: string = '.'): Promise<string> {
    const changelogPath = path.join(projectPath, 'CHANGELOG.md');
    let content = '';
    try {
        content = await fs.readFile(changelogPath, 'utf8');
    } catch {
        return "⚠️  CHANGELOG.md not found";
    }

    const unreleasedCount = (content.match(/^## \[Unreleased\]/gm) || []).length;
    let errors = 0;
    let output = '';

    if (unreleasedCount > 1) {
        output += `❌ ERROR: Multiple [Unreleased] sections found: ${unreleasedCount}\n`;
        errors++;
    }

    if (content.includes('<<<<<<< ') || content.includes('=======') || content.includes('>>>>>>> ')) {
        output += "❌ ERROR: Merge conflict markers found in CHANGELOG.md\n";
        errors++;
    }

    if (errors === 0) {
        output += "✅ CHANGELOG.md validation passed";
    }

    return output;
}

export async function archiveCompleted(projectPath: string = '.', apply: boolean = false): Promise<string> {
    let archivedCount = 0;
    let skippedCount = 0;
    let output = `📦 Archive Completed Documents (${apply ? 'APPLYING CHANGES' : 'DRY-RUN'})\n\n`;

    const ensureDir = async (dir: string) => {
        await fs.mkdir(path.join(projectPath, dir), { recursive: true });
    };

    await Promise.all([
        ensureDir('todos/archive'),
        ensureDir('plans/archive'),
        ensureDir('docs/specs/archive'),
        ensureDir('docs/explorations/archive')
    ]);

    const doArchive = async (fileDestTuple: [string, string]) => {
        const [src, destDir] = fileDestTuple;
        const basename = path.basename(src);
        const dest = path.join(projectPath, destDir, basename);
        if (apply) {
            await fs.rename(src, dest);
        }
        output += `[ARCHIVED] ${basename} -> ${destDir}/\n`;
        archivedCount++;
    };

    // Check todos
    try {
        const todos = await fs.readdir(path.join(projectPath, 'todos'));
        for (const file of todos) {
            if (!file.endsWith('.md') || file === 'todo-template.md' || file === 'archive') continue;
            const src = path.join(projectPath, 'todos', file);
            if (file.includes('-done-')) {
                await doArchive([src, 'todos/archive']);
            } else {
                const content = await fs.readFile(src, 'utf8');
                if (/^status:.*done/mi.test(content)) {
                    await doArchive([src, 'todos/archive']);
                } else {
                    skippedCount++;
                }
            }
        }
    } catch { }

    // Check plans
    try {
        const plans = await fs.readdir(path.join(projectPath, 'plans'));
        for (const file of plans) {
            if (!file.endsWith('.md') || file === 'README.md' || file === 'archive') continue;
            const src = path.join(projectPath, 'plans', file);
            const content = await fs.readFile(src, 'utf8');
            const total = (content.match(/^- \[[x ]\]/gmi) || []).length;
            const checked = (content.match(/^- \[x\]/gmi) || []).length;

            if (/^>?\s*Status:.*Implemented/mi.test(content) || (total > 0 && total === checked)) {
                await doArchive([src, 'plans/archive']);
            } else {
                skippedCount++;
            }
        }
    } catch { }

    output += `\nSummary: Archived ${archivedCount} items. (Skipped ${skippedCount})\n`;
    return output;
}

export async function prePushHousekeeping(projectPath: string = '.', fix: boolean = false): Promise<string> {
    let output = "🧹 Pre-Push Housekeeping Check\n================================\n\n";
    let issues = 0;

    output += await checkDocsFreshness(false, projectPath) + "\n\n";

    output += `📋 Check: State Drift\n`;
    const driftRes = await auditStateDrift(projectPath, fix);
    output += driftRes + "\n\n";
    if (driftRes.includes('DRIFT:')) issues++;

    output += `📦 Check: Unarchived Completed Items\n`;
    const archiveRes = await archiveCompleted(projectPath, fix);
    output += archiveRes + "\n\n";
    if (archiveRes.includes('[ARCHIVED]') && !fix) issues++;

    output += `📚 Check: Documentation Validation\n`;
    const validateDocsRes = await validateFolderDocs(false, [], projectPath);
    output += validateDocsRes + "\n\n";
    if (validateDocsRes.includes('❌')) issues++;

    if (issues > 0) {
        output += `❌ Found ${issues} category issue(s) - push blocked.`;
    } else {
        output += `✅ All checks passed - ready to push!`;
    }

    return output;
}
