import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateChangelog, archiveCompleted, prePushHousekeeping } from '../gitTools.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
describe('Git Tools', () => {
    let tempDir;
    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'git-test-'));
    });
    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });
    it('should validate changelog', async () => {
        const changelogPath = path.join(tempDir, 'CHANGELOG.md');
        await fs.writeFile(changelogPath, '## [Unreleased]\n## [Unreleased]\n<<<<<<< HEAD');
        const result = await validateChangelog(tempDir);
        expect(result).toContain('Multiple [Unreleased] sections found');
        expect(result).toContain('Merge conflict markers found');
    });
    it('should archive completed items in dry-run mode', async () => {
        await fs.mkdir(path.join(tempDir, 'todos'), { recursive: true });
        const todoPath = path.join(tempDir, 'todos', '001-done-test.md');
        await fs.writeFile(todoPath, 'content');
        const res = await archiveCompleted(tempDir, false);
        expect(res).toContain('DRY-RUN');
        expect(res).toContain('[ARCHIVED] 001-done-test.md');
        // Still exists
        await fs.access(todoPath);
    });
    it('should archive completed items and move them', async () => {
        await fs.mkdir(path.join(tempDir, 'todos'), { recursive: true });
        const todoPath = path.join(tempDir, 'todos', '001-done-test.md');
        await fs.writeFile(todoPath, 'content');
        const res = await archiveCompleted(tempDir, true);
        expect(res).toContain('APPLYING CHANGES');
        const archivedPath = path.join(tempDir, 'todos', 'archive', '001-done-test.md');
        await fs.access(archivedPath); // Should not throw
    });
    it('should run pre-push housekeeping', async () => {
        const res = await prePushHousekeeping(tempDir, false);
        expect(res).toContain('Pre-Push Housekeeping Check');
        expect(res).toContain('All checks passed');
    });
});
