import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runReactPerformanceChecker } from '../reactPerformanceChecker.js';
import * as fs from 'fs/promises';

vi.mock('fs/promises');

describe('reactPerformanceChecker', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should detect waterfalls and barrel imports', async () => {
        vi.mocked(fs.readdir).mockResolvedValue([{
            name: 'Home.tsx',
            isDirectory: () => false
        } as any]);

        vi.mocked(fs.readFile).mockResolvedValue(`
            import { something } from '@/components/index';
            
            async function loadData() {
                const a = await fetchA();
                const b = await fetchB();
                return { a, b };
            }
        `);

        const res = await runReactPerformanceChecker('.');
        console.log("RPC BAD REPORT:", res.report);
        expect(res.passed).toBe(false); // CRITICAL issue makes it fail
        expect(res.report).toContain('Sequential awaits detected (waterfall)');
        expect(res.report).toContain('Potential barrel imports detected');
    });

    it('should pass cleanly configured react app', async () => {
        vi.mocked(fs.readdir).mockResolvedValue([{
            name: 'App.tsx',
            isDirectory: () => false
        } as any]);

        vi.mocked(fs.readFile).mockResolvedValue(`
            import { useQuery } from '@tanstack/react-query';
            import Image from 'next/image';
            
            const App = React.memo((props: Props) => {
                const q = useQuery('data', fetchParallel);
                return <Image src="foo" alt="bar" />
            });
            export default App;
        `);

        const res = await runReactPerformanceChecker('.');
        console.log("RPC GOOD REPORT:", res.report);
        expect(res.passed).toBe(true);
        expect(res.report).toContain('[SUCCESS]');
    });
});
