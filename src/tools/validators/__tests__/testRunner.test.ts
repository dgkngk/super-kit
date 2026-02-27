import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runTestRunner, detectTestFramework } from '../testRunner.js';
import * as fs from 'fs/promises';
import * as child_process from 'child_process';

vi.mock('fs/promises');
vi.mock('child_process', () => ({
    exec: vi.fn((cmd, options, callback) => {
        callback(null, { stdout: '1 passed', stderr: '' });
    })
}));

describe('testRunner', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should detect node test frameworks via package.json', async () => {
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
            scripts: { test: "something" },
            devDependencies: { vitest: "^1.0.0" }
        }));
        vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT')); // no python

        const info = await detectTestFramework('.');
        expect(info.type).toBe('node');
        expect(info.framework).toBe('vitest');
        expect(info.cmd).toEqual(['npm', 'test']);
        expect(info.coverageCmd).toEqual(['npx', 'vitest', 'run', '--coverage']);
    });

    it('should detect python tests via pyproject.toml', async () => {
        vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT')); // no package.json
        vi.mocked(fs.stat).mockResolvedValue({} as any);

        const info = await detectTestFramework('.');
        expect(info.type).toBe('python');
        expect(info.framework).toBe('pytest');
        expect(info.cmd).toEqual(['python', '-m', 'pytest', '-v']);
    });

    it('should run tests and report success', async () => {
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
            scripts: { test: "jest" }
        }));

        // Mock child_process.exec to simulate passing tests
        vi.mocked(child_process.exec).mockImplementation((...args: any[]) => {
            const cb = args[args.length - 1];
            cb(null, { stdout: 'Tests: 1 passed, 1 total', stderr: '' });
            return {} as any;
        });

        const res = await runTestRunner('.');
        expect(res.passed).toBe(true);
        expect(res.report).toContain('Tests: 1 total, 1 passed, 0 failed');
    });
});
