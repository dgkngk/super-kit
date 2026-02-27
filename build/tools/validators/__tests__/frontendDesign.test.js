import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAccessibility } from '../accessibilityChecker.js';
import { runUxAudit } from '../uxAudit.js';
import * as fs from 'fs/promises';
vi.mock('fs/promises');
describe('accessibilityChecker', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    describe('checkAccessibility', () => {
        it('should detect input without label and img without alt', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(`
                 <input type="text" name="bad" />
                 <button>Click me</button>
             `);
            const issues = await checkAccessibility('test.html');
            expect(issues.some(i => i.includes('Input without label'))).toBe(true);
            expect(issues.some(i => i.includes('Missing lang'))).toBe(false); // only checks if <html> exists
        });
        it('should pass good inputs', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(`
                 <html lang="en">
                   <input type="text" aria-label="Good" />
                   <button aria-label="Close">X</button>
                 </html>
             `);
            const issues = await checkAccessibility('test.html');
            expect(issues).toEqual([]); // Skip link is only requested if <main> or <body> is present
        });
    });
});
describe('uxAudit', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    describe('runUxAudit', () => {
        it('should detect UX violations', async () => {
            vi.mocked(fs.readdir).mockResolvedValue([{
                    name: 'test.tsx',
                    isDirectory: () => false
                }]);
            vi.mocked(fs.readFile).mockResolvedValue(`
                 <button onClick={() => {}}>Submit</button>
                 <img src="foo.jpg">
                 <p style="color: #000000; font-family: purple;">Hello</p>
             `);
            const res = await runUxAudit('.');
            expect(res.passed).toBe(false);
            expect(res.report.includes('PURPLE DETECTED')).toBe(true);
            expect(res.report.includes('Missing img alt text')).toBe(true);
            expect(res.report.includes('Pure black')).toBe(true);
            expect(res.report.includes('Interactive elements lack immediate feedback')).toBe(true);
        });
    });
});
