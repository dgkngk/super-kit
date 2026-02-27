import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runSeoChecker } from '../seoChecker.js';
import * as fs from 'fs/promises';

vi.mock('fs/promises');

describe('seoChecker', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should report SEO issues on a page', async () => {
        vi.mocked(fs.readdir).mockResolvedValue([{
            name: 'index.tsx', // valid page layout file
            isDirectory: () => false
        } as any]);

        vi.mocked(fs.readFile).mockResolvedValue(`
            export default function Index() {
                return (
                    <html>
                        <head>
                            <title>Oops missing description and og</title>
                        </head>
                        <body>
                            <h1>Title</h1>
                            <h1>Duplicate Title</h1>
                            <img src="foo" />
                            <img src="bar" alt="" />
                        </body>
                    </html>
                )
            }
        `);

        const res = await runSeoChecker('.');
        expect(res.passed).toBe(false);
        expect(res.report).toContain('Image missing alt attribute');
    });

    it('should ignore non-pages files like utilities', async () => {
        vi.mocked(fs.readdir).mockResolvedValue([{
            name: 'api.util.ts',
            isDirectory: () => false
        } as any]);

        const res = await runSeoChecker('.');
        expect(res.passed).toBe(true);
        expect(res.report).toContain('[!] No page files found.');
    });
});
