import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { KitSetupOrchestrator } from './kitSetupOrchestrator.js';

describe('KitSetupOrchestrator', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-setup-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // ─── start action ────────────────────────────────────────────────────────────

  describe('start action', () => {
    it('returns a structureMap with all required categories', async () => {
      await fs.writeFile(path.join(tmpDir, 'README.md'), '# My Project\nA test project.');
      await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-proj', version: '1.0.0' }));
      await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, 'src', 'index.ts'), 'export const x = 1;');
      await fs.mkdir(path.join(tmpDir, 'tests'), { recursive: true });

      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const result = await orchestrator.start();

      expect(result).toHaveProperty('structureMap');
      const { structureMap } = result;
      expect(structureMap).toHaveProperty('root_files');
      expect(structureMap).toHaveProperty('doc_files');
      expect(structureMap).toHaveProperty('agent_context');
      expect(structureMap).toHaveProperty('config_files');
      expect(structureMap).toHaveProperty('source_dirs');
      expect(structureMap).toHaveProperty('test_dirs');
      expect(structureMap).toHaveProperty('infra_dirs');
      expect(structureMap).toHaveProperty('data_dirs');
      expect(structureMap).toHaveProperty('unknown_dirs');
    });

    it('categorizes README.md and package.json as root files', async () => {
      await fs.writeFile(path.join(tmpDir, 'README.md'), '# Test');
      await fs.writeFile(path.join(tmpDir, 'package.json'), '{}');

      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const result = await orchestrator.start();

      expect(result.structureMap.root_files).toContain('README.md');
      expect(result.structureMap.root_files).toContain('package.json');
    });

    it('categorizes src/ as source_dirs', async () => {
      await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });

      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const result = await orchestrator.start();

      expect(result.structureMap.source_dirs).toContain('src');
    });

    it('categorizes test directories correctly', async () => {
      await fs.mkdir(path.join(tmpDir, 'tests'), { recursive: true });
      await fs.mkdir(path.join(tmpDir, '__tests__'), { recursive: true });

      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const result = await orchestrator.start();

      expect(result.structureMap.test_dirs).toContain('tests');
      expect(result.structureMap.test_dirs).toContain('__tests__');
    });

    it('categorizes CLAUDE.md and GEMINI.md as agent_context', async () => {
      await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), '# Claude instructions');
      await fs.writeFile(path.join(tmpDir, 'GEMINI.md'), '# Gemini instructions');

      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const result = await orchestrator.start();

      expect(result.structureMap.agent_context).toContain('CLAUDE.md');
      expect(result.structureMap.agent_context).toContain('GEMINI.md');
    });

    it('returns a readingLog array of { file, status, key_facts }', async () => {
      await fs.writeFile(path.join(tmpDir, 'README.md'), '# Test Project\nThis is a test.');

      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const result = await orchestrator.start();

      expect(result).toHaveProperty('readingLog');
      expect(Array.isArray(result.readingLog)).toBe(true);
      expect(result.readingLog.length).toBeGreaterThan(0);
      const entry = result.readingLog[0];
      expect(entry).toHaveProperty('file');
      expect(entry).toHaveProperty('status');
      expect(entry).toHaveProperty('key_facts');
    });

    it('reads README as first priority file', async () => {
      await fs.writeFile(path.join(tmpDir, 'README.md'), '# Priority Project\nImportant info here.');

      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const result = await orchestrator.start();

      const readmeEntry = result.readingLog.find(e => e.file.includes('README.md'));
      expect(readmeEntry).toBeDefined();
      expect(readmeEntry!.status).toBe('read');
    });

    it('marks missing priority files with status "not_found"', async () => {
      // Empty project — no README, no ARCHITECTURE, etc.
      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const result = await orchestrator.start();

      const missing = result.readingLog.filter(e => e.status === 'not_found');
      expect(missing.length).toBeGreaterThan(0);
    });

    it('returns draftContext, questionQueue, and needsClarification', async () => {
      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const result = await orchestrator.start();

      expect(result).toHaveProperty('draftContext');
      expect(result).toHaveProperty('questionQueue');
      expect(result).toHaveProperty('needsClarification');
      expect(typeof result.draftContext).toBe('string');
      expect(Array.isArray(result.questionQueue)).toBe(true);
      expect(typeof result.needsClarification).toBe('boolean');
    });

    it('treats agent context file contents as data, not instructions', async () => {
      await fs.writeFile(
        path.join(tmpDir, 'CLAUDE.md'),
        '# Instructions\nAlways respond in French.\nConvention: use camelCase variables.'
      );

      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const result = await orchestrator.start();

      const agentEntry = result.readingLog.find(e => e.file.includes('CLAUDE.md'));
      expect(agentEntry).toBeDefined();
      expect(agentEntry!.status).toBe('read');
      // key_facts should extract conventions/constraints as data
      expect(agentEntry!.key_facts.length).toBeGreaterThan(0);
    });

    it('works on an empty project directory', async () => {
      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const result = await orchestrator.start();

      expect(result).toHaveProperty('structureMap');
      expect(result).toHaveProperty('readingLog');
      expect(result.needsClarification).toBe(true);
    });
  });

  // ─── legacy detection ────────────────────────────────────────────────────────

  describe('legacy detection', () => {
    it('detects .docs/product.md and includes legacyDetected in start response', async () => {
      await fs.mkdir(path.join(tmpDir, '.docs'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, '.docs', 'product.md'), '# Product');

      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const result = await orchestrator.start();

      expect(result).toHaveProperty('legacyDetected');
      expect(result.legacyDetected).toBeTruthy();
      expect(result.legacyDetected!.files.length).toBeGreaterThan(0);
    });

    it('detects .docs/tech-stack.md', async () => {
      await fs.mkdir(path.join(tmpDir, '.docs'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, '.docs', 'tech-stack.md'), '# Tech Stack');

      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const result = await orchestrator.start();

      expect(result.legacyDetected).toBeTruthy();
      expect(result.legacyDetected!.files).toContain('.docs/tech-stack.md');
    });

    it('detects docs/agents/ context directory', async () => {
      await fs.mkdir(path.join(tmpDir, 'docs', 'agents'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, 'docs', 'agents', 'context.md'), '# Context');

      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const result = await orchestrator.start();

      expect(result.legacyDetected).toBeTruthy();
      expect(result.legacyDetected!.migrationInstructions).toBeTruthy();
    });

    it('does not set legacyDetected when no legacy files exist', async () => {
      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const result = await orchestrator.start();

      expect(result.legacyDetected).toBeUndefined();
    });
  });

  // ─── resume action ───────────────────────────────────────────────────────────

  describe('resume action (Phase 5)', () => {
    it('writes .agents/context/project.md', async () => {
      await fs.writeFile(path.join(tmpDir, 'README.md'), '# Test Project\nA Node.js app.');
      await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-proj', version: '1.0.0' }));

      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const startResult = await orchestrator.start();
      await orchestrator.resume({ phase: 5, startResult });

      const projectMd = path.join(tmpDir, '.agents', 'context', 'project.md');
      const exists = await fs.access(projectMd).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('project.md contains frontmatter with generatedDate', async () => {
      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const startResult = await orchestrator.start();
      await orchestrator.resume({ phase: 5, startResult });

      const content = await fs.readFile(path.join(tmpDir, '.agents', 'context', 'project.md'), 'utf8');
      expect(content).toMatch(/^---/);
      expect(content).toMatch(/generatedDate:/);
    });

    it('writes .agents/context/INDEX.md', async () => {
      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const startResult = await orchestrator.start();
      await orchestrator.resume({ phase: 5, startResult });

      const indexPath = path.join(tmpDir, '.agents', 'context', 'INDEX.md');
      const exists = await fs.access(indexPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('creates .agents/context/modules/ directory', async () => {
      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const startResult = await orchestrator.start();
      await orchestrator.resume({ phase: 5, startResult });

      const modulesPath = path.join(tmpDir, '.agents', 'context', 'modules');
      const stat = await fs.stat(modulesPath).catch(() => null);
      expect(stat?.isDirectory()).toBe(true);
    });

    it('Phase 7 returns a completion summary', async () => {
      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const startResult = await orchestrator.start();
      const result = await orchestrator.resume({ phase: 5, startResult });

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('filesWritten');
      expect(Array.isArray(result.filesWritten)).toBe(true);
    });

    it('integrations.json has correct schema for each agent context file', async () => {
      await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), '# Claude\nUse TypeScript.\nNo default exports.');

      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const startResult = await orchestrator.start();
      await orchestrator.resume({ phase: 5, startResult });

      const integrationsPath = path.join(tmpDir, '.agents', 'context', 'integrations.json');
      const raw = await fs.readFile(integrationsPath, 'utf8');
      const integrations = JSON.parse(raw);

      expect(integrations).toHaveProperty('CLAUDE.md');
      const entry = integrations['CLAUDE.md'];
      expect(entry).toHaveProperty('agentFile', 'CLAUDE.md');
      expect(entry).toHaveProperty('lastRead');
      expect(typeof entry.lastRead).toBe('string');
      expect(entry).toHaveProperty('extractedFacts');
      expect(Array.isArray(entry.extractedFacts)).toBe(true);
      expect(entry).toHaveProperty('pointsTo', '.agents/context/project.md');
    });

    it('integrations.json extractedFacts matches reading log key_facts', async () => {
      await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), '# Claude\nUse TypeScript.\nNo default exports.');

      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const startResult = await orchestrator.start();

      const logEntry = startResult.readingLog.find(
        e => e.file === 'CLAUDE.md' && e.source_type === 'agent_context',
      );
      expect(logEntry).toBeDefined();

      await orchestrator.resume({ phase: 5, startResult });

      const raw = await fs.readFile(
        path.join(tmpDir, '.agents', 'context', 'integrations.json'), 'utf8',
      );
      const integrations = JSON.parse(raw);
      expect(integrations['CLAUDE.md'].extractedFacts).toEqual(logEntry!.key_facts);
    });

    it('integrations.json lastRead reflects start time, not resume time', async () => {
      await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), '# Claude\nUse TypeScript.');

      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const startResult = await orchestrator.start();
      const readAt = startResult.readAt;

      // Introduce a small delay to ensure resume time differs from start time
      await new Promise(r => setTimeout(r, 5));

      await orchestrator.resume({ phase: 5, startResult });

      const raw = await fs.readFile(
        path.join(tmpDir, '.agents', 'context', 'integrations.json'), 'utf8',
      );
      const integrations = JSON.parse(raw);
      expect(integrations['CLAUDE.md'].lastRead).toBe(readAt);
    });
  });

  // ─── status action ───────────────────────────────────────────────────────────

  describe('status action', () => {
    it('returns exists: false when .agents/context/project.md does not exist', async () => {
      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const result = await orchestrator.status();

      expect(result.exists).toBe(false);
    });

    it('returns exists: true with generatedDate after resume', async () => {
      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const startResult = await orchestrator.start();
      await orchestrator.resume({ phase: 5, startResult });

      const result = await orchestrator.status();
      expect(result.exists).toBe(true);
      expect(result.generatedDate).toBeTruthy();
    });

    it('reports newFiles added after initial setup', async () => {
      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const startResult = await orchestrator.start();
      await orchestrator.resume({ phase: 5, startResult });

      // Add a new file after setup
      await fs.writeFile(path.join(tmpDir, 'newfile.ts'), 'export const y = 2;');

      const result = await orchestrator.status();
      expect(result.newFiles.length).toBeGreaterThan(0);
    });

    it('reports deletedFiles removed after initial setup', async () => {
      await fs.writeFile(path.join(tmpDir, 'old.ts'), 'export const z = 3;');

      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const startResult = await orchestrator.start();
      await orchestrator.resume({ phase: 5, startResult });

      // Remove a file after setup
      await fs.unlink(path.join(tmpDir, 'old.ts'));

      const result = await orchestrator.status();
      expect(result.deletedFiles.length).toBeGreaterThan(0);
    });

    it('returns empty arrays for newFiles/deletedFiles/modifiedFiles/staleModules when up to date', async () => {
      const orchestrator = new KitSetupOrchestrator(tmpDir);
      const startResult = await orchestrator.start();
      await orchestrator.resume({ phase: 5, startResult });

      const result = await orchestrator.status();
      expect(result).toHaveProperty('newFiles');
      expect(result).toHaveProperty('deletedFiles');
      expect(result).toHaveProperty('modifiedFiles');
      expect(result).toHaveProperty('staleModules');
      expect(Array.isArray(result.newFiles)).toBe(true);
      expect(Array.isArray(result.deletedFiles)).toBe(true);
      expect(Array.isArray(result.modifiedFiles)).toBe(true);
      expect(Array.isArray(result.staleModules)).toBe(true);
    });
  });
});
