import * as fs from 'fs/promises';
import * as path from 'path';

export interface PerformanceIssue {
    file: string;
    type: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    issue: string;
    fix: string;
    section: string;
}

export class PerformanceChecker {
    projectPath: string;
    issues: PerformanceIssue[] = [];
    warnings: PerformanceIssue[] = [];

    constructor(projectPath: string) {
        this.projectPath = path.resolve(projectPath);
    }

    async getFiles(extensions: string[]): Promise<string[]> {
        let files: string[] = [];
        const self = this;
        async function search(dir: string) {
            try {
                const items = await fs.readdir(dir, { withFileTypes: true });
                for (const item of items) {
                    if (['node_modules', '.git', 'dist', 'build', '.next'].includes(item.name)) continue;

                    const fullPath = path.join(dir, item.name);
                    if (item.isDirectory()) await search(fullPath);
                    else if (extensions.includes(path.extname(item.name).toLowerCase())) {
                        files.push(fullPath);
                    }
                }
            } catch { }
        }
        await search(this.projectPath);
        return files;
    }

    async checkWaterfalls(files: string[]) {
        for (const file of files) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                const lines = content.split('\n');
                let consecutiveAwaits = 0;

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (/await\s+/.test(line)) {
                        consecutiveAwaits++;
                        if (consecutiveAwaits > 1) {
                            this.issues.push({
                                file: path.relative(this.projectPath, file),
                                type: 'CRITICAL',
                                issue: 'Sequential awaits detected (waterfall)',
                                fix: 'Use Promise.all() for parallel fetching',
                                section: '1-async-eliminating-waterfalls.md'
                            });
                            break; // report once per file is enough for test
                        }
                    } else if (line.trim().length > 0 && !line.trim().startsWith('//')) {
                        consecutiveAwaits = 0;
                    }
                }
            } catch { }
        }
    }

    async checkBarrelImports(files: string[]) {
        for (const file of files) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                if (/import.*from\s+['"](@\/.*?)\/index['"]/.test(content) || /import.*from\s+['"]\.\.?\/.*?['"](?!\.tsx?)/.test(content)) {
                    this.warnings.push({
                        file: path.relative(this.projectPath, file),
                        type: 'CRITICAL',
                        issue: 'Potential barrel imports detected',
                        fix: 'Import directly from specific files',
                        section: '2-bundle-bundle-size-optimization.md'
                    });
                }
            } catch { }
        }
    }

    async checkDynamicImports(files: string[]) {
        for (const file of files) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                if (content.length > 10000) {
                    const filename = path.parse(file).name;
                    for (const checkFile of files) {
                        if (checkFile === file) continue;
                        const checkContent = await fs.readFile(checkFile, 'utf-8');
                        if ((checkContent.includes(`import ${filename}`) || checkContent.includes(`import { ${filename}`)) && !checkContent.includes('dynamic(')) {
                            this.warnings.push({
                                file: path.relative(this.projectPath, checkFile),
                                type: 'CRITICAL',
                                issue: `Large component ${filename} imported statically`,
                                fix: 'Use dynamic() for code splitting',
                                section: '2-bundle-bundle-size-optimization.md'
                            });
                            break;
                        }
                    }
                }
            } catch { }
        }
    }

    async checkUseEffectFetching(files: string[]) {
        for (const file of files) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                if (content.includes('useEffect') && /useEffect.*?fetch\(/s.test(content)) {
                    this.warnings.push({
                        file: path.relative(this.projectPath, file),
                        type: 'MEDIUM', // Mapped from MEDIUM-HIGH to fit interface
                        issue: 'Data fetching in useEffect',
                        fix: 'Consider using SWR or React Query for deduplication',
                        section: '4-client-client-side-data-fetching.md'
                    });
                }
            } catch { }
        }
    }

    async checkMissingMemoization(files: string[]) {
        for (const file of files.filter(f => f.endsWith('.tsx'))) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                const components = content.match(/(?:export\s+)?(?:const|function)\s+([A-Z]\w+)/g);
                if (components && !content.includes('React.memo') && !content.includes('memo(')) {
                    if (content.includes('props:') || content.includes('Props>')) {
                        this.warnings.push({
                            file: path.relative(this.projectPath, file),
                            type: 'MEDIUM',
                            issue: 'Component with props not memoized',
                            fix: 'Consider using React.memo if props are stable',
                            section: '5-rerender-re-render-optimization.md'
                        });
                    }
                }
            } catch { }
        }
    }

    async checkImageOptimization(files: string[]) {
        for (const file of files) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                if (content.includes('<img') && !content.includes('next/image')) {
                    this.warnings.push({
                        file: path.relative(this.projectPath, file),
                        type: 'MEDIUM',
                        issue: 'Using <img> instead of next/image',
                        fix: 'Use next/image for automatic optimization',
                        section: '6-rendering-rendering-performance.md'
                    });
                }
            } catch { }
        }
    }

    async runAll() {
        const tsJsFiles = await this.getFiles(['.ts', '.tsx', '.js', '.jsx']);
        const tsxFiles = tsJsFiles.filter(f => f.endsWith('.tsx') || f.endsWith('.ts')); // for dynamic/effects

        await this.checkWaterfalls(tsJsFiles);
        await this.checkBarrelImports(tsJsFiles);
        await this.checkDynamicImports(tsxFiles); // Usually larger components are in ts/tsx
        await this.checkUseEffectFetching(tsxFiles);
        await this.checkMissingMemoization(tsxFiles);
        await this.checkImageOptimization(tsJsFiles);

        return {
            issues: this.issues,
            warnings: this.warnings,
            passed: this.issues.length === 0 && this.warnings.filter(w => w.type === 'CRITICAL').length === 0
        };
    }
}

export async function runReactPerformanceChecker(projectPath: string = "."): Promise<{ passed: boolean, report: string }> {
    const checker = new PerformanceChecker(projectPath);
    const result = await checker.runAll();

    let report = `============================================================\n`;
    report += `REACT PERFORMANCE AUDIT REPORT\n`;
    report += `============================================================\n`;

    const crits = result.issues.filter(i => i.type === 'CRITICAL');
    report += `\n[CRITICAL ISSUES] (${crits.length})\n`;
    for (const issue of crits) {
        report += `  - ${issue.file}\n    Issue: ${issue.issue}\n    Fix: ${issue.fix}\n    Reference: ${issue.section}\n\n`;
    }

    report += `\n[WARNINGS] (${result.warnings.length})\n`;
    for (const warning of result.warnings.slice(0, 10)) {
        report += `  - ${warning.file}\n    Issue: ${warning.issue}\n    Fix: ${warning.fix}\n    Reference: ${warning.section}\n\n`;
    }

    if (result.warnings.length > 10) report += `  ... and ${result.warnings.length - 10} more warnings\n`;

    report += `\n============================================================\nSUMMARY:\n`;
    report += `  Critical Issues: ${crits.length}\n  Warnings: ${result.warnings.length}\n`;
    report += `============================================================\n`;

    if (result.issues.length === 0 && result.warnings.length === 0) report += `\n[SUCCESS] No major performance issues detected!\n`;
    else report += `\n[ACTION REQUIRED] Review and fix issues above\nPriority: CRITICAL > HIGH > MEDIUM > LOW\n`;

    return { passed: result.passed, report };
}
