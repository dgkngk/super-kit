import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateSpecConsistency, completePlan, validateArchitecture } from '../archTools.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Arch Tools', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'arch-test-'));
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should complete a plan successfully', async () => {
        const planPath = path.join(tempDir, 'plan1.md');
        await fs.writeFile(planPath, '> Status: Draft\n\n- [x] Done item');

        const res = await completePlan('plan1.md', false, tempDir);
        expect(res).toContain('Plan marked as Implemented');

        const content = await fs.readFile(planPath, 'utf8');
        expect(content).toContain('> Status: Implemented');
    });

    it('should fail to complete a plan if unchecked items exist', async () => {
        const planPath = path.join(tempDir, 'plan2.md');
        await fs.writeFile(planPath, '> Status: Draft\n\n- [ ] Pending item');

        const res = await completePlan('plan2.md', false, tempDir);
        expect(res).toContain('unchecked acceptance criteria found');
    });

    it('should force complete a plan with unchecked items', async () => {
        const planPath = path.join(tempDir, 'plan3.md');
        await fs.writeFile(planPath, '> Status: Draft\n\n- [ ] Pending item');

        const res = await completePlan('plan3.md', true, tempDir);
        expect(res).toContain('Plan marked as Implemented');
    });

    it('should validate architecture counts', async () => {
        const archDir = path.join(tempDir, 'docs', 'architecture');
        await fs.mkdir(archDir, { recursive: true });

        await fs.writeFile(path.join(archDir, 'compound-system.md'),
            '---\nskills: 1\nworkflows: 0\nscripts: 0\npatterns: 0\n---');

        const res = await validateArchitecture(tempDir);
        expect(res).toContain('Architecture Document is stale!');
        expect(res).toContain('Skills mismatch');
    });
});
