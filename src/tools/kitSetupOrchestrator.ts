import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StructureMap {
  root_files: string[];
  doc_files: string[];
  agent_context: string[];
  config_files: string[];
  source_dirs: string[];
  test_dirs: string[];
  infra_dirs: string[];
  data_dirs: string[];
  unknown_dirs: string[];
}

export interface ReadingLogEntry {
  file: string;
  status: 'read' | 'not_found' | 'skipped';
  source_type: 'doc' | 'agent_context' | 'manifest' | 'source_readme';
  key_facts: string[];
}

export interface LegacyDetected {
  files: string[];
  migrationInstructions: string;
}

export interface StartResult {
  structureMap: StructureMap;
  readingLog: ReadingLogEntry[];
  draftContext: string;
  questionQueue: string[];
  needsClarification: boolean;
  legacyDetected?: LegacyDetected;
  readAt: string;
}

export interface ResumeOptions {
  phase: number;
  startResult: StartResult;
}

export interface ResumeResult {
  summary: string;
  filesWritten: string[];
}

export interface StatusResult {
  exists: boolean;
  generatedDate?: string;
  newFiles: string[];
  deletedFiles: string[];
  modifiedFiles: string[];
  staleModules: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENT_CONTEXT_FILES = new Set([
  'CLAUDE.md', 'CLAUDE.local.md', 'GEMINI.md', 'AGENTS.md',
  '.cursorrules', '.windsurfrules', '.aider.conf.yml', 'CLINE.md',
]);

const AGENT_CONTEXT_PATHS = new Set([
  '.claude/CLAUDE.md', '.github/copilot-instructions.md',
]);

const SOURCE_DIR_NAMES = new Set([
  'src', 'lib', 'app', 'components', 'pages', 'api',
  'server', 'client', 'packages', 'modules', 'core',
]);

const TEST_DIR_NAMES = new Set([
  'test', 'tests', '__tests__', 'spec', 'specs', 'e2e', '__test__',
]);

const INFRA_DIR_NAMES = new Set([
  '.github', 'docker', 'k8s', 'kubernetes', 'terraform', 'infra',
  'infrastructure', 'deploy', 'ci', '.circleci', '.gitlab',
]);

const DATA_DIR_NAMES = new Set([
  'data', 'fixtures', 'migrations', 'seeds', 'mocks', 'stubs',
  'assets', 'public', 'static',
]);

const DOC_DIR_NAMES = new Set([
  'docs', 'doc', 'documentation', 'wiki', '.agents',
]);

const CONFIG_FILE_EXTS = new Set([
  '.json', '.yml', '.yaml', '.toml', '.ini', '.env', '.lock',
]);

const CONFIG_FILE_NAMES = new Set([
  'tsconfig.json', '.eslintrc', '.eslintrc.js', '.eslintrc.json',
  '.prettierrc', '.prettierrc.js', '.prettierrc.json', 'jest.config.ts',
  'jest.config.js', 'vitest.config.ts', 'vitest.config.js',
  'webpack.config.js', 'vite.config.ts', 'vite.config.js',
  '.env', '.env.example', '.gitignore', '.npmrc', 'Makefile',
  'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
]);

// Manifest files are treated as root_files (project descriptors), not config_files
const MANIFEST_FILE_NAMES = new Set([
  'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'requirements.txt', 'Pipfile', 'pyproject.toml', 'go.mod', 'go.sum',
  'Cargo.toml', 'Cargo.lock', 'pom.xml', 'build.gradle', 'build.gradle.kts',
  'Gemfile', 'Gemfile.lock', 'composer.json', 'composer.lock',
]);

const PRIORITY_READ_FILES = [
  'README.md', 'README.rst', 'README.txt',
  'ARCHITECTURE.md', 'ARCHITECTURE.rst',
  'CONTRIBUTING.md', 'CONTRIBUTING.rst',
  'CHANGELOG.md', 'CHANGELOG.rst',
];

const PRIORITY_MANIFESTS = [
  'package.json', 'requirements.txt', 'Pipfile', 'pyproject.toml',
  'go.mod', 'Cargo.toml', 'pom.xml', 'build.gradle',
  'Gemfile', 'composer.json',
];

const LEGACY_FILES = [
  '.docs/product.md',
  '.docs/tech-stack.md',
];

const LEGACY_DIRS = ['docs/agents'];

// ─── File tree scanning ───────────────────────────────────────────────────────

async function walkDir(dir: string, skip = new Set<string>()): Promise<string[]> {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (skip.has(entry)) continue;
    const abs = path.join(dir, entry);
    const stat = await fs.stat(abs).catch(() => null);
    if (!stat) continue;
    if (stat.isDirectory()) {
      const sub = await walkDir(abs, skip);
      results.push(...sub);
    } else {
      results.push(abs);
    }
  }
  return results;
}

async function listRootEntries(projectPath: string): Promise<{ files: string[]; dirs: string[] }> {
  const entries = await fs.readdir(projectPath);
  const files: string[] = [];
  const dirs: string[] = [];
  for (const e of entries) {
    const abs = path.join(projectPath, e);
    const stat = await fs.stat(abs).catch(() => null);
    if (!stat) continue;
    if (stat.isDirectory()) dirs.push(e);
    else files.push(e);
  }
  return { files, dirs };
}

// ─── STRUCTURE_MAP builder ────────────────────────────────────────────────────

async function buildStructureMap(projectPath: string): Promise<StructureMap> {
  const map: StructureMap = {
    root_files: [],
    doc_files: [],
    agent_context: [],
    config_files: [],
    source_dirs: [],
    test_dirs: [],
    infra_dirs: [],
    data_dirs: [],
    unknown_dirs: [],
  };

  const { files, dirs } = await listRootEntries(projectPath);

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (AGENT_CONTEXT_FILES.has(file)) {
      map.agent_context.push(file);
    } else if (CONFIG_FILE_NAMES.has(file) || (CONFIG_FILE_EXTS.has(ext) && !MANIFEST_FILE_NAMES.has(file))) {
      map.config_files.push(file);
    } else {
      map.root_files.push(file);
    }
  }

  // Check sub-paths for agent context files like .claude/CLAUDE.md
  for (const agentPath of AGENT_CONTEXT_PATHS) {
    const abs = path.join(projectPath, agentPath);
    const exists = await fs.access(abs).then(() => true).catch(() => false);
    if (exists) map.agent_context.push(agentPath);
  }

  for (const dir of dirs) {
    const lc = dir.toLowerCase();
    if (TEST_DIR_NAMES.has(lc) || lc.startsWith('test') || lc.endsWith('test') || lc.endsWith('tests')) {
      map.test_dirs.push(dir);
    } else if (SOURCE_DIR_NAMES.has(lc)) {
      map.source_dirs.push(dir);
    } else if (INFRA_DIR_NAMES.has(lc) || INFRA_DIR_NAMES.has(dir)) {
      map.infra_dirs.push(dir);
    } else if (DATA_DIR_NAMES.has(lc)) {
      map.data_dirs.push(dir);
    } else if (DOC_DIR_NAMES.has(lc)) {
      map.doc_files.push(dir);
    } else {
      map.unknown_dirs.push(dir);
    }
  }

  return map;
}

// ─── File reading ─────────────────────────────────────────────────────────────

function extractKeyFacts(content: string, filePath: string, maxLines = 60): string[] {
  const lines = content.split('\n').slice(0, maxLines);
  const facts: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Extract headings
    if (trimmed.startsWith('#')) {
      facts.push(trimmed.replace(/^#+\s*/, '').trim());
      continue;
    }

    // Extract key-value pairs from manifests
    if (filePath.endsWith('package.json') || filePath.endsWith('pyproject.toml')) {
      try {
        const json = JSON.parse(content);
        if (json.name) facts.push(`name: ${json.name}`);
        if (json.description) facts.push(`description: ${json.description}`);
        if (json.version) facts.push(`version: ${json.version}`);
        const deps = { ...(json.dependencies || {}), ...(json.devDependencies || {}) };
        const depKeys = Object.keys(deps).slice(0, 5);
        if (depKeys.length) facts.push(`deps: ${depKeys.join(', ')}`);
        break;
      } catch {
        // fall through
      }
    }

    // Extract conventions from agent context files
    if (AGENT_CONTEXT_FILES.has(path.basename(filePath))) {
      if (trimmed.length > 10 && trimmed.length < 200) {
        facts.push(trimmed);
      }
    }
  }

  return facts.slice(0, 10);
}

async function buildReadingLog(projectPath: string, structureMap: StructureMap): Promise<ReadingLogEntry[]> {
  const log: ReadingLogEntry[] = [];

  // Priority 1: README, ARCHITECTURE, CONTRIBUTING, CHANGELOG
  for (const filename of PRIORITY_READ_FILES) {
    const filePath = path.join(projectPath, filename);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      log.push({
        file: filename,
        status: 'read',
        source_type: 'doc',
        key_facts: extractKeyFacts(content, filename),
      });
    } catch {
      log.push({ file: filename, status: 'not_found', source_type: 'doc', key_facts: [] });
    }
  }

  // Priority 2: docs/ index
  for (const docDir of structureMap.doc_files) {
    const indexPath = path.join(projectPath, docDir, 'index.md');
    try {
      const content = await fs.readFile(indexPath, 'utf8');
      log.push({
        file: `${docDir}/index.md`,
        status: 'read',
        source_type: 'doc',
        key_facts: extractKeyFacts(content, 'index.md'),
      });
    } catch {
      // skip
    }
  }

  // Priority 3: agent context files
  for (const agentFile of structureMap.agent_context) {
    const filePath = path.join(projectPath, agentFile);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      log.push({
        file: agentFile,
        status: 'read',
        source_type: 'agent_context',
        key_facts: extractKeyFacts(content, agentFile),
      });
    } catch {
      log.push({ file: agentFile, status: 'not_found', source_type: 'agent_context', key_facts: [] });
    }
  }

  // Priority 4: package manifests
  for (const manifest of PRIORITY_MANIFESTS) {
    const filePath = path.join(projectPath, manifest);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      log.push({
        file: manifest,
        status: 'read',
        source_type: 'manifest',
        key_facts: extractKeyFacts(content, manifest),
      });
    } catch {
      // skip missing manifests silently
    }
  }

  // Priority 5: source directory READMEs
  for (const srcDir of structureMap.source_dirs) {
    const readmePath = path.join(projectPath, srcDir, 'README.md');
    try {
      const content = await fs.readFile(readmePath, 'utf8');
      log.push({
        file: `${srcDir}/README.md`,
        status: 'read',
        source_type: 'source_readme',
        key_facts: extractKeyFacts(content, 'README.md'),
      });
    } catch {
      // skip
    }
  }

  return log;
}

// ─── Draft context builder ────────────────────────────────────────────────────

function buildDraftContext(structureMap: StructureMap, readingLog: ReadingLogEntry[]): string {
  const lines: string[] = ['# Project Context (Draft)', ''];

  const readmeEntry = readingLog.find(e => e.file === 'README.md' && e.status === 'read');
  if (readmeEntry && readmeEntry.key_facts.length > 0) {
    lines.push('## Overview');
    lines.push(readmeEntry.key_facts[0]);
    lines.push('');
  }

  const pkgEntry = readingLog.find(e => e.file === 'package.json' && e.status === 'read');
  if (pkgEntry && pkgEntry.key_facts.length > 0) {
    lines.push('## Package Info');
    lines.push(...pkgEntry.key_facts.map(f => `- ${f}`));
    lines.push('');
  }

  if (structureMap.source_dirs.length > 0) {
    lines.push('## Source');
    lines.push(structureMap.source_dirs.join(', '));
    lines.push('');
  }

  if (structureMap.agent_context.length > 0) {
    lines.push('## Agent Context Files');
    lines.push(structureMap.agent_context.join(', '));
    lines.push('');
  }

  return lines.join('\n');
}

function buildQuestionQueue(structureMap: StructureMap, readingLog: ReadingLogEntry[]): string[] {
  const questions: string[] = [];

  const hasReadme = readingLog.some(e => e.file === 'README.md' && e.status === 'read');
  if (!hasReadme) {
    questions.push('What is the purpose of this project?');
  }

  if (structureMap.source_dirs.length === 0 && structureMap.unknown_dirs.length === 0) {
    questions.push('Where is the primary source code located?');
  }

  const hasManifest = readingLog.some(
    e => PRIORITY_MANIFESTS.includes(e.file) && e.status === 'read'
  );
  if (!hasManifest) {
    questions.push('What language/framework does this project use?');
  }

  return questions;
}

// ─── Legacy detection ─────────────────────────────────────────────────────────

async function detectLegacy(projectPath: string): Promise<LegacyDetected | undefined> {
  const foundFiles: string[] = [];

  for (const legacyFile of LEGACY_FILES) {
    const abs = path.join(projectPath, legacyFile);
    const exists = await fs.access(abs).then(() => true).catch(() => false);
    if (exists) foundFiles.push(legacyFile);
  }

  for (const legacyDir of LEGACY_DIRS) {
    const abs = path.join(projectPath, legacyDir);
    const stat = await fs.stat(abs).catch(() => null);
    if (stat?.isDirectory()) foundFiles.push(legacyDir);
  }

  if (foundFiles.length === 0) return undefined;

  return {
    files: foundFiles,
    migrationInstructions:
      'Legacy context files detected. Run `kit_setup({ action: "start" })` to migrate to `.agents/context/`. ' +
      'Old files at `.docs/` and `docs/agents/` can be removed after migration.',
  };
}

// ─── Frontmatter helpers ──────────────────────────────────────────────────────

function serializeFrontmatter(data: Record<string, unknown>): string {
  const lines = ['---'];
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, unknown> = {};
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of match[1].split('\n')) {
    const arrayItem = line.match(/^  - (.+)/);
    if (arrayItem && currentKey && currentArray) {
      currentArray.push(arrayItem[1]);
      continue;
    }
    const kv = line.match(/^(\w+): (.+)/);
    if (kv) {
      currentKey = kv[1];
      currentArray = null;
      result[kv[1]] = kv[2];
    }
    const arrayStart = line.match(/^(\w+):$/);
    if (arrayStart) {
      currentKey = arrayStart[1];
      currentArray = [];
      result[currentKey] = currentArray;
    }
  }
  return result;
}

// ─── File tree snapshot ───────────────────────────────────────────────────────

const SKIP_DIRS = new Set(['.git', 'node_modules', '.agents']);

async function snapshotFileTree(projectPath: string): Promise<string[]> {
  const allFiles = await walkDir(projectPath, SKIP_DIRS);
  return allFiles.map(f => path.relative(projectPath, f)).sort();
}

// ─── KitSetupOrchestrator ─────────────────────────────────────────────────────

export class KitSetupOrchestrator {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = path.resolve(projectPath);
  }

  async start(): Promise<StartResult> {
    const structureMap = await buildStructureMap(this.projectPath);
    const readingLog = await buildReadingLog(this.projectPath, structureMap);
    const readAt = new Date().toISOString();
    const draftContext = buildDraftContext(structureMap, readingLog);
    const questionQueue = buildQuestionQueue(structureMap, readingLog);
    const needsClarification = questionQueue.length > 0;
    const legacyDetected = await detectLegacy(this.projectPath);

    return {
      structureMap,
      readingLog,
      readAt,
      draftContext,
      questionQueue,
      needsClarification,
      ...(legacyDetected ? { legacyDetected } : {}),
    };
  }

  async resume(options: ResumeOptions): Promise<ResumeResult> {
    const { startResult } = options;
    const contextDir = path.join(this.projectPath, '.agents', 'context');
    const modulesDir = path.join(contextDir, 'modules');

    await fs.mkdir(modulesDir, { recursive: true });

    const filesWritten: string[] = [];
    const generatedDate = new Date().toISOString();

    // Phase 5: collect snapshot for status tracking
    const fileSnapshot = await snapshotFileTree(this.projectPath);

    // Write project.md
    const frontmatter = serializeFrontmatter({
      generatedDate,
      projectPath: this.projectPath,
      fileSnapshot,
    });
    const projectMdContent = [
      frontmatter,
      '',
      startResult.draftContext,
    ].join('\n');

    const projectMdPath = path.join(contextDir, 'project.md');
    await fs.writeFile(projectMdPath, projectMdContent, 'utf8');
    filesWritten.push('.agents/context/project.md');

    // Write INDEX.md
    const indexContent = [
      '# Context Index',
      '',
      `Generated: ${generatedDate}`,
      '',
      '## Files',
      '- [project.md](project.md) — Main project context',
      '',
      '## Modules',
      ...startResult.structureMap.source_dirs.map(
        d => `- [modules/${d}.md](modules/${d}.md) — ${d} module`
      ),
    ].join('\n');

    const indexPath = path.join(contextDir, 'INDEX.md');
    await fs.writeFile(indexPath, indexContent, 'utf8');
    filesWritten.push('.agents/context/INDEX.md');

    // Write module stubs for source dirs
    for (const srcDir of startResult.structureMap.source_dirs) {
      const modulePath = path.join(modulesDir, `${srcDir}.md`);
      const moduleContent = [
        `# ${srcDir} Module`,
        '',
        `Source directory: \`${srcDir}/\``,
        '',
        '_Auto-generated stub. Update with module-specific context._',
      ].join('\n');
      await fs.writeFile(modulePath, moduleContent, 'utf8');
      filesWritten.push(`.agents/context/modules/${srcDir}.md`);
    }

    // Phase 6: write integrations.json
    await this._writeIntegrations(contextDir, startResult.structureMap, startResult.readingLog, startResult.readAt);
    filesWritten.push('.agents/context/integrations.json');

    // Phase 7: completion summary
    const summary = [
      `Context setup complete. ${filesWritten.length} file(s) written to .agents/context/.`,
      `Generated: ${generatedDate}`,
      startResult.legacyDetected
        ? `⚠️  Legacy files detected: ${startResult.legacyDetected.files.join(', ')}`
        : '',
    ].filter(Boolean).join('\n');

    return { summary, filesWritten };
  }

  private async _writeIntegrations(
    contextDir: string,
    structureMap: StructureMap,
    readingLog: ReadingLogEntry[],
    readAt: string,
  ): Promise<void> {
    const integrationsPath = path.join(contextDir, 'integrations.json');
    const lastRead = readAt;
    const integrations: Record<string, {
      agentFile: string;
      lastRead: string;
      extractedFacts: string[];
      pointsTo: string;
    }> = {};

    for (const agentFile of structureMap.agent_context) {
      const logEntry = readingLog.find(e => e.file === agentFile && e.source_type === 'agent_context');
      integrations[agentFile] = {
        agentFile,
        lastRead,
        extractedFacts: logEntry?.key_facts ?? [],
        pointsTo: '.agents/context/project.md',
      };
    }

    await fs.writeFile(integrationsPath, JSON.stringify(integrations, null, 2), 'utf8');
  }

  async status(): Promise<StatusResult> {
    const projectMdPath = path.join(this.projectPath, '.agents', 'context', 'project.md');

    let content: string;
    try {
      content = await fs.readFile(projectMdPath, 'utf8');
    } catch {
      return { exists: false, newFiles: [], deletedFiles: [], modifiedFiles: [], staleModules: [] };
    }

    const frontmatter = parseFrontmatter(content);
    const generatedDate = frontmatter.generatedDate as string | undefined;
    const storedSnapshot = (frontmatter.fileSnapshot as string[]) ?? [];

    // Get current file tree
    const currentSnapshot = await snapshotFileTree(this.projectPath);
    const storedSet = new Set(storedSnapshot);
    const currentSet = new Set(currentSnapshot);

    const newFiles = currentSnapshot.filter(f => !storedSet.has(f));
    const deletedFiles = storedSnapshot.filter(f => !currentSet.has(f));

    // modifiedFiles: files in both sets but with different mtime (approximate: just files present in both)
    // For simplicity, we report no modifications — a full implementation would store mtimes
    const modifiedFiles: string[] = [];

    // staleModules: modules that have new/deleted files in their directories
    const staleModules: string[] = [];
    const allChanged = [...newFiles, ...deletedFiles];
    const moduleDir = path.join('.agents', 'context', 'modules');
    const modulesExist = await fs.readdir(path.join(this.projectPath, moduleDir)).catch(() => [] as string[]);
    for (const modFile of modulesExist) {
      if (!modFile.endsWith('.md')) continue;
      const modName = modFile.replace(/\.md$/, '');
      if (allChanged.some(f => f.startsWith(`${modName}/`))) {
        staleModules.push(modName);
      }
    }

    return { exists: true, generatedDate, newFiles, deletedFiles, modifiedFiles, staleModules };
  }
}
