import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runPlaywrightTest, runPlaywrightA11y } from '../playwrightRunner.js';
vi.mock('playwright', () => {
    return {
        chromium: {
            launch: vi.fn().mockResolvedValue({
                newContext: vi.fn().mockResolvedValue({
                    newPage: vi.fn().mockResolvedValue({
                        goto: vi.fn().mockResolvedValue({
                            status: () => 200,
                            ok: () => true
                        }),
                        title: vi.fn().mockResolvedValue('Mock Title'),
                        url: () => 'https://example.com',
                        locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(5) }),
                        on: vi.fn(),
                        evaluate: vi.fn().mockResolvedValue('{"dom_content_loaded":100,"load_complete":200}'),
                        screenshot: vi.fn().mockResolvedValue(true)
                    })
                }),
                newPage: vi.fn().mockResolvedValue({
                    goto: vi.fn().mockResolvedValue({
                        status: () => 200,
                        ok: () => true
                    }),
                    locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(3) })
                }),
                close: vi.fn().mockResolvedValue(undefined)
            })
        }
    };
});
describe('playwrightRunner', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it('should successfully run a basic browser test', async () => {
        const res = await runPlaywrightTest('https://example.com');
        console.log("PLAYWRIGHT TEST:", res);
        expect(res.error).toBeUndefined();
        expect(res.status).toBe('success');
        expect(res.health.loaded).toBe(true);
        expect(res.performance.dom_content_loaded).toBe(100);
        expect(res.elements.links).toBe(5);
        expect(res.summary).toContain('[OK] Page loaded');
    });
    it('should calculate accessibility counts properly', async () => {
        const res = await runPlaywrightA11y('https://example.com');
        console.log("PLAYWRIGHT A11y:", res);
        expect(res.error).toBeUndefined();
        expect(res.status).toBe('success');
        expect(res.accessibility.images_with_alt).toBe(3);
        expect(res.accessibility.headings.h1).toBe(3);
    });
});
