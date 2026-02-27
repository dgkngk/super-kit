import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkLocaleCompleteness } from '../i18nChecker.js';
import * as fs from 'fs/promises';
vi.mock('fs/promises');
describe('i18nChecker', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    describe('checkLocaleCompleteness', () => {
        it('should detect missing translation keys in other locales', async () => {
            // Mock translation files
            vi.mocked(fs.readFile).mockImplementation(async (file) => {
                if (file.includes('en'))
                    return JSON.stringify({ hello: 'World', nested: { a: 1, b: 2 } });
                if (file.includes('fr'))
                    return JSON.stringify({ hello: 'Monde', nested: { a: 1 } });
                return "{}";
            });
            const result = await checkLocaleCompleteness(['/locales/en/common.json', '/locales/fr/common.json']);
            expect(result.issues.some(i => i.includes('Missing 1 keys'))).toBe(true);
            expect(result.passed.some(p => p.includes('Found 2 language'))).toBe(true);
        });
        it('should pass matching keys', async () => {
            vi.mocked(fs.readFile).mockImplementation(async (file) => {
                return JSON.stringify({ a: 1, b: 2 });
            });
            const result = await checkLocaleCompleteness(['/en/app.json', '/es/app.json']);
            expect(result.issues.length).toBe(0);
            expect(result.passed.some(p => p.includes('matching keys'))).toBe(true);
        });
    });
});
