import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkTypescriptCoverage, checkPythonCoverage } from '../typeCoverage.js';
import * as fs from 'fs/promises';
vi.mock('fs/promises');
describe('typeCoverage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    describe('checkTypescriptCoverage', () => {
        it('should analyze a typescript file and find any types', async () => {
            // Mock readdir to return 1 TS file
            vi.mocked(fs.readdir).mockResolvedValue([{
                    name: 'index.ts',
                    isDirectory: () => false
                }]);
            // Mock readFile to return a snippet with an untyped function and an "any"
            vi.mocked(fs.readFile).mockResolvedValue(`
                function test(): any { return 1; }
                const test2 = (x) => console.log(x);
            `);
            const result = await checkTypescriptCoverage('/mock/folder');
            expect(result.type).toBe('typescript');
            expect(result.files).toBe(1);
            expect(result.stats.any_count).toBeGreaterThan(0);
            expect(result.stats.untyped_functions).toBeGreaterThan(0);
        });
        it('should handle perfectly typed code without any', async () => {
            vi.mocked(fs.readdir).mockResolvedValue([{
                    name: 'good.ts',
                    isDirectory: () => false
                }]);
            vi.mocked(fs.readFile).mockResolvedValue(`
                function typedFunc(val: string): number { return val.length; }
            `);
            const result = await checkTypescriptCoverage('/mock/good');
            expect(result.stats.any_count).toBe(0);
            expect(result.stats.untyped_functions).toBe(0);
            expect(result.passed.some(p => p.includes('100%'))).toBe(true);
        });
    });
    describe('checkPythonCoverage', () => {
        it('should detect Python type hint issues', async () => {
            vi.mocked(fs.readdir).mockResolvedValue([{
                    name: 'script.py',
                    isDirectory: () => false
                }]);
            vi.mocked(fs.readFile).mockResolvedValue(`
def bad_func(arg):
    pass
    
def good_func(arg: str) -> bool:
    return True
    
def any_func(arg: Any) -> Any:
    pass
             `);
            const result = await checkPythonCoverage('/mock/py');
            expect(result.stats.any_count).toBeGreaterThan(0);
            expect(result.stats.untyped_functions).toBe(1);
        });
    });
});
