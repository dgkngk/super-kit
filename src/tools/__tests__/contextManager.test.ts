import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock the embedder so tests don't download 22MB models
vi.mock('../embedder.js', () => ({
  embed: async (texts: string[]) => texts.map((_, i) => Array(384).fill(i * 0.01)),
  embedOne: async (_text: string) => Array(384).fill(0.5),
}));

import { ContextManager } from '../contextManager.js';

describe('ContextManager', () => {
  let tmpDir: string;
  let assetsDir: string;
  let manager: ContextManager;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cm-test-'));
    assetsDir = path.join(tmpDir, 'assets');
    await fs.mkdir(path.join(assetsDir, 'agents'), { recursive: true });
    await fs.mkdir(path.join(assetsDir, 'skills', 'tech', 'react'), { recursive: true });
    await fs.mkdir(path.join(assetsDir, 'skills', 'workflows'), { recursive: true });

    // Write test markdown files
    await fs.writeFile(
      path.join(assetsDir, 'agents', 'coder.md'),
      '# Coder\n## Capabilities\nWrite clean TypeScript\n## Limitations\nNo UI design'
    );
    await fs.writeFile(
      path.join(assetsDir, 'skills', 'tech', 'react', 'SKILL.md'),
      '# React\n## Hooks\nUse useState and useEffect\n## Patterns\nPrefer functional components'
    );

    manager = new ContextManager({ assetsDir, storeDir: path.join(tmpDir, 'store') });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('indexes all markdown files and marks ready', async () => {
    await manager.indexAll();
    expect(manager.isReady()).toBe(true);
  });

  it('searchContext returns ranked chunks', async () => {
    await manager.indexAll();
    const results = await manager.searchContext('TypeScript code writing', 3);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('headingPath');
    expect(results[0]).toHaveProperty('sourceFile');
    expect(results[0]).toHaveProperty('score');
    expect(results[0]).toHaveProperty('content');
  });

  it('searchContext returns "indexing" message when not ready', async () => {
    const results = await manager.searchContext('anything', 3);
    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('indexing');
  });

  it('storeMemory persists and recallMemory retrieves it', async () => {
    await manager.indexAll();
    await manager.storeMemory('Always use container queries for responsive CSS', ['css', 'responsive'], 30);
    const results = await manager.recallMemory('responsive layout CSS', 3);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].text).toBe('Always use container queries for responsive CSS');
  });

  it('respects TTL options (30 or 90 days only)', async () => {
    await manager.indexAll();
    await expect(manager.storeMemory('test', [], 30)).resolves.not.toThrow();
    await expect(manager.storeMemory('test', [], 90)).resolves.not.toThrow();
    await expect(manager.storeMemory('test', [], 60)).rejects.toThrow('TTL must be 30 or 90 days');
  });

  it('indexAll is incremental on second run', async () => {
    await manager.indexAll();
    const spy = vi.spyOn(manager as any, 'indexFiles');
    await manager.indexAll();
    // Second run: no files changed, nothing re-embedded
    expect(spy).toHaveBeenCalledWith([]);
    spy.mockRestore();
  });
});
