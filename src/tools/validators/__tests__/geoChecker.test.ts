import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkGeoPage, findWebPages, runGeoChecker } from '../geoChecker.js';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';

vi.mock('fs/promises');

describe('geoChecker', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('checkGeoPage', () => {
        it('should detect structured schema and H1s', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(`
                <html lang="en">
                <head>
                <script type="application/ld+json">
                {
                  "@type": "Article",
                  "author": "Test Author"
                }
                </script>
                </head>
                <body>
                    <h1>Main Title</h1>
                    <p>Some content with numbers like 50% and $100.</p>
                </body>
                </html>
            `);

            const result = await checkGeoPage('/mock/page.html');
            expect(result.passed.some(m => m.includes('JSON-LD structured data'))).toBe(true);
            expect(result.passed.some(m => m.includes('Single H1'))).toBe(true);
            expect(result.passed.some(m => m.includes('Original statistics'))).toBe(true);
            expect(result.score).toBeGreaterThan(0);
        });

        it('should flag missing structural tags', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(`
                <body>
                    <p>No headings, no structure, no stats.</p>
                </body>
            `);

            const result = await checkGeoPage('/mock/bad.html');
            expect(result.issues.some(m => m.includes('No JSON-LD'))).toBe(true);
            expect(result.issues.some(m => m.includes('No H1 heading'))).toBe(true);
            expect(result.score).toBeLessThan(50);
        });
    });
});
