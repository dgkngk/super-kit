import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runConvertRules } from '../convertRules.js';
import * as fs from 'fs/promises';
vi.mock('fs/promises');
describe('convertRules', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it('should fail if the rules directory does not exist', async () => {
        vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));
        const res = await runConvertRules('.');
        expect(res.passed).toBe(false);
        expect(res.report).toContain('[ERROR] Rules directory not found');
    });
    it('should correctly parse frontmatter and generate rules', async () => {
        vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true });
        vi.mocked(fs.readdir).mockResolvedValue(['async-waterfall.md']);
        vi.mocked(fs.readFile).mockResolvedValue(`---
title: Waterfall check
impact: HIGH
tags: perf
---
Content body of the rule here.`);
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        const res = await runConvertRules('.');
        console.log("ACTUAL REPORT:", res.report);
        expect(res.passed).toBe(true);
        expect(res.report).toContain('Generated 8 section files from 1 rules');
        // ensure valid output creation
        expect(fs.writeFile).toHaveBeenCalled();
        const callArgs = vi.mocked(fs.writeFile).mock.calls[0];
        const writtenContent = callArgs[1];
        expect(writtenContent).toContain('## Rule 1.1: Waterfall check');
        expect(writtenContent).toContain('**Impact:** HIGH');
        expect(writtenContent).toContain('Content body of the rule here.');
    });
});
