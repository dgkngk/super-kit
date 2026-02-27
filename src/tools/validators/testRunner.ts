import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function detectTestFramework(projectPath: string) {
    const result = {
        type: 'unknown',
        framework: null as string | null,
        cmd: null as string[] | null,
        coverageCmd: null as string[] | null
    };

    try {
        const pkgPath = path.join(projectPath, 'package.json');
        const pkgData = await fs.readFile(pkgPath, 'utf-8');
        const pkg = JSON.parse(pkgData);

        result.type = 'node';
        const scripts = pkg.scripts || {};
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

        if (scripts.test) {
            result.framework = 'npm test';
            result.cmd = ['npm', 'test'];

            if (deps.vitest) {
                result.framework = 'vitest';
                result.coverageCmd = ['npx', 'vitest', 'run', '--coverage'];
            } else if (deps.jest) {
                result.framework = 'jest';
                result.coverageCmd = ['npx', 'jest', '--coverage'];
            }
        } else if (deps.vitest) {
            result.framework = 'vitest';
            result.cmd = ['npx', 'vitest', 'run'];
            result.coverageCmd = ['npx', 'vitest', 'run', '--coverage'];
        } else if (deps.jest) {
            result.framework = 'jest';
            result.cmd = ['npx', 'jest'];
            result.coverageCmd = ['npx', 'jest', '--coverage'];
        }
    } catch { }

    // Check python
    try {
        const pyproject = await fs.stat(path.join(projectPath, 'pyproject.toml')).catch(() => null);
        const reqs = await fs.stat(path.join(projectPath, 'requirements.txt')).catch(() => null);

        if (pyproject || reqs) {
            result.type = 'python';
            result.framework = 'pytest';
            result.cmd = ['python', '-m', 'pytest', '-v'];
            result.coverageCmd = ['python', '-m', 'pytest', '--cov', '--cov-report=term-missing'];
        }
    } catch { }

    return result;
}

export async function runTestRunner(projectPath: string = ".", withCoverage: boolean = false): Promise<{ passed: boolean, report: string }> {
    const root = path.resolve(projectPath);
    let report = `============================================================\n`;
    report += `[TEST RUNNER] Unified Test Execution\n`;
    report += `============================================================\n`;

    const info = await detectTestFramework(root);
    report += `Type: ${info.type}\nFramework: ${info.framework}\n------------------------------------------------------------\n`;

    if (!info.cmd) {
        report += `No test framework found for this project.\n`;
        return { passed: true, report };
    }

    const cmdArr = (withCoverage && info.coverageCmd) ? info.coverageCmd : info.cmd;
    const cmdStr = cmdArr.join(' ');
    report += `Running: ${cmdStr}\n------------------------------------------------------------\n`;

    let passed = false;
    let testsRun = 0, testsPassed = 0, testsFailed = 0;
    let output = '';

    try {
        // Child process maxbuffer 5MB since test output can be huge
        const result = await execAsync(cmdStr, { cwd: root, maxBuffer: 5 * 1024 * 1024 });
        passed = true;
        output = result.stdout;
    } catch (e: any) {
        passed = false;
        output = e.stdout || e.stderr || e.message;
    }

    // Parse stats
    const passedMatch = output.match(/(\d+)\s+passed/i);
    if (passedMatch) testsPassed = parseInt(passedMatch[1]);

    const failedMatch = output.match(/(\d+)\s+failed/i);
    if (failedMatch) testsFailed = parseInt(failedMatch[1]);

    testsRun = testsPassed + testsFailed;

    const lines = output.split('\n');
    for (const line of lines.slice(0, 30)) {
        report += `${line}\n`;
    }
    if (lines.length > 30) {
        report += `... (${lines.length - 30} more lines)\n`;
    }

    report += `\n============================================================\nSUMMARY\n============================================================\n`;
    if (passed) {
        report += `[PASS] All tests passed\n`;
    } else {
        report += `[FAIL] Some tests failed\n`;
    }

    if (testsRun > 0) {
        report += `Tests: ${testsRun} total, ${testsPassed} passed, ${testsFailed} failed\n`;
    }

    return { passed, report };
}
