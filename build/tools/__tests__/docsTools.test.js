import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { bootstrapFolderDocs, checkDocsFreshness, discoverUndocumentedFolders, validateFolderDocs } from '../docsTools.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
describe('Docs Tools', () => {
    let tempDir;
    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-test-'));
    });
    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });
    it('should bootstrap folder docs', async () => {
        const targetDir = path.join(tempDir, 'src');
        await fs.mkdir(targetDir, { recursive: true });
        await fs.writeFile(path.join(targetDir, 'utils.ts'), 'content');
        const result = await bootstrapFolderDocs('src', tempDir);
        expect(result).toContain('Bootstrapped');
        const readme = await fs.readFile(path.join(targetDir, 'README.md'), 'utf8');
        expect(readme).toContain('# src');
        expect(readme).toContain('`utils.ts`');
    });
    it('should discover undocumented folders', async () => {
        const srcDir = path.join(tempDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });
        await fs.writeFile(path.join(srcDir, 'logic.ts'), 'content');
        // no readme -> should be discovered
        const result = await discoverUndocumentedFolders(tempDir);
        expect(result).toContain('src');
    });
    it('should validate folder docs', async () => {
        const targetDir = path.join(tempDir, 'src');
        await fs.mkdir(targetDir, { recursive: true });
        await fs.writeFile(path.join(targetDir, 'README.md'), '# src\n');
        const result = await validateFolderDocs(false, ['src'], tempDir);
        expect(result).toContain('missing sections: Purpose, Components, Component Details, Changelog');
    });
    it('should check docs freshness without failing', async () => {
        // Just tests the skip-docs flag since git repo isn't present
        const result = await checkDocsFreshness(true, tempDir);
        expect(result).toContain('Skipping documentation freshness check');
    });
});
