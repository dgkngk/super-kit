import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ContextVectorStore } from '../contextVectorStore.js';
import type { MarkdownChunk } from '../markdownChunker.js';

const make384 = (val: number) => Array(384).fill(val) as number[];

describe('ContextVectorStore', () => {
  let tmpDir: string;
  let store: ContextVectorStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cvs-test-'));
    store = new ContextVectorStore(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('starts empty', async () => {
    const results = await store.searchChunks(make384(0.5), 5);
    expect(results).toHaveLength(0);
  });

  it('upserts and retrieves a chunk', async () => {
    const chunk: MarkdownChunk = {
      id: 'abc',
      sourceFile: 'agents/coder.md',
      sourceType: 'agent',
      headingPath: 'Capabilities',
      content: 'Write clean code',
    };
    await store.upsertChunks([{ chunk, vector: make384(1), sourceMtime: 1000 }]);
    const results = await store.searchChunks(make384(1), 5);
    expect(results).toHaveLength(1);
    expect(results[0].chunk.id).toBe('abc');
  });

  it('returns results sorted by score descending', async () => {
    const chunks = [
      { chunk: { id: 'a', sourceFile: 'f', sourceType: 'agent' as const, headingPath: 'A', content: 'A' }, vector: make384(1), sourceMtime: 0 },
      { chunk: { id: 'b', sourceFile: 'f', sourceType: 'agent' as const, headingPath: 'B', content: 'B' }, vector: make384(0), sourceMtime: 0 },
    ];
    await store.upsertChunks(chunks);
    const results = await store.searchChunks(make384(1), 5);
    expect(results[0].chunk.id).toBe('a');
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it('respects topK limit', async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      chunk: { id: `c${i}`, sourceFile: 'f', sourceType: 'agent' as const, headingPath: `H${i}`, content: 'x' },
      vector: make384(i / 10),
      sourceMtime: 0,
    }));
    await store.upsertChunks(items);
    const results = await store.searchChunks(make384(0.5), 3);
    expect(results).toHaveLength(3);
  });

  it('persists across store instances (disk roundtrip)', async () => {
    const chunk: MarkdownChunk = { id: 'disk1', sourceFile: 'f', sourceType: 'agent', headingPath: 'H', content: 'persisted' };
    await store.upsertChunks([{ chunk, vector: make384(0.7), sourceMtime: 0 }]);

    const store2 = new ContextVectorStore(tmpDir);
    const results = await store2.searchChunks(make384(0.7), 5);
    expect(results[0].chunk.id).toBe('disk1');
  });

  it('checks source file mtimes for incremental indexing', async () => {
    await store.upsertChunks([
      { chunk: { id: 'x', sourceFile: 'agents/scout.md', sourceType: 'agent', headingPath: 'H', content: 'c' }, vector: make384(0.5), sourceMtime: 1000 },
    ]);
    const stale = await store.getStaleFiles({ 'agents/scout.md': 2000, 'agents/new.md': 0 });
    expect(stale).toContain('agents/scout.md');  // mtime changed
    expect(stale).toContain('agents/new.md');    // new file not in index
  });

  it('does not mark unchanged files as stale', async () => {
    await store.upsertChunks([
      { chunk: { id: 'y', sourceFile: 'agents/scout.md', sourceType: 'agent', headingPath: 'H', content: 'c' }, vector: make384(0.5), sourceMtime: 1000 },
    ]);
    const stale = await store.getStaleFiles({ 'agents/scout.md': 1000 });
    expect(stale).toHaveLength(0);
  });

  it('stores and searches memories', async () => {
    const now = Date.now();
    await store.upsertMemory({ id: 'm1', text: 'Use container queries', tags: ['css'], vector: make384(0.8), createdAt: now, expiresAt: now + 86400000 * 30 });
    const results = await store.searchMemory(make384(0.8), 5);
    expect(results[0].entry.id).toBe('m1');
  });

  it('prunes expired memories', async () => {
    const past = Date.now() - 1000;
    await store.upsertMemory({ id: 'expired', text: 'Old memory', tags: [], vector: make384(0.5), createdAt: past - 1000, expiresAt: past });
    await store.pruneExpiredMemories();
    const results = await store.searchMemory(make384(0.5), 5);
    expect(results).toHaveLength(0);
  });
});
