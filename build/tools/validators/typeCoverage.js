import * as fs from 'fs/promises';
import * as path from 'path';
async function getFiles(dir, extensionRegex, excludeList) {
    let files = [];
    try {
        const items = await fs.readdir(dir, { withFileTypes: true });
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            if (excludeList.some(ex => fullPath.includes(ex)))
                continue;
            if (item.isDirectory()) {
                files = files.concat(await getFiles(fullPath, extensionRegex, excludeList));
            }
            else if (extensionRegex.test(item.name)) {
                files.push(fullPath);
            }
        }
    }
    catch { } // Ignore read errors
    return files;
}
export async function checkTypescriptCoverage(projectPath) {
    const passed = [];
    const issues = [];
    const stats = { any_count: 0, untyped_functions: 0, total_functions: 0 };
    const exclude = ['node_modules', '.d.ts', 'dist', 'build', '.next'];
    const tsFiles = await getFiles(projectPath, /\.(ts|tsx)$/, exclude);
    if (tsFiles.length === 0) {
        return { type: 'typescript', files: 0, passed, issues: ["[!] No TypeScript files found"], stats };
    }
    // Check first 30 files for performance
    for (const filePath of tsFiles.slice(0, 30)) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            // any count
            const anyMatches = content.match(/:\s*any\b/g);
            if (anyMatches)
                stats.any_count += anyMatches.length;
            // untyped functions
            const untypedFuncs = content.match(/function\s+\w+\s*\([^)]*\)\s*{/g);
            if (untypedFuncs)
                stats.untyped_functions += untypedFuncs.length;
            const untypedArrows = content.match(/=\s*\([^:)]*\)\s*=>/g);
            if (untypedArrows)
                stats.untyped_functions += untypedArrows.length;
            // typed functions
            let typedCount = 0;
            const typedFuncs = content.match(/function\s+\w+\s*\([^)]*\)\s*:\s*\w+/g);
            if (typedFuncs)
                typedCount += typedFuncs.length;
            const typedArrows = content.match(/:\s*\([^)]*\)\s*=>\s*\w+/g);
            if (typedArrows)
                typedCount += typedArrows.length;
            stats.total_functions += (typedCount + (untypedFuncs?.length || 0) + (untypedArrows?.length || 0));
        }
        catch { }
    }
    if (stats.any_count === 0)
        passed.push("[OK] No 'any' types found");
    else if (stats.any_count <= 5)
        issues.push(`[!] ${stats.any_count} 'any' types found (acceptable)`);
    else
        issues.push(`[X] ${stats.any_count} 'any' types found (too many)`);
    if (stats.total_functions > 0) {
        const typedRatio = ((stats.total_functions - stats.untyped_functions) / stats.total_functions) * 100;
        if (typedRatio >= 80)
            passed.push(`[OK] Type coverage: ${typedRatio.toFixed(0)}%`);
        else if (typedRatio >= 50)
            issues.push(`[!] Type coverage: ${typedRatio.toFixed(0)}% (improve)`);
        else
            issues.push(`[X] Type coverage: ${typedRatio.toFixed(0)}% (too low)`);
    }
    passed.push(`[OK] Analyzed ${tsFiles.length} TypeScript files`);
    return { type: 'typescript', files: tsFiles.length, passed, issues, stats };
}
export async function checkPythonCoverage(projectPath) {
    const passed = [];
    const issues = [];
    const stats = { any_count: 0, untyped_functions: 0, total_functions: 0, typed_functions: 0 };
    const exclude = ['venv', '__pycache__', '.git', 'node_modules'];
    const pyFiles = await getFiles(projectPath, /\.py$/, exclude);
    if (pyFiles.length === 0) {
        return { type: 'python', files: 0, passed, issues: ["[!] No Python files found"], stats };
    }
    for (const filePath of pyFiles.slice(0, 30)) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const anyMatches = content.match(/:\s*Any\b/g);
            if (anyMatches)
                stats.any_count += anyMatches.length;
            const allFuncs = content.match(/def\s+\w+\s*\([^)]*\)(?:\s*->[^:]+)?\s*:/g);
            if (allFuncs) {
                let localTyped = 0;
                for (const f of allFuncs) {
                    const argsPart = f.substring(f.indexOf('('), f.lastIndexOf(')'));
                    const hasReturn = f.includes('->');
                    const hasTypedArgs = argsPart.includes(':');
                    if (hasTypedArgs || hasReturn) {
                        localTyped++;
                    }
                }
                stats.typed_functions += localTyped;
                stats.untyped_functions += allFuncs.length - localTyped;
            }
        }
        catch { }
    }
    stats.total_functions = stats.typed_functions + stats.untyped_functions;
    if (stats.total_functions > 0) {
        const typedRatio = (stats.typed_functions / stats.total_functions) * 100;
        if (typedRatio >= 70)
            passed.push(`[OK] Type hints coverage: ${typedRatio.toFixed(0)}%`);
        else if (typedRatio >= 40)
            issues.push(`[!] Type hints coverage: ${typedRatio.toFixed(0)}%`);
        else
            issues.push(`[X] Type hints coverage: ${typedRatio.toFixed(0)}% (add type hints)`);
    }
    if (stats.any_count === 0)
        passed.push("[OK] No 'Any' types found");
    else if (stats.any_count <= 3)
        issues.push(`[!] ${stats.any_count} 'Any' types found`);
    else
        issues.push(`[X] ${stats.any_count} 'Any' types found`);
    passed.push(`[OK] Analyzed ${pyFiles.length} Python files`);
    return { type: 'python', files: pyFiles.length, passed, issues, stats };
}
export async function runTypeCoverage(projectPath = ".") {
    const tsRes = await checkTypescriptCoverage(projectPath);
    const pyRes = await checkPythonCoverage(projectPath);
    const results = [tsRes, pyRes].filter(r => r.files > 0);
    if (results.length === 0) {
        return { passed: true, report: "[!] No TypeScript or Python files found." };
    }
    let report = "";
    let criticalIssues = 0;
    for (const res of results) {
        report += `\n[${res.type.toUpperCase()}]\n----------------------------------------\n`;
        for (const p of res.passed)
            report += `  ${p}\n`;
        for (const i of res.issues) {
            report += `  ${i}\n`;
            if (i.startsWith("[X]"))
                criticalIssues++;
        }
    }
    report += `\n============================================================\n`;
    const passed = criticalIssues === 0;
    report += passed ? `[OK] TYPE COVERAGE: ACCEPTABLE` : `[X] TYPE COVERAGE: ${criticalIssues} critical issues`;
    return { passed, report };
}
