import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logSkill, logWorkflow, rotateLogs } from '../loggerTools.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Logger Tools', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'logger-test-'));
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
        vi.restoreAllMocks();
    });

    it('should log skill usage', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-04T00:00:00Z'));

        const result = await logSkill('test-skill', 'manual', 'context', tempDir);
        expect(result).toBe('Successfully logged skill usage for test-skill');

        const logFile = path.join(tempDir, 'docs', 'agents', 'logs', 'skill_usage.log');
        const content = await fs.readFile(logFile, 'utf-8');
        expect(content).toContain('2026-03-04T00:00:00Z|test-skill|manual|context\n');

        vi.useRealTimers();
    });

    it('should log workflow usage', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-04T00:00:00Z'));

        const result = await logWorkflow('test-workflow', 'session-123', tempDir);
        expect(result).toBe('Successfully logged workflow usage for test-workflow');

        const logFile = path.join(tempDir, 'docs', 'agents', 'logs', 'workflow_usage.log');
        const content = await fs.readFile(logFile, 'utf-8');
        expect(content).toContain('2026-03-04T00:00:00Z|test-workflow|session-123\n');

        vi.useRealTimers();
    });

    it('should generate a default session id if not provided', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-04T00:00:00Z')); // 1772582400 in seconds

        await logWorkflow('test-workflow', '', tempDir);

        const logFile = path.join(tempDir, 'docs', 'agents', 'logs', 'workflow_usage.log');
        const content = await fs.readFile(logFile, 'utf-8');
        expect(content).toContain('2026-03-04T00:00:00Z|test-workflow|1772582400\n');

        vi.useRealTimers();
    });

    it('should rotate logs older than retention days', async () => {
        const logDir = path.join(tempDir, 'docs', 'agents', 'logs');
        await fs.mkdir(logDir, { recursive: true });

        // Old log line (e.g. 100 days old)
        const oldTimestamp = new Date();
        oldTimestamp.setDate(oldTimestamp.getDate() - 100);
        const oldStr = oldTimestamp.toISOString().replace(/\.[0-9]{3}Z$/, 'Z');

        // New log line (10 days old)
        const newTimestamp = new Date();
        newTimestamp.setDate(newTimestamp.getDate() - 10);
        const newStr = newTimestamp.toISOString().replace(/\.[0-9]{3}Z$/, 'Z');

        const logContent = `${oldStr}|test|manual|context1\n${newStr}|test|manual|context2\n`;
        await fs.writeFile(path.join(logDir, 'skill_usage.log'), logContent);

        const output = await rotateLogs(tempDir, 90);

        expect(output).toContain('Pruned 1 lines');
        const finalContent = await fs.readFile(path.join(logDir, 'skill_usage.log'), 'utf-8');
        expect(finalContent).not.toContain('context1');
        expect(finalContent).toContain('context2');
    });

    it('should report if no logs need rotation', async () => {
        const logDir = path.join(tempDir, 'docs', 'agents', 'logs');
        await fs.mkdir(logDir, { recursive: true });

        const newTimestamp = new Date();
        newTimestamp.setDate(newTimestamp.getDate() - 10);
        const newStr = newTimestamp.toISOString().replace(/\.[0-9]{3}Z$/, 'Z');

        const logContent = `${newStr}|test|manual|context2\n`;
        await fs.writeFile(path.join(logDir, 'skill_usage.log'), logContent);

        const output = await rotateLogs(tempDir, 90);
        expect(output).toContain('(No logs needed rotation)');
    });
});
