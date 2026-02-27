import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectProjectType, runLinter, runLintRunner } from '../lintRunner.js';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as cp from 'child_process';
import path from 'path';

// Mock fs and child_process modules
vi.mock('fs/promises');
vi.mock('fs', () => ({ existsSync: vi.fn() }));
vi.mock('child_process');

describe('lintRunner', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('detectProjectType', () => {
        it('should detect a node project with lint script', async () => {
            (existsSync as any).mockImplementation((p: string) => p.endsWith('package.json'));
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
                scripts: { lint: 'eslint .' }
            }));

            const info = await detectProjectType('/mock/path');

            expect(info.type).toBe('node');
            expect(info.linters).toEqual([{ name: 'npm lint', cmd: ['npm', 'run', 'lint'] }]);
        });

        it('should detect a python project with ruff', async () => {
            (existsSync as any).mockImplementation((p: string) =>
                p.endsWith('pyproject.toml') || p.endsWith('mypy.ini')
            );

            const info = await detectProjectType('/mock/python');

            expect(info.type).toBe('python');
            expect(info.linters).toContainEqual({ name: 'ruff', cmd: ['ruff', 'check', '.'] });
            expect(info.linters).toContainEqual({ name: 'mypy', cmd: ['mypy', '.'] });
        });
    });

    describe('runLinter', () => {
        it('should return passed on success code', async () => {
            // Mock spawn
            const mockChild = {
                stdout: { on: vi.fn((event, cb) => cb('success out')) },
                stderr: { on: vi.fn() },
                on: vi.fn((event, cb) => {
                    if (event === 'close') cb(0);
                }),
                kill: vi.fn()
            };
            vi.mocked(cp.spawn).mockReturnValue(mockChild as any);

            const result = await runLinter({ name: 'test', cmd: ['npm', 'test'] }, '/mock');
            expect(result.passed).toBe(true);
            expect(result.output).toContain('success out');
        });

        it('should return failed on error code', async () => {
            const mockChild = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn((event, cb) => cb('error out')) },
                on: vi.fn((event, cb) => {
                    if (event === 'close') cb(1);
                }),
                kill: vi.fn()
            };
            vi.mocked(cp.spawn).mockReturnValue(mockChild as any);

            const result = await runLinter({ name: 'failtest', cmd: ['npm', 'fail'] }, '/mock');
            expect(result.passed).toBe(false);
            expect(result.error).toContain('error out');
        });
    });
});
