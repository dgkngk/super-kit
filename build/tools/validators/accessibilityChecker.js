import * as fs from 'fs/promises';
import * as path from 'path';
export async function findHtmlFiles(projectPath) {
    let files = [];
    const skipDirs = new Set(['node_modules', '.next', 'dist', 'build', '.git']);
    async function search(dir) {
        try {
            const items = await fs.readdir(dir, { withFileTypes: true });
            for (const item of items) {
                if (skipDirs.has(item.name))
                    continue;
                const fullPath = path.join(dir, item.name);
                if (item.isDirectory())
                    await search(fullPath);
                else {
                    const ext = path.extname(item.name).toLowerCase();
                    if (['.html', '.jsx', '.tsx'].includes(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        }
        catch { }
    }
    await search(projectPath);
    return files.slice(0, 50);
}
export async function checkAccessibility(filePath) {
    const issues = [];
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lowerContent = content.toLowerCase();
        const inputs = content.match(/<input[^>]*>/gi) || [];
        for (const inp of inputs) {
            if (!inp.toLowerCase().includes('type="hidden"')) {
                if (!inp.toLowerCase().includes('aria-label') && !inp.toLowerCase().includes('id=')) {
                    issues.push("Input without label or aria-label");
                    break;
                }
            }
        }
        const buttons = content.match(/<button[^>]*>[^<]*<\/button>/gi) || [];
        for (const btn of buttons) {
            if (!btn.toLowerCase().includes('aria-label')) {
                const text = btn.replace(/<[^>]+>/g, '').trim();
                if (!text) {
                    issues.push("Button without accessible text");
                    break;
                }
            }
        }
        if (lowerContent.includes('<html') && !lowerContent.includes('lang=')) {
            issues.push("Missing lang attribute on <html>");
        }
        if (lowerContent.includes('<main') || lowerContent.includes('<body')) {
            if (!lowerContent.includes('skip') && !lowerContent.includes('#main')) {
                issues.push("Consider adding skip-to-main-content link");
            }
        }
        const onClickCount = (lowerContent.match(/onclick=/g) || []).length;
        const keyCount = (lowerContent.match(/onkeydown=|onkeyup=/g) || []).length;
        if (onClickCount > 0 && keyCount === 0) {
            issues.push("onClick without keyboard handler (onKeyDown)");
        }
        if (lowerContent.includes('tabindex=')) {
            if (!lowerContent.includes('tabindex="-1"') && !lowerContent.includes('tabindex="0"')) {
                const positive = lowerContent.match(/tabindex="([1-9]\d*)"/);
                if (positive)
                    issues.push("Avoid positive tabIndex values");
            }
        }
        if (lowerContent.includes('autoplay') && !lowerContent.includes('muted')) {
            issues.push("Autoplay media should be muted");
        }
        if (lowerContent.includes('role="button"')) {
            const divButtons = content.match(/<div[^>]*role="button"[^>]*>/gi) || [];
            for (const div of divButtons) {
                if (!div.toLowerCase().includes('tabindex')) {
                    issues.push("role='button' without tabindex");
                    break;
                }
            }
        }
    }
    catch (e) {
        issues.push(`Error reading file: ${e.message.substring(0, 50)}`);
    }
    return issues;
}
export async function runAccessibilityChecker(projectPath = ".") {
    const root = path.resolve(projectPath);
    let report = `============================================================\n`;
    report += `[ACCESSIBILITY CHECKER] WCAG Compliance Audit\n`;
    report += `============================================================\n`;
    report += `Project: ${root}\n------------------------------------------------------------\n`;
    const files = await findHtmlFiles(root);
    report += `Found ${files.length} HTML/JSX/TSX files\n`;
    if (files.length === 0) {
        return { passed: true, report: report + "No HTML files found\n" };
    }
    const allIssues = [];
    for (const file of files) {
        const issues = await checkAccessibility(file);
        if (issues.length > 0) {
            allIssues.push({ file: path.basename(file), issues });
        }
    }
    report += `\n============================================================\nACCESSIBILITY ISSUES\n============================================================\n`;
    if (allIssues.length > 0) {
        for (const item of allIssues.slice(0, 10)) {
            report += `\n${item.file}:\n`;
            for (const issue of item.issues)
                report += `  - ${issue}\n`;
        }
        if (allIssues.length > 10)
            report += `\n... and ${allIssues.length - 10} more files with issues\n`;
    }
    else {
        report += "No accessibility issues found!\n";
    }
    const totalIssues = allIssues.reduce((sum, item) => sum + item.issues.length, 0);
    const passed = totalIssues < 5;
    return { passed, report };
}
