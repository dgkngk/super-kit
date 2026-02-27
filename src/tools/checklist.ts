import * as path from 'path';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import * as fs from 'fs/promises';

import { runSecurityScan } from './validators/securityScan.js';
import { runLintRunner } from './validators/lintRunner.js';
import { runTypeCoverage } from './validators/typeCoverage.js';
import { runTestRunner } from './validators/testRunner.js';
import { runSchemaValidator } from './validators/schemaValidator.js';
import { runApiValidator } from './validators/apiValidator.js';
import { runUxAudit } from './validators/uxAudit.js';
import { runAccessibilityChecker } from './validators/accessibilityChecker.js';
import { runGeoChecker } from './validators/geoChecker.js';
import { runI18nChecker } from './validators/i18nChecker.js';
import { runMobileAudit } from './validators/mobileAudit.js';
import { runReactPerformanceChecker } from './validators/reactPerformanceChecker.js';
import { runSeoChecker } from './validators/seoChecker.js';
import { runLighthouseAudit } from './validators/lighthouseAudit.js';
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

async function runCommand(name: string, command: string, args: string[], projectPath: string): Promise<{ passed: boolean, report: string }> {
    return new Promise((resolve) => {
        const child = spawn(command, args, { cwd: projectPath, shell: true });
        let out = '';
        let err = '';

        child.stdout.on('data', data => out += data.toString());
        child.stderr.on('data', data => err += data.toString());

        child.on('close', code => {
            const passed = code === 0;
            const report = passed ? `✅ ${name}: PASSED\n${out}` : `❌ ${name}: FAILED\n${err || out}`;
            resolve({ passed, report });
        });

        setTimeout(() => {
            child.kill();
            resolve({ passed: false, report: `❌ ${name}: TIMED OUT\n${out}\n${err}` });
        }, 5 * 60 * 1000);
    });
}

export async function runChecklist(projectPath: string, url?: string, skipPerformance = false): Promise<string> {
    const root = path.resolve(projectPath);
    let masterOutput = `🚀 SUPER KIT - MASTER CHECKLIST\nProject: ${root}\nURL: ${url || 'None'}\n\n📋 CORE CHECKS\n`;

    let passedCount = 0; let failedCount = 0; let skippedCount = 0;
    let hasCriticalFailure = false;

    type CheckResult = { passed: boolean, report: string, skipped?: boolean };

    const runAndFormat = async (name: string, required: boolean, fn: () => Promise<CheckResult>) => {
        if (hasCriticalFailure) return;
        try {
            const result = await fn();
            if (result.skipped) {
                skippedCount++;
                masterOutput += `\n--- [${name}] ---\n⏭️  Skipped: ${result.report}\n`;
                return;
            }

            masterOutput += `\n--- [${name}] ---\n${result.report}\n`;
            if (result.passed) {
                passedCount++;
            } else {
                failedCount++;
                if (required) {
                    hasCriticalFailure = true;
                    masterOutput += `CRITICAL: ${name} failed. Stopping checklist.\n`;
                }
            }
        } catch (e: any) {
            masterOutput += `\n--- [${name}] ---\n❌ Error executing check: ${e.message}\n`;
            failedCount++;
            if (required) hasCriticalFailure = true;
        }
    };

    // Replace CLI calls using exact TS equivalents
    await runAndFormat("Security Scan", false, () => runSecurityScan(root));
    await runAndFormat("Lint Check", true, () => runLintRunner(root));
    await runAndFormat("Type Coverage", false, () => runTypeCoverage(root));
    await runAndFormat("Test Runner", false, () => runTestRunner(root, false));
    await runAndFormat("Schema Validator", false, () => runSchemaValidator(root));
    await runAndFormat("API Validator", false, () => runApiValidator(root));
    await runAndFormat("UX Audit", false, () => runUxAudit(root));
    await runAndFormat("Accessibility Checker", false, () => runAccessibilityChecker(root));
    await runAndFormat("GEO Checker", false, () => runGeoChecker(root));
    await runAndFormat("i18n Checker", false, () => runI18nChecker(root));
    await runAndFormat("Mobile Audit", false, () => runMobileAudit(root));
    await runAndFormat("React Performance", false, () => runReactPerformanceChecker(root));
    await runAndFormat("SEO Checker", false, () => runSeoChecker(root));

    // Build check (still executes package.json script)
    await runAndFormat("Build Validation", false, async () => {
        if (await hasScript(root, 'build')) return runCommand("Build Validation", 'npm', ['run', 'build'], root);
        return { passed: true, skipped: true, report: `Script 'build' not found in package.json` };
    });

    if (url && !skipPerformance && !hasCriticalFailure) {
        masterOutput += `\n⚡ PERFORMANCE & E2E CHECKS\n`;
        await runAndFormat("Lighthouse / Performance", true, () => runLighthouseAudit(url));
        await runAndFormat("E2E Tests", false, () => runPlaywrightTest(url).then(res => ({
            passed: res.status === 'success',
            report: JSON.stringify(res, null, 2)
        })));
    } else if (!url && !hasCriticalFailure) {
        masterOutput += `\n⏭️ Skipping Performance & E2E checks (No URL provided)\n`;
    }

    masterOutput += `\n📊 SUMMARY\nPassed: ${passedCount}\nFailed: ${failedCount}\nSkipped: ${skippedCount}\n\n`;
    masterOutput += failedCount > 0 ? `❌ Checks FAILED - Attention required.` : `✅ All checks PASSED!`;

    return masterOutput;
}
