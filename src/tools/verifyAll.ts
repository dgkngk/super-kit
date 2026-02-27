import * as path from 'path';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import * as fs from 'fs/promises';

import { runSecurityScan } from './validators/securityScan.js';
import { runLintRunner } from './validators/lintRunner.js';
import { runTypeCoverage } from './validators/typeCoverage.js';
import { runTestRunner } from './validators/testRunner.js';
import { runPlaywrightTest } from './validators/playwrightRunner.js';

async function hasScript(rootPath: string, scriptName: string): Promise<boolean> {
    const pkgPath = path.join(rootPath, 'package.json');
    if (!existsSync(pkgPath)) return false;
    try {
        const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
        return !!(pkg.scripts && pkg.scripts[scriptName]);
    } catch {
        return false;
    }
}

async function runCommand(name: string, command: string, args: string[], projectPath: string): Promise<{ passed: boolean, report: string, duration: number }> {
    const start = Date.now();
    return new Promise((resolve) => {
        const child = spawn(command, args, { cwd: projectPath, shell: true });
        let out = '';
        child.stdout.on('data', data => out += data.toString());
        child.stderr.on('data', data => out += data.toString());

        child.on('close', code => {
            const passed = code === 0;
            const duration = (Date.now() - start) / 1000;
            const report = passed ? `✅ ${name} (${duration}s): PASSED\n${out}` : `❌ ${name} (${duration}s): FAILED\n${out}`;
            resolve({ passed, report, duration });
        });

        setTimeout(() => {
            child.kill();
            resolve({ passed: false, report: `❌ ${name}: TIMED OUT`, duration: (Date.now() - start) / 1000 });
        }, 10 * 60 * 1000);
    });
}

export async function runVerifyAll(projectPath: string, url: string, skipE2E = false, stopOnFail = false): Promise<string> {
    const root = path.resolve(projectPath);
    let report = `🚀 FULL VERIFICATION SUITE\nProject: ${root}\nURL: ${url}\n\n`;

    let passedCount = 0; let failedCount = 0; let skippedCount = 0;

    type CheckResult = { passed: boolean, report: string, skipped?: boolean, duration?: number };

    type CheckConfig = {
        name: string;
        required: boolean;
        fn: () => Promise<CheckResult>;
    };

    const VERIFICATION_SUITE: { category: string, requiresUrl?: boolean, checks: CheckConfig[] }[] = [
        {
            category: "Security",
            checks: [
                {
                    name: "Security Scan", required: true, fn: async () => {
                        const start = Date.now();
                        const res = await runSecurityScan(root);
                        return { passed: res.passed, report: res.report, duration: (Date.now() - start) / 1000 };
                    }
                }
            ]
        },
        {
            category: "Code Quality",
            checks: [
                {
                    name: "Lint Check", required: true, fn: async () => {
                        const start = Date.now();
                        const res = await runLintRunner(root);
                        return { passed: res.passed, report: res.report, duration: (Date.now() - start) / 1000 };
                    }
                },
                {
                    name: "Type Coverage", required: false, fn: async () => {
                        const start = Date.now();
                        const res = await runTypeCoverage(root);
                        return { passed: res.passed, report: res.report, duration: (Date.now() - start) / 1000 };
                    }
                }
            ]
        },
        {
            category: "Testing",
            checks: [
                {
                    name: "Test Suite", required: false, fn: async () => {
                        const start = Date.now();
                        const res = await runTestRunner(root, false);
                        return { passed: res.passed, report: res.report, duration: (Date.now() - start) / 1000 };
                    }
                }
            ]
        },
        {
            category: "Build",
            checks: [
                {
                    name: "Build App", required: false, fn: async () => {
                        if (await hasScript(root, 'build')) return runCommand("Build App", 'npm', ['run', 'build'], root);
                        return { passed: true, skipped: true, report: `Script 'build' not found in package.json` };
                    }
                }
            ]
        },
        {
            category: "E2E Testing",
            requiresUrl: true,
            checks: [
                {
                    name: "Playwright E2E", required: false, fn: async () => {
                        const start = Date.now();
                        const res = await runPlaywrightTest(url);
                        return {
                            passed: res.status === 'success',
                            report: JSON.stringify(res, null, 2),
                            duration: (Date.now() - start) / 1000
                        };
                    }
                }
            ]
        }
    ];

    for (const suite of VERIFICATION_SUITE) {
        if (suite.requiresUrl && !url) continue;
        if (skipE2E && suite.category === "E2E Testing") continue;

        report += `📋 ${suite.category.toUpperCase()}\n`;

        for (const check of suite.checks) {
            try {
                const result = await check.fn();
                if (result.skipped) {
                    skippedCount++;
                    report += `⏭️  ${check.name}: Skipped - ${result.report}\n`;
                    continue;
                }

                report += `[${result.duration?.toFixed(2)}s] ${check.name}:\n${result.report}\n`;
                if (result.passed) {
                    passedCount++;
                } else {
                    failedCount++;
                    if (stopOnFail && check.required) {
                        report += `CRITICAL FAILURE on ${check.name}\n`;
                        return report + `\nTotal Passed: ${passedCount} | Failed: ${failedCount} | Skipped: ${skippedCount}\n\nFAILED❗`;
                    }
                }
            } catch (e: any) {
                failedCount++;
                report += `❌ Error executing check ${check.name}: ${e.message}\n`;
                if (stopOnFail && check.required) {
                    return report + `\nTotal Passed: ${passedCount} | Failed: ${failedCount} | Skipped: ${skippedCount}\n\nFAILED❗`;
                }
            }
        }
    }

    report += `\n📊 FINAL REPORT\nPassed: ${passedCount}\nFailed: ${failedCount}\nSkipped: ${skippedCount}\n\n`;
    report += failedCount > 0 ? `❌ VERIFICATION FAILED!` : `✅ ALL CHECKS PASSED - Ready for deployment! ✨`;

    return report;
}
