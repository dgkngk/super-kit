import * as fs from 'fs/promises';
import * as path from 'path';

const HARDCODED_PATTERNS: Record<string, string[]> = {
    'jsx': [
        // Text directly in JSX: <div>Hello World</div>
        '>\\s*[A-Z][a-zA-Z\\s]{3,30}\\s*</',
        // JSX attribute strings: title="Welcome"
        '(title|placeholder|label|alt|aria-label)="[A-Z][a-zA-Z\\s]{2,}"',
        // Button/heading text
        '<(button|h[1-6]|p|span|label)[^>]*>\\s*[A-Z][a-zA-Z\\s!?.,]{3,}\\s*</',
    ],
    'vue': [
        '>\\s*[A-Z][a-zA-Z\\s]{3,30}\\s*</',
        '(placeholder|label|title)="[A-Z][a-zA-Z\\s]{2,}"',
    ],
    'python': [
        '(print|raise\\s+\\w+)\\s*\\(\\s*["\'][A-Z][^"\']{5,}["\']',
        'flash\\s*\\(\\s*["\'][A-Z][^"\']{5,}["\']',
    ]
};

const I18N_PATTERNS = [
    't\\(["\']',
    'useTranslation',
    '\\$t\\(',
    '_\\(["\']',
    'gettext\\(',
    'useTranslations',
    'FormattedMessage',
    'i18n\\.'
];

export async function findLocaleFiles(projectPath: string): Promise<string[]> {
    let files: string[] = [];
    async function search(dir: string) {
        try {
            const items = await fs.readdir(dir, { withFileTypes: true });
            for (const item of items) {
                if (item.name === 'node_modules' || item.name === '.git') continue;

                const fullPath = path.join(dir, item.name);
                if (item.isDirectory()) await search(fullPath);
                else {
                    const lpath = fullPath.toLowerCase();
                    if ((lpath.includes('locales') || lpath.includes('translations') || lpath.includes('lang') ||
                        lpath.includes('i18n') || lpath.includes('messages')) && lpath.endsWith('.json')) {
                        files.push(fullPath);
                    } else if (lpath.endsWith('.po')) {
                        files.push(fullPath);
                    }
                }
            }
        } catch { }
    }
    await search(projectPath);
    return files;
}

function flattenKeys(d: any, prefix = ''): Set<string> {
    let keys = new Set<string>();
    for (const [k, v] of Object.entries(d)) {
        const newKey = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            for (const childKey of flattenKeys(v, newKey)) keys.add(childKey);
        } else {
            keys.add(newKey);
        }
    }
    return keys;
}

export async function checkLocaleCompleteness(localeFiles: string[]): Promise<{ passed: string[], issues: string[] }> {
    const passed: string[] = [];
    const issues: string[] = [];

    if (localeFiles.length === 0) return { passed, issues: ["[!] No locale files found"] };

    const locales: Record<string, Record<string, Set<string>>> = {};
    for (const file of localeFiles) {
        if (file.endsWith('.json')) {
            try {
                const lang = path.basename(path.dirname(file));
                const content = JSON.parse(await fs.readFile(file, 'utf-8'));
                if (!locales[lang]) locales[lang] = {};
                locales[lang][path.parse(file).name] = flattenKeys(content);
            } catch { }
        }
    }

    const allLangs = Object.keys(locales);
    if (allLangs.length < 2) {
        passed.push(`[OK] Found ${localeFiles.length} locale file(s)`);
        return { passed, issues };
    }

    passed.push(`[OK] Found ${allLangs.length} language(s): ${allLangs.join(', ')}`);
    const baseLang = allLangs[0];

    for (const [namespace, baseKeys] of Object.entries(locales[baseLang] || {})) {
        for (let i = 1; i < allLangs.length; i++) {
            const lang = allLangs[i];
            const otherKeys = (locales[lang] || {})[namespace] || new Set<string>();

            let missing = 0;
            for (const k of baseKeys) if (!otherKeys.has(k)) missing++;
            if (missing > 0) issues.push(`[X] ${lang}/${namespace}: Missing ${missing} keys`);

            let extra = 0;
            for (const k of otherKeys) if (!baseKeys.has(k)) extra++;
            if (extra > 0) issues.push(`[!] ${lang}/${namespace}: ${extra} extra keys`);
        }
    }

    if (issues.length === 0) passed.push("[OK] All locales have matching keys");
    return { passed, issues };
}

export async function checkHardcodedStrings(projectPath: string): Promise<{ passed: string[], issues: string[] }> {
    const passed: string[] = [];
    const issues: string[] = [];

    const exts: Record<string, string> = { '.tsx': 'jsx', '.jsx': 'jsx', '.ts': 'jsx', '.js': 'jsx', '.vue': 'vue', '.py': 'python' };
    let codeFiles: string[] = [];

    async function search(dir: string) {
        try {
            const items = await fs.readdir(dir, { withFileTypes: true });
            for (const item of items) {
                if (['node_modules', '.git', 'dist', 'build', '__pycache__', 'venv', 'test', 'spec'].includes(item.name)) continue;

                const fullPath = path.join(dir, item.name);
                if (item.isDirectory()) await search(fullPath);
                else if (exts[path.extname(item.name)]) codeFiles.push(fullPath);
            }
        } catch { }
    }
    await search(projectPath);

    if (codeFiles.length === 0) return { passed: ["[!] No code files found"], issues };

    let filesWithI18n = 0;
    let filesWithHardcoded = 0;
    const examples: string[] = [];

    for (const file of codeFiles.slice(0, 50)) {
        try {
            const content = await fs.readFile(file, 'utf-8');
            const type = exts[path.extname(file)] || 'jsx';

            const hasI18n = I18N_PATTERNS.some(p => new RegExp(p).test(content));
            if (hasI18n) filesWithI18n++;

            let hardcodedFound = false;
            for (const pattern of HARDCODED_PATTERNS[type] || []) {
                const match = content.match(new RegExp(pattern));
                if (match && !hasI18n) {
                    hardcodedFound = true;
                    if (examples.length < 5) examples.push(`${path.basename(file)}: ${match[0].substring(0, 40)}...`);
                }
            }
            if (hardcodedFound) filesWithHardcoded++;
        } catch { }
    }

    passed.push(`[OK] Analyzed ${codeFiles.length} code files`);
    if (filesWithI18n > 0) passed.push(`[OK] ${filesWithI18n} files use i18n`);

    if (filesWithHardcoded > 0) {
        issues.push(`[X] ${filesWithHardcoded} files may have hardcoded strings`);
        for (const ex of examples) issues.push(`   -> ${ex}`);
    } else {
        passed.push("[OK] No obvious hardcoded strings detected");
    }

    return { passed, issues };
}

export async function runI18nChecker(projectPath: string = "."): Promise<{ passed: boolean, report: string }> {
    const root = path.resolve(projectPath);
    let report = `============================================================\n`;
    report += `  i18n CHECKER - Internationalization Audit\n`;
    report += `============================================================\n\n`;

    const localeFiles = await findLocaleFiles(root);
    const localeRes = await checkLocaleCompleteness(localeFiles);
    const codeRes = await checkHardcodedStrings(root);

    report += `[LOCALE FILES]\n----------------------------------------\n`;
    for (const p of localeRes.passed) report += `  ${p}\n`;
    for (const i of localeRes.issues) report += `  ${i}\n`;

    report += `\n[CODE ANALYSIS]\n----------------------------------------\n`;
    for (const p of codeRes.passed) report += `  ${p}\n`;
    for (const i of codeRes.issues) report += `  ${i}\n`;

    const criticals = [...localeRes.issues, ...codeRes.issues].filter(i => i.startsWith("[X]")).length;

    report += `\n============================================================\n`;
    if (criticals === 0) report += `[OK] i18n CHECK: PASSED\n`;
    else report += `[X] i18n CHECK: ${criticals} issues found\n`;

    return { passed: criticals === 0, report };
}
