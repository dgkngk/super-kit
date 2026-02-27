import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanSecrets, scanCodePatterns } from '../securityScan.js';
import * as fs from 'fs/promises';

vi.mock('fs/promises');

describe('securityScan', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('scanSecrets', () => {
        it('should detect AWS keys', async () => {
            // Mock file system
            vi.mocked(fs.readdir).mockResolvedValue([{
                name: 'config.json',
                isDirectory: () => false
            } as any]);

            vi.mocked(fs.readFile).mockResolvedValue(`
                 { "aws_key": "AKIA1234567890123456" }
             `);

            const result = await scanSecrets('/mock');
            expect(result.findings).toBeDefined();
            expect(result.findings.some((f: any) => f.type === 'AWS Access Key')).toBe(true);
            expect(result.by_severity.critical).toBeGreaterThan(0);
        });
    });

    describe('scanCodePatterns', () => {
        it('should detect eval() and child_process.exec()', async () => {
            vi.mocked(fs.readdir).mockResolvedValue([{
                name: 'bad_code.js',
                isDirectory: () => false
            } as any]);

            vi.mocked(fs.readFile).mockResolvedValue(`
                 eval('2 + 2');
                 import { exec } from 'child_process';
                 child_process.exec('rm -rf /');
             `);

            const result = await scanCodePatterns('/mock');
            expect(result.findings.length).toBeGreaterThan(1);
            expect(result.findings.some((f: any) => f.pattern === 'eval() usage')).toBe(true);
            expect(result.findings.some((f: any) => f.pattern === 'child_process.exec')).toBe(true);
        });
    });
});
