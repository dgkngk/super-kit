import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { compoundSearch, updateSolutionRef, validateCompound, auditStateDrift } from '../compoundTools.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Compound Tools', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'compound-test-'));
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should search for solutions', async () => {
        const solDir = path.join(tempDir, 'docs', 'solutions');
        await fs.mkdir(solDir, { recursive: true });

        await fs.writeFile(path.join(solDir, 'test.md'), '# Test Solution\n\nThis mentions React and Next.js.');
        await fs.writeFile(path.join(solDir, 'test2.md'), '# Other Solution\n\nThis mentions Vue.');

        const res = await compoundSearch(['React'], tempDir);
        expect(res).toContain('test.md');
        expect(res).toContain('Test Solution');
        expect(res).not.toContain('test2.md');
    });

    it('should update solution ref', async () => {
        const solDir = path.join(tempDir, 'docs', 'solutions');
        await fs.mkdir(solDir, { recursive: true });
        const filePath = path.join(solDir, 'test.md');
        await fs.writeFile(filePath, '---\ntags: [test]\n---\n# Test Solution');

        const res = await updateSolutionRef([path.relative(tempDir, filePath)], tempDir);
        expect(res).toContain('Updated 1 files');

        const content = await fs.readFile(filePath, 'utf-8');
        expect(content).toContain('last_referenced:');
    });

    it('should validate compound health', async () => {
        const planPath = path.join(tempDir, 'implementation_plan.md');
        await fs.writeFile(planPath, '- [ ] todo 1\n- [ ] todo 2\n');

        const res = await validateCompound(tempDir);
        expect(res).toContain('⚠️  Found 2 unchecked items in implementation_plan.md');
        expect(res).toContain('❌ Validation failed.');
    });

    it('should audit state drift and report drift', async () => {
        const todosDir = path.join(tempDir, 'todos');
        await fs.mkdir(todosDir, { recursive: true });
        const todoPath = path.join(todosDir, '001-pending-p1-test.md');
        await fs.writeFile(todoPath, 'status: pending\n\n- [x] tick 1\n- [x] tick 2');

        const res = await auditStateDrift(tempDir, false);
        expect(res).toContain('DRIFT: 001-pending-p1-test.md');
        expect(res).toContain('Checked: 2/2');
    });

    it('should audit state drift and fix drift', async () => {
        const todosDir = path.join(tempDir, 'todos');
        await fs.mkdir(todosDir, { recursive: true });
        const todoPath = path.join(todosDir, '001-pending-p1-test.md');
        await fs.writeFile(todoPath, 'status: pending\n\n- [x] tick 1\n- [x] tick 2');

        const res = await auditStateDrift(tempDir, true);
        expect(res).toContain('FIXED: 001-pending-p1-test.md');

        const content = await fs.readFile(todoPath, 'utf8');
        expect(content).toContain('status: done');
    });
});
