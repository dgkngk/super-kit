import * as fs from 'fs/promises';
import * as path from 'path';

const SKIP_DIRS = ['node_modules', '.next', 'dist', 'build', '.git', '.github', '.vscode', '.idea', 'coverage', 'test', 'tests', '__tests__', 'spec', 'docs', 'documentation', 'examples'];
const SKIP_PATTERNS = ['config', 'setup', 'util', 'helper', 'hook', 'context', 'store', 'service', 'api', 'lib', 'constant', 'type', 'interface', 'mock', '.test.', '.spec.', '_test.', '_spec.'];

function isPageFile(filePath: string): boolean {
    const name = path.basename(filePath).toLowerCase();
    const stem = path.parse(filePath).name.toLowerCase();

    if (SKIP_PATTERNS.some(skip => name.includes(skip))) return false;

    const parts = filePath.toLowerCase().split(path.sep);
    const pageDirs = ['pages', 'app', 'routes', 'views', 'screens'];
    if (pageDirs.some(d => parts.includes(d))) return true;

    const pageNames = ['page', 'index', 'home', 'about', 'contact', 'blog', 'post', 'article', 'product', 'landing', 'layout'];
    if (pageNames.some(p => stem.includes(p))) return true;

    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.html' || ext === '.htm') return true;

    return false;
}

export async function checkSeoPage(filePath: string): Promise<{ file: string, issues: string[] }> {
    const issues: string[] = [];
    try {
        const content = await fs.readFile(filePath, 'utf-8');

        const isLayout = content.includes('Head>') || content.toLowerCase().includes('<head');

        if (isLayout && !content.toLowerCase().includes('<title') && !content.includes('title=')) {
            issues.push("Missing <title> tag");
        }

        if (isLayout && !content.toLowerCase().includes('name="description"') && !content.toLowerCase().includes("name='description'")) {
            issues.push("Missing meta description");
        }

        if (isLayout && !content.includes('og:') && !content.toLowerCase().includes('property="og:')) {
            issues.push("Missing Open Graph tags");
        }

        const h1Matches = content.match(/<h1[^>]*>/gi) || [];
        if (h1Matches.length > 1) {
            issues.push(`Multiple H1 tags (${h1Matches.length})`);
        }

        const imgMatches = content.match(/<img[^>]+>/gi) || [];
        for (const img of imgMatches) {
            const imgLower = img.toLowerCase();
            if (!imgLower.includes('alt=')) {
                issues.push("Image missing alt attribute");
                break;
            }
            if (img.includes('alt=""') || img.includes("alt=''")) {
                issues.push("Image has empty alt attribute");
                break;
            }
        }

        return { file: path.basename(filePath), issues };
    } catch (e: any) {
        return { file: path.basename(filePath), issues: [`Error: ${e.message}`] };
    }
}

export async function runSeoChecker(projectPath: string = "."): Promise<{ passed: boolean, report: string }> {
    const pages: string[] = [];
    const root = path.resolve(projectPath);

    async function search(dir: string) {
        if (pages.length >= 50) return;
        try {
            const items = await fs.readdir(dir, { withFileTypes: true });
            for (const item of items) {
                if (SKIP_DIRS.includes(item.name)) continue;

                const fullPath = path.join(dir, item.name);
                if (item.isDirectory()) {
                    await search(fullPath);
                } else if (/\.(html|htm|jsx|tsx)$/i.test(item.name)) {
                    if (isPageFile(fullPath)) {
                        pages.push(fullPath);
                    }
                }
            }
        } catch { }
    }

    await search(root);

    let report = `============================================================\n`;
    report += `SEO CHECKER - Search Engine Optimization Audit\n`;
    report += `============================================================\n`;

    if (pages.length === 0) {
        report += `\n[!] No page files found.\n`;
        return { passed: true, report };
    }

    report += `Found ${pages.length} page files to analyze\n\n`;
    report += `============================================================\n`;
    report += `SEO ANALYSIS RESULTS\n`;
    report += `============================================================\n`;

    const allIssues: { file: string, issues: string[] }[] = [];
    for (const page of pages) {
        const result = await checkSeoPage(page);
        if (result.issues.length > 0) {
            allIssues.push(result);
        }
    }

    if (allIssues.length > 0) {
        const counts: Record<string, number> = {};
        allIssues.forEach(item => {
            item.issues.forEach(issue => counts[issue] = (counts[issue] || 0) + 1);
        });

        report += `\nIssue Summary:\n`;
        Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([issue, count]) => {
            report += `  [${count}] ${issue}\n`;
        });

        report += `\nAffected files (${allIssues.length}):\n`;
        for (const item of allIssues.slice(0, 5)) {
            report += `  - ${item.file}\n`;
        }
        if (allIssues.length > 5) report += `  ... and ${allIssues.length - 5} more\n`;
    } else {
        report += `\n[OK] No SEO issues found!\n`;
    }

    const totalIssues = allIssues.reduce((sum, item) => sum + item.issues.length, 0);
    return { passed: totalIssues === 0, report };
}
