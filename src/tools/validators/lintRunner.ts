import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

interface Linter {
    name: string;
    cmd: string[];
}

interface ProjectInfo {
    type: 'node' | 'python' | 'unknown';
    linters: Linter[];
}

export async function detectProjectType(projectPath: string): Promise<ProjectInfo> {
    const result: ProjectInfo = { type: 'unknown', linters: [] };

    const root = path.resolve(projectPath);
    const pkgPath = path.join(root, 'package.json');
    if (existsSync(pkgPath)) {
        result.type = 'node';
        try {
            const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
            const scripts = pkg.scripts || {};
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };

            if (scripts['lint']) {
                result.linters.push({ name: 'npm lint', cmd: ['npm', 'run', 'lint'] });
            } else if (deps['eslint']) {
                result.linters.push({ name: 'eslint', cmd: ['npx', 'eslint', '.'] });
            }

            if (deps['typescript'] || existsSync(path.join(root, 'tsconfig.json'))) {
                result.linters.push({ name: 'tsc', cmd: ['npx', 'tsc', '--noEmit'] });
            }
        } catch { }
    }

    if (existsSync(path.join(root, 'pyproject.toml')) || existsSync(path.join(root, 'requirements.txt'))) {
        result.type = 'python';
        result.linters.push({ name: 'ruff', cmd: ['ruff', 'check', '.'] });

        if (existsSync(path.join(root, 'mypy.ini')) || existsSync(path.join(root, 'pyproject.toml'))) {
            result.linters.push({ name: 'mypy', cmd: ['mypy', '.'] });
        }
    }

    return result;
}

export async function runLinter(linter: Linter, cwd: string): Promise<{ name: string, passed: boolean, output: string, error: string }> {
    return new Promise((resolve) => {
        let cmd = linter.cmd[0];
        const args = linter.cmd.slice(1);

        // Handle npx/npm on windows
        if (process.platform === 'win32' && (cmd === 'npm' || cmd === 'npx')) {
            cmd += '.cmd';
        }

        const child = spawn(cmd, args, { cwd, shell: true });

        let out = '';
        let err = '';

        child.stdout.on('data', d => out += d.toString());
        child.stderr.on('data', d => err += d.toString());

        child.on('close', code => {
            resolve({
                name: linter.name,
                passed: code === 0,
                output: out.substring(0, 2000),
                error: err.substring(0, 500)
            });
        });

        child.on('error', e => {
            resolve({
                name: linter.name,
                passed: false,
                output: '',
                error: e.message
            });
        });

        setTimeout(() => {
            child.kill();
            resolve({
                name: linter.name,
                passed: false,
                output: '',
                error: 'Timeout after 120s'
            });
        }, 120000);
    });
}

export async function runLintRunner(projectPath: string = "."): Promise<{ passed: boolean, report: string }> {
    const root = path.resolve(projectPath);
    let report = `============================================================\n`;
    report += `[LINT RUNNER] Unified Linting\n`;
    report += `============================================================\n`;
    report += `Project: ${root}\n`;

    const info = await detectProjectType(root);
    report += `Type: ${info.type}\n`;
    report += `Linters: ${info.linters.length}\n------------------------------------------------------------\n`;

    if (info.linters.length === 0) {
        report += "No linters found for this project type.\n";
        return { passed: true, report };
    }

    let allPassed = true;
    for (const linter of info.linters) {
        report += `\nRunning: ${linter.name}...\n`;
        const result = await runLinter(linter, root);

        if (result.passed) {
            report += `  [PASS] ${linter.name}\n`;
        } else {
            report += `  [FAIL] ${linter.name}\n`;
            if (result.error) report += `  Error: ${result.error.substring(0, 200)}\n`;
            allPassed = false;
        }
    }

    report += `\n============================================================\nSUMMARY\n============================================================\n`;
    report += allPassed ? "[OK] LINT CHECKS PASSED\n" : "[X] LINT CHECKS FAILED\n";

    return { passed: allPassed, report };
}
