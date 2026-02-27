import * as fs from 'fs/promises';
import * as path from 'path';

const SKIP_DIRS = new Set([
    'node_modules', '.next', 'dist', 'build', '.git', '.github',
    '__pycache__', '.vscode', '.idea', 'coverage', 'test', 'tests',
    '__tests__', 'spec', 'docs', 'documentation'
]);

const SKIP_FILES = new Set([
    'jest.config', 'webpack.config', 'vite.config', 'tsconfig',
    'package.json', 'package-lock', 'yarn.lock', '.eslintrc',
    'tailwind.config', 'postcss.config', 'next.config'
]);

function isPageFile(filePath: string): boolean {
    const name = path.basename(filePath).toLowerCase();

    for (const skip of SKIP_FILES) {
        if (name.includes(skip)) return false;
    }

    if (name.endsWith('.test') || name.endsWith('.spec') || name.startsWith('test_') || name.startsWith('spec_')) {
        return false;
    }

    const pageIndicators = ['page', 'index', 'home', 'about', 'contact', 'blog', 'post', 'article', 'product', 'service', 'landing'];
    const parts = filePath.toLowerCase().split(path.sep);

    if (parts.includes('pages') || parts.includes('app') || parts.includes('routes')) return true;
    for (const ind of pageIndicators) {
        if (name.includes(ind)) return true;
    }

    if (name.endsWith('.html')) return true;

    return false;
}

export async function findWebPages(projectPath: string): Promise<string[]> {
    let files: string[] = [];

    async function search(dir: string) {
        try {
            const items = await fs.readdir(dir, { withFileTypes: true });
            for (const item of items) {
                if (SKIP_DIRS.has(item.name)) continue;

                const fullPath = path.join(dir, item.name);
                if (item.isDirectory()) await search(fullPath);
                else {
                    const ext = path.extname(item.name).toLowerCase();
                    if (['.html', '.htm', '.jsx', '.tsx'].includes(ext)) {
                        if (isPageFile(fullPath)) files.push(fullPath);
                    }
                }
            }
        } catch { }
    }

    await search(projectPath);
    return files.slice(0, 30);
}

export async function checkGeoPage(filePath: string) {
    const result = { file: path.basename(filePath), passed: [] as string[], issues: [] as string[], score: 0 };
    try {
        const content = await fs.readFile(filePath, 'utf-8');

        // JSON-LD
        if (content.includes('application/ld+json')) {
            result.passed.push("JSON-LD structured data found");
            if (content.includes('"@type"')) {
                if (content.includes('Article')) result.passed.push("Article schema present");
                if (content.includes('FAQPage')) result.passed.push("FAQ schema present");
                if (content.includes('Organization') || content.includes('Person')) result.passed.push("Entity schema present");
            }
        } else {
            result.issues.push("No JSON-LD structured data (AI engines prefer structured content)");
        }

        // Headings
        const h1Count = (content.match(/<h1[^>]*>/gi) || []).length;
        const h2Count = (content.match(/<h2[^>]*>/gi) || []).length;

        if (h1Count === 1) result.passed.push("Single H1 heading (clear topic)");
        else if (h1Count === 0) result.issues.push("No H1 heading - page topic unclear");
        else result.issues.push(`Multiple H1 headings (${h1Count}) - confusing for AI`);

        if (h2Count >= 2) result.passed.push(`${h2Count} H2 subheadings (good structure)`);
        else result.issues.push("Add more H2 subheadings for scannable content");

        // Author
        const lowerC = content.toLowerCase();
        if (['author', 'byline', 'written-by', 'contributor', 'rel="author"'].some(p => lowerC.includes(p))) {
            result.passed.push("Author attribution found");
        } else result.issues.push("No author info (AI prefers attributed content)");

        // Date
        if (/datePublished|dateModified|datetime=|pubdate|article:published/i.test(content)) {
            result.passed.push("Publication date found");
        } else result.issues.push("No publication date (freshness matters for AI)");

        // FAQ
        if (/<details|faq|frequently.?asked|"FAQPage"/i.test(content)) {
            result.passed.push("FAQ section detected (highly citable)");
        }

        const listCount = (content.match(/<(ul|ol)[^>]*>/gi) || []).length;
        if (listCount >= 2) result.passed.push(`${listCount} lists (structured content)`);

        const tableCount = (content.match(/<table[^>]*>/gi) || []).length;
        if (tableCount >= 1) result.passed.push(`${tableCount} table(s) (comparison data)`);

        // Entities
        if (/"@type"\s*:\s*"Organization"|"@type"\s*:\s*"LocalBusiness"|"@type"\s*:\s*"Brand"|itemtype.*schema\.org\/(Organization|Person|Brand)|rel="author"/i.test(content)) {
            result.passed.push("Entity/Brand recognition (E-E-A-T)");
        }

        // Stats
        let stats = 0;
        const statPatterns = [/\d+%/, /\$[\d,]+/, /study\s+(shows|found)/i, /according to/i, /data\s+(shows|reveals)/i, /\d+x\s+(faster|better|more)/i, /(million|billion|trillion)/i];
        for (const p of statPatterns) if (p.test(content)) stats++;
        if (stats >= 2) result.passed.push("Original statistics/data (citation magnet)");

        // Direct answers
        const ansPatterns = [/is defined as/i, /refers to/i, /means that/i, /the answer is/i, /in short,/i, /simply put,/i, /<dfn/i];
        if (ansPatterns.some(p => p.test(content))) result.passed.push("Direct answer patterns (LLM-friendly)");

    } catch (e: any) {
        result.issues.push(`Error: ${e.message}`);
    }

    const total = result.passed.length + result.issues.length;
    result.score = total > 0 ? (result.passed.length / total) * 100 : 0;
    return result;
}

export async function runGeoChecker(projectPath: string = "."): Promise<{ passed: boolean, report: string }> {
    const root = path.resolve(projectPath);
    let report = `============================================================\n`;
    report += `  GEO CHECKER - AI Citation Readiness Audit\n`;
    report += `============================================================\n`;

    const pages = await findWebPages(root);
    if (pages.length === 0) {
        return { passed: true, report: report + "\n[!] No public web pages found.\n" };
    }

    report += `Found ${pages.length} public pages to analyze\n\n`;

    const results = [];
    for (const page of pages) {
        results.push(await checkGeoPage(page));
    }

    let sumScore = 0;
    for (const r of results) {
        const score = Math.round(r.score);
        sumScore += score;
        const status = score >= 60 ? "[OK]" : "[!]";
        report += `${status} ${r.file}: ${score}%\n`;
        if (r.issues.length > 0 && score < 60) {
            for (const issue of r.issues.slice(0, 2)) report += `    - ${issue}\n`;
        }
    }

    const avgScore = Math.round(results.length > 0 ? sumScore / results.length : 0);
    report += `\n============================================================\n`;
    report += `AVERAGE GEO SCORE: ${avgScore}%\n`;
    report += `============================================================\n`;

    if (avgScore >= 80) report += "[OK] Excellent - Content well-optimized for AI citations\n";
    else if (avgScore >= 60) report += "[OK] Good - Some improvements recommended\n";
    else if (avgScore >= 40) report += "[!] Needs work - Add structured elements\n";
    else report += "[X] Poor - Content needs GEO optimization\n";

    return { passed: avgScore >= 60, report };
}
