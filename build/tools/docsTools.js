import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
function runGit(cmd, cwd) {
    try {
        return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    }
    catch {
        return '';
    }
}
export async function bootstrapFolderDocs(folder, projectPath = '.') {
    const targetFolder = path.resolve(projectPath, folder);
    const templatePath = path.resolve(projectPath, 'docs/templates/folder-readme-template.md');
    const readmePath = path.join(targetFolder, 'README.md');
    try {
        await fs.access(targetFolder);
    }
    catch {
        return `Error: Directory ${targetFolder} does not exist.`;
    }
    try {
        await fs.access(readmePath);
        return `README.md already exists at ${readmePath}. Refusing to overwrite.`;
    }
    catch { }
    const folderName = path.basename(targetFolder);
    let content = '';
    try {
        content = await fs.readFile(templatePath, 'utf8');
    }
    catch {
        // Fallback simple template
        content = `# {Folder Name}\n\n## Purpose\n\n## Components\n{filename}\n\n## Component Details\n\n## Changelog\n`;
    }
    content = content.replace(/\{Folder Name\}/g, folderName);
    // Find components
    let tableContent = '';
    const files = await fs.readdir(targetFolder);
    for (const f of files.sort()) {
        if (f.match(/\.(tsx|ts|js|py|sh)$/) && !f.includes('.test.') && f !== 'README.md') {
            tableContent += `| \`${f}\` | | \`✅ Stable\` |\n`;
        }
    }
    if (tableContent) {
        content = content.replace(/\{filename\}/g, tableContent.trim());
    }
    else {
        content = content.replace(/\{filename\}/g, '');
    }
    await fs.writeFile(readmePath, content);
    return `✅ Bootstrapped documentation at ${readmePath}`;
}
export async function checkDocsFreshness(skipDocs = false, projectPath = '.') {
    if (skipDocs)
        return "⏭️  Skipping documentation freshness check (--skip-docs)";
    let changedFilesStr = runGit('git diff --staged --name-only', projectPath);
    let commitMsg = "staged changes";
    if (!changedFilesStr) {
        changedFilesStr = runGit('git diff HEAD~1 --name-only', projectPath);
        commitMsg = runGit('git log -1 --pretty=%s', projectPath) || 'previous commit';
    }
    if (!changedFilesStr) {
        return "✅ Documentation checks passed (no changes detectd).";
    }
    let warnings = 0;
    let output = `🔍 Checking documentation freshness for: ${commitMsg}\n`;
    const changedFiles = changedFilesStr.split('\n');
    const newScripts = changedFiles.filter(f => f.startsWith('scripts/') && f !== 'scripts/README.md');
    if (newScripts.length > 0 && !changedFiles.includes('scripts/README.md')) {
        output += "⚠️  Scripts modified but scripts/README.md not updated.\n";
        warnings++;
    }
    const newWorkflows = changedFiles.filter(f => f.startsWith('.agent/workflows/') && f !== '.agent/workflows/README.md');
    if (newWorkflows.length > 0 && !changedFiles.includes('.agent/workflows/README.md')) {
        output += "⚠️  Workflows modified but .agent/workflows/README.md not updated.\n";
        warnings++;
    }
    const codeChanged = changedFiles.some(f => /^(src|components|lib|app)\//.test(f));
    const docsChanged = changedFiles.some(f => /^docs\//.test(f));
    if (codeChanged && !docsChanged) {
        output += "⚠️  Code modified but no files in docs/ updated.\n    (If this is internal/refactor, ignore. If feature work, update docs!)\n";
        warnings++;
    }
    if (warnings > 0) {
        output += "\n💡 Run '/work' to follow the documentation phase.\n(Warning generated; check bypassed).";
    }
    else {
        output += "✅ Documentation checks passed.";
    }
    return output;
}
export async function discoverUndocumentedFolders(projectPath = '.') {
    const roots = ["app", "lib", "backend", "scripts", "src"];
    const exclusions = ["node_modules", "__pycache__", ".git", "__tests__", "archive", ".vercel", ".next", "dist"];
    const undocumented = [];
    async function scanDir(dir, depth) {
        if (depth > 2)
            return;
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            let hasSource = false;
            let hasReadme = false;
            for (const entry of entries) {
                if (exclusions.some(ex => entry.name.includes(ex)))
                    continue;
                if (entry.isDirectory()) {
                    await scanDir(path.join(dir, entry.name), depth + 1);
                }
                else if (entry.isFile()) {
                    if (entry.name === 'README.md')
                        hasReadme = true;
                    if (/\.(ts|tsx|py|sh)$/.test(entry.name))
                        hasSource = true;
                }
            }
            if (hasSource && !hasReadme && depth > 0) {
                undocumented.push(path.relative(projectPath, dir));
            }
        }
        catch { }
    }
    for (const root of roots) {
        await scanDir(path.join(projectPath, root), 1);
    }
    if (undocumented.length > 0) {
        let out = `❌ Found ${undocumented.length} undocumented folder(s):\n`;
        for (const folder of undocumented)
            out += `   - ${folder}\n`;
        return out;
    }
    return "✅ All key folders have README documentation.";
}
export async function validateFolderDocs(strict = false, targetFolders = [], projectPath = '.') {
    const coreFolders = ["src", "scripts", "docs/solutions", "docs/architecture", ".agent/workflows"];
    const foldersToCheck = targetFolders.length > 0 ? targetFolders : coreFolders;
    let exitCode = 0;
    let output = "🔍 Validating hierarchical documentation...\n";
    for (const folder of foldersToCheck) {
        const fullFolder = path.resolve(projectPath, folder);
        try {
            const stats = await fs.stat(fullFolder);
            if (!stats.isDirectory())
                continue;
        }
        catch {
            continue;
        }
        const readmePath = path.join(fullFolder, 'README.md');
        let content = '';
        try {
            content = await fs.readFile(readmePath, 'utf8');
        }
        catch {
            output += `❌ Missing README.md in: ${folder}\n`;
            exitCode = 1;
            continue;
        }
        const missing = [];
        if (!content.includes("## Purpose"))
            missing.push("Purpose");
        if (!/## (Key )?Components/.test(content))
            missing.push("Components");
        if (!content.includes("## Component Details"))
            missing.push("Component Details");
        if (!content.includes("## Changelog"))
            missing.push("Changelog");
        if (missing.length > 0) {
            output += `❌ README.md in ${folder} is missing sections: ${missing.join(', ')}\n`;
            exitCode = 1;
        }
        else if (content.includes("{Brief 1-sentence description}") || content.includes("{filename}")) {
            output += `⚠️  README.md in ${folder} still contains template placeholders.\n`;
        }
        else {
            output += `✅ ${folder}/README.md is valid.\n`;
        }
        // Simplistic component check
        try {
            const entries = await fs.readdir(fullFolder);
            for (const file of entries) {
                if (/\.(tsx|ts|js)$/.test(file) && !file.includes('.test.')) {
                    if (!content.includes(`\`${file}\``)) {
                        output += `⚠️  Documented component missing entry: ${file} in ${folder}/README.md\n`;
                    }
                }
            }
        }
        catch { }
    }
    if (exitCode === 0) {
        output += "✨ All documentation checks passed!\n";
    }
    else {
        output += "❌ Some documentation checks failed.\n";
    }
    return output;
}
