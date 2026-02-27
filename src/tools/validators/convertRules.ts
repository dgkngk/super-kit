import * as fs from 'fs/promises';
import * as path from 'path';

const SECTIONS: Record<string, any> = {
    'async': {
        'number': 1,
        'title': 'Eliminating Waterfalls',
        'impact': 'CRITICAL',
        'description': 'Waterfalls are the #1 performance killer. Each sequential await adds full network latency. Eliminating them yields the largest gains.'
    },
    'bundle': {
        'number': 2,
        'title': 'Bundle Size Optimization',
        'impact': 'CRITICAL',
        'description': 'Reducing initial bundle size improves Time to Interactive and Largest Contentful Paint.'
    },
    'server': {
        'number': 3,
        'title': 'Server-Side Performance',
        'impact': 'HIGH',
        'description': 'Optimizing server-side rendering and data fetching eliminates server-side waterfalls and reduces response times.'
    },
    'client': {
        'number': 4,
        'title': 'Client-Side Data Fetching',
        'impact': 'MEDIUM-HIGH',
        'description': 'Automatic deduplication and efficient data fetching patterns reduce redundant network requests.'
    },
    'rerender': {
        'number': 5,
        'title': 'Re-render Optimization',
        'impact': 'MEDIUM',
        'description': 'Reducing unnecessary re-renders minimizes wasted computation and improves UI responsiveness.'
    },
    'rendering': {
        'number': 6,
        'title': 'Rendering Performance',
        'impact': 'MEDIUM',
        'description': 'Optimizing the rendering process reduces the work the browser needs to do.'
    },
    'js': {
        'number': 7,
        'title': 'JavaScript Performance',
        'impact': 'LOW-MEDIUM',
        'description': 'Micro-optimizations for hot paths can add up to meaningful improvements.'
    },
    'advanced': {
        'number': 8,
        'title': 'Advanced Patterns',
        'impact': 'VARIABLE',
        'description': 'Advanced patterns for specific cases that require careful implementation.'
    }
};

function parseFrontmatter(content: string): { frontmatter: Record<string, string>, body: string } {
    if (!content.startsWith('---')) return { frontmatter: {}, body: content };

    const parts = content.split('---');
    if (parts.length < 3) return { frontmatter: {}, body: content };

    const frontmatterStr = parts[1].trim();
    const body = parts.slice(2).join('---').trim();

    const frontmatter: Record<string, string> = {};
    for (const line of frontmatterStr.split('\n')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
            const key = line.substring(0, colonIdx).trim();
            const value = line.substring(colonIdx + 1).trim();
            frontmatter[key] = value;
        }
    }

    return { frontmatter, body };
}

async function parseRuleFile(filepath: string) {
    const content = await fs.readFile(filepath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(content);

    const filename = path.basename(filepath);
    const prefix = path.parse(filename).name.split('-')[0];

    return {
        filename,
        prefix,
        title: frontmatter['title'] || path.parse(filename).name,
        impact: frontmatter['impact'] || '',
        impactDescription: frontmatter['impactDescription'] || '',
        tags: frontmatter['tags'] || '',
        body,
        frontmatter
    };
}

async function groupRulesBySection(rulesDir: string): Promise<Record<string, any[]>> {
    const grouped: Record<string, any[]> = {};
    for (const key of Object.keys(SECTIONS)) grouped[key] = [];

    try {
        const files = await fs.readdir(rulesDir);
        for (const file of files) {
            if (file.startsWith('_') || !file.endsWith('.md')) continue;

            const rule = await parseRuleFile(path.join(rulesDir, file));
            if (grouped[rule.prefix]) {
                grouped[rule.prefix].push(rule);
            } else {
                console.warn(`[WARNING] Unknown prefix '${rule.prefix}' in file: ${file}`);
            }
        }
    } catch (e: any) {
        throw new Error(`Failed to read rules directory: ${e.message}`);
    }

    return grouped;
}

async function generateSectionFile(sectionPrefix: string, rules: any[], outputDir: string, getOutputOnly = false): Promise<string> {
    if (!rules || rules.length === 0) return "";

    const sectionMeta = SECTIONS[sectionPrefix];
    const sectionNum = sectionMeta.number;
    const sectionTitle = sectionMeta.title;

    rules.sort((a, b) => a.title.localeCompare(b.title));

    let content = `# ${sectionNum}. ${sectionTitle}\n\n> **Impact:** ${sectionMeta.impact}\n> **Focus:** ${sectionMeta.description}\n\n---\n\n## Overview\n\nThis section contains **${rules.length} rules** focused on ${sectionTitle.toLowerCase()}.\n\n`;

    for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const ruleId = `${sectionNum}.${i + 1}`;

        content += `---\n\n## Rule ${ruleId}: ${rule.title}\n\n`;
        if (rule.impact) content += `**Impact:** ${rule.impact}  \n`;
        if (rule.tags) content += `**Tags:** ${rule.tags}  \n`;
        content += `\n${rule.body}\n\n`;
    }

    if (getOutputOnly) return content;

    const outputFilename = `${sectionNum}-${sectionPrefix}-${sectionTitle.toLowerCase().replace(/\s+/g, '-')}.md`;
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(path.join(outputDir, outputFilename), content, 'utf-8');

    return `[OK] Generated: ${outputFilename} (${rules.length} rules)\n`;
}

export async function runConvertRules(projectPath: string = "."): Promise<{ passed: boolean, report: string }> {
    let report = `============================================================\n`;
    report += `CONVERSION SCRIPT: React Best Practices -> .agent Format\n`;
    report += `============================================================\n`;

    const baseDir = path.resolve(projectPath);
    // Mimic the python logic for paths if run from anywhere, or adapt to superkit structure
    const rulesDir = path.join(baseDir, "skills", "react-best-practices", "rules");
    const outputDir = path.join(baseDir, ".agent", "skills", "react-best-practices");

    report += `[*] Reading rules from: ${rulesDir}\n[*] Output to: ${outputDir}\n\n`;

    try {
        const stat = await fs.stat(rulesDir);
        if (!stat.isDirectory()) throw new Error("Not a directory");
    } catch {
        return { passed: false, report: report + `[ERROR] Rules directory not found: ${rulesDir}\n` };
    }

    try {
        const groupedRules = await groupRulesBySection(rulesDir);
        let totalRules = 0;
        for (const rules of Object.values(groupedRules)) totalRules += rules.length;

        report += `[*] Found ${totalRules} total rules\n\n[*] Generating section files...\n`;

        for (const prefix of Object.keys(SECTIONS)) {
            const out = await generateSectionFile(prefix, groupedRules[prefix], outputDir);
            if (out) report += out;
        }

        report += `\n[SUCCESS] Conversion complete!\n[*] Generated 8 section files from ${totalRules} rules\n`;
        return { passed: true, report };
    } catch (e: any) {
        return { passed: false, report: report + `[ERROR] ${e.message}\n` };
    }
}
