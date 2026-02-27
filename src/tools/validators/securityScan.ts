import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { existsSync } from 'fs';

// Patterns to mimic security_scan.py
const SECRET_PATTERNS = [
    { regex: /api[_-]?key\s*[=:]\s*["'][^"']{10,}["']/i, type: "API Key", severity: "high" },
    { regex: /token\s*[=:]\s*["'][^"']{10,}["']/i, type: "Token", severity: "high" },
    { regex: /bearer\s+[a-zA-Z0-9\-_.]+/i, type: "Bearer Token", severity: "critical" },
    { regex: /AKIA[0-9A-Z]{16}/, type: "AWS Access Key", severity: "critical" },
    { regex: /password\s*[=:]\s*["'][^"']{4,}["']/i, type: "Password", severity: "high" },
    { regex: /(mongodb|postgres|mysql|redis):\/\/[^\s"']+/, type: "Database Connection", severity: "critical" },
    { regex: /-----BEGIN\s+(RSA|PRIVATE|EC)\s+KEY-----/, type: "Private Key", severity: "critical" },
];

const DANGEROUS_PATTERNS = [
    { regex: /eval\s*\(/i, name: "eval() usage", severity: "critical", category: "Code Injection risk" },
    { regex: /child_process\.exec\s*\(/i, name: "child_process.exec", severity: "high", category: "Command Injection risk" },
    { regex: /\.innerHTML\s*=/i, name: "innerHTML assignment", severity: "medium", category: "XSS risk" },
    { regex: /dangerouslySetInnerHTML/i, name: "dangerouslySetInnerHTML", severity: "high", category: "XSS risk" },
    { regex: /verify\s*=\s*False/i, name: "SSL Verify Disabled", severity: "high", category: "MITM risk" },
    { regex: /disable[_-]?ssl/i, name: "SSL Disabled", severity: "high", category: "MITM risk" }
];

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '__pycache__', '.venv', 'venv', '.next']);
const CODE_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.java', '.rb', '.php']);
const CONFIG_EXTENSIONS = new Set(['.json', '.yaml', '.yml', '.toml', '.env', '.env.local', '.env.development']);

async function getFilesByExtensions(dir: string, extensions: Set<string>): Promise<string[]> {
    let files: string[] = [];
    try {
        const items = await fs.readdir(dir, { withFileTypes: true });
        for (const item of items) {
            if (SKIP_DIRS.has(item.name)) continue;

            const fullPath = path.join(dir, item.name);
            if (item.isDirectory()) {
                files = files.concat(await getFilesByExtensions(fullPath, extensions));
            } else if (extensions.has(path.extname(item.name).toLowerCase())) {
                files.push(fullPath);
            }
        }
    } catch { } // Ignore read errors
    return files;
}

export async function scanDependencies(projectPath: string): Promise<any> {
    const results = { tool: "dependency_scanner", findings: [] as any[], status: "[OK] Secure" };

    const lockFiles: Record<string, string[]> = {
        "npm": ["package-lock.json", "npm-shrinkwrap.json"],
        "yarn": ["yarn.lock"],
        "pnpm": ["pnpm-lock.yaml"],
        "pip": ["requirements.txt", "Pipfile.lock", "poetry.lock"],
    };

    for (const [manager, files] of Object.entries(lockFiles)) {
        const pkgFile = manager === 'pip' ? 'requirements.txt' : 'package.json';
        if (existsSync(path.join(projectPath, pkgFile))) {
            const hasLock = files.some(f => existsSync(path.join(projectPath, f)));
            if (!hasLock) {
                results.findings.push({
                    type: "Missing Lock File",
                    severity: "high",
                    message: `${manager}: No lock file found. Supply chain integrity at risk.`
                });
            }
        }
    }

    if (existsSync(path.join(projectPath, "package.json"))) {
        await new Promise<void>((resolve) => {
            const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
            const child = spawn(cmd, ['audit', '--json'], { cwd: projectPath });
            let out = '';

            child.stdout.on('data', d => out += d.toString());
            child.on('close', () => {
                try {
                    const auditData = JSON.parse(out);
                    const vulns = auditData.vulnerabilities || {};
                    let crit = 0, high = 0;

                    for (const v of Object.values(vulns) as any[]) {
                        const sev = v.severity || 'low';
                        if (sev === 'critical') crit++;
                        if (sev === 'high') high++;
                    }

                    if (crit > 0) {
                        results.status = "[!!] Critical vulnerabilities";
                        results.findings.push({ type: "npm audit", severity: "critical", message: `${crit} critical vulnerabilities` });
                    } else if (high > 0) {
                        results.status = "[!] High vulnerabilities";
                        results.findings.push({ type: "npm audit", severity: "high", message: `${high} high vulnerabilities` });
                    }
                } catch { }
                resolve();
            });
            child.on('error', () => resolve());
        });
    }

    if (results.findings.length === 0) results.status = "[OK] Supply chain checks passed";
    return results;
}

export async function scanSecrets(projectPath: string): Promise<any> {
    const results = {
        tool: "secret_scanner",
        findings: [] as any[],
        status: "[OK] No secrets detected",
        scanned_files: 0,
        by_severity: { critical: 0, high: 0, medium: 0 }
    };

    // Merge Sets for secret scanning
    const exts = new Set([...CODE_EXTENSIONS, ...CONFIG_EXTENSIONS]);
    const files = await getFilesByExtensions(projectPath, exts);
    results.scanned_files = files.length;

    for (const file of files) {
        try {
            const content = await fs.readFile(file, 'utf-8');
            for (const pattern of SECRET_PATTERNS) {
                const matches = content.match(new RegExp(pattern.regex, 'g'));
                if (matches) {
                    results.findings.push({
                        file: path.relative(projectPath, file),
                        type: pattern.type,
                        severity: pattern.severity,
                        count: matches.length
                    });
                    (results.by_severity as any)[pattern.severity] += matches.length;
                }
            }
        } catch { }
    }

    if (results.by_severity.critical > 0) results.status = "[!!] CRITICAL: Secrets exposed!";
    else if (results.by_severity.high > 0) results.status = "[!] HIGH: Secrets found";
    else if (results.by_severity.high > 0 || results.by_severity.medium > 0) results.status = "[?] Potential secrets detected";

    results.findings = results.findings.slice(0, 15);
    return results;
}

export async function scanCodePatterns(projectPath: string): Promise<any> {
    const results = {
        tool: "pattern_scanner",
        findings: [] as any[],
        status: "[OK] No dangerous patterns",
        scanned_files: 0,
        by_category: {} as any
    };

    const files = await getFilesByExtensions(projectPath, CODE_EXTENSIONS);
    results.scanned_files = files.length;

    for (const file of files) {
        try {
            const content = await fs.readFile(file, 'utf-8');
            const lines = content.split('\n');

            lines.forEach((line, index) => {
                for (const pattern of DANGEROUS_PATTERNS) {
                    if (pattern.regex.test(line)) {
                        results.findings.push({
                            file: path.relative(projectPath, file),
                            line: index + 1,
                            pattern: pattern.name,
                            severity: pattern.severity,
                            category: pattern.category,
                            snippet: line.trim().substring(0, 80)
                        });
                        results.by_category[pattern.category] = (results.by_category[pattern.category] || 0) + 1;
                    }
                }
            });
        } catch { }
    }

    const critCount = results.findings.filter(f => f.severity === 'critical').length;
    const highCount = results.findings.filter(f => f.severity === 'high').length;

    if (critCount > 0) results.status = `[!!] CRITICAL: ${critCount} dangerous patterns`;
    else if (highCount > 0) results.status = `[!] HIGH: ${highCount} risky patterns`;
    else if (results.findings.length > 0) results.status = "[?] Some patterns need review";

    results.findings = results.findings.slice(0, 20);
    return results;
}

export async function runSecurityScan(projectPath: string = ".", scanType: "all" | "deps" | "secrets" | "patterns" = "all"): Promise<any> {
    const report = {
        project: path.resolve(projectPath),
        timestamp: new Date().toISOString(),
        scan_type: scanType,
        scans: {} as any,
        summary: { total_findings: 0, critical: 0, high: 0, overall_status: "[OK] SECURE" }
    };

    if (scanType === "all" || scanType === "deps") report.scans.dependencies = await scanDependencies(projectPath);
    if (scanType === "all" || scanType === "secrets") report.scans.secrets = await scanSecrets(projectPath);
    if (scanType === "all" || scanType === "patterns") report.scans.code_patterns = await scanCodePatterns(projectPath);

    for (const scan of Object.values(report.scans) as any[]) {
        report.summary.total_findings += scan.findings.length;
        for (const finding of scan.findings) {
            if (finding.severity === 'critical') report.summary.critical++;
            if (finding.severity === 'high') report.summary.high++;
        }
    }

    if (report.summary.critical > 0) report.summary.overall_status = "[!!] CRITICAL ISSUES FOUND";
    else if (report.summary.high > 0) report.summary.overall_status = "[!] HIGH RISK ISSUES";
    else if (report.summary.total_findings > 0) report.summary.overall_status = "[?] REVIEW RECOMMENDED";

    return report;
}
