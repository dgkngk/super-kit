import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { chunkMarkdown, type SourceType } from './markdownChunker.js';
import { embed, embedOne } from './embedder.js';
import { ContextVectorStore, type StoredChunk } from './contextVectorStore.js';

export interface SearchResult {
  sourceFile: string;
  sourceType: SourceType;
  headingPath: string;
  content: string;
  score: number;
}

export interface MemoryResult {
  text: string;
  tags: string[];
  score: number;
  createdAt: number;
  expiresAt: number;
}

export interface ContextManagerOptions {
  assetsDir: string;   // super-kit root (contains agents/, skills/ etc.)
  storeDir: string;    // where to write context-index.json / memory.json
}

type FileEntry = { relativePath: string; absolutePath: string; sourceType: SourceType; mtime: number };

const VALID_TTLS = new Set([30, 90]);

export class ContextManager {
  private store: ContextVectorStore;
  private ready = false;

  constructor(private opts: ContextManagerOptions) {
    this.store = new ContextVectorStore(opts.storeDir);
  }

  isReady(): boolean {
    return this.ready;
  }

  /** Scan agents/, skills/, and SUPERKIT.md; return all markdown entries with mtimes. */
  private async discoverFiles(): Promise<FileEntry[]> {
    const entries: FileEntry[] = [];
    const base = this.opts.assetsDir;

    const walk = async (dir: string, sourceType: SourceType) => {
      let items: string[];
      try { items = await fs.readdir(dir); } catch { return; }
      for (const item of items) {
        const abs = path.join(dir, item);
        const stat = await fs.stat(abs).catch(() => null);
        if (!stat) continue;
        if (stat.isDirectory()) {
          await walk(abs, sourceType);
        } else if (item.endsWith('.md')) {
          entries.push({
            relativePath: path.relative(base, abs).replace(/\\/g, '/'),
            absolutePath: abs,
            sourceType,
            mtime: stat.mtimeMs,
          });
        }
      }
    };

    await walk(path.join(base, 'agents'), 'agent');
    await walk(path.join(base, 'skills', 'tech'), 'skill');
    await walk(path.join(base, 'skills', 'meta'), 'skill');
    await walk(path.join(base, 'skills', 'workflows'), 'workflow');

    // SUPERKIT.md itself
    const superkitPath = path.join(base, 'SUPERKIT.md');
    const superkitStat = await fs.stat(superkitPath).catch(() => null);
    if (superkitStat) {
      entries.push({ relativePath: 'SUPERKIT.md', absolutePath: superkitPath, sourceType: 'system', mtime: superkitStat.mtimeMs });
    }

    return entries;
  }

  /** Re-embed and store the given file entries. */
  private async indexFiles(files: FileEntry[]): Promise<void> {
    if (files.length === 0) return;

    const allChunks: StoredChunk[] = [];
    const allTexts: string[] = [];
    const chunkMeta: { chunk: ReturnType<typeof chunkMarkdown>[0]; mtime: number }[] = [];

    for (const file of files) {
      const content = await fs.readFile(file.absolutePath, 'utf-8').catch(() => '');
      if (!content.trim()) continue;
      const chunks = chunkMarkdown(content, file.relativePath, file.sourceType);
      for (const chunk of chunks) {
        chunkMeta.push({ chunk, mtime: file.mtime });
        // Embed heading path + content for better semantic matching
        allTexts.push(`${chunk.headingPath}\n\n${chunk.content}`);
      }
    }

    if (allTexts.length === 0) return;

    const vectors = await embed(allTexts);
    for (let i = 0; i < chunkMeta.length; i++) {
      allChunks.push({ chunk: chunkMeta[i].chunk, vector: vectors[i], sourceMtime: chunkMeta[i].mtime });
    }

    const fileNames = files.map(f => f.relativePath);
    await this.store.replaceChunksForFiles(fileNames, allChunks);
  }

  /**
   * Index all markdown assets. Incremental: only re-indexes files whose mtime changed.
   * Safe to call multiple times.
   */
  async indexAll(): Promise<{ indexed: number; skipped: number }> {
    const discovered = await this.discoverFiles();
    const mtimeMap: Record<string, number> = {};
    for (const f of discovered) mtimeMap[f.relativePath] = f.mtime;

    const staleRelPaths = await this.store.getStaleFiles(mtimeMap);
    const staleSet = new Set(staleRelPaths);
    const toIndex = discovered.filter(f => staleSet.has(f.relativePath));

    await this.indexFiles(toIndex);
    this.ready = true;

    return { indexed: toIndex.length, skipped: discovered.length - toIndex.length };
  }

  async searchContext(query: string, topK = 5): Promise<SearchResult[]> {
    if (!this.ready) {
      return [{
        sourceFile: 'system',
        sourceType: 'system',
        headingPath: 'Status',
        content: 'Context indexing is in progress. Try again in a few seconds.',
        score: 0,
      }];
    }
    const vec = await embedOne(query);
    const hits = await this.store.searchChunks(vec, topK);
    return hits.map(h => ({
      sourceFile: h.chunk.sourceFile,
      sourceType: h.chunk.sourceType,
      headingPath: h.chunk.headingPath,
      content: h.chunk.content,
      score: h.score,
    }));
  }

  async storeMemory(text: string, tags: string[], ttlDays: number): Promise<void> {
    if (!VALID_TTLS.has(ttlDays)) throw new Error('TTL must be 30 or 90 days');
    const id = createHash('sha1').update(`${Date.now()}::${text}`).digest('hex').slice(0, 16);
    const vec = await embedOne(text);
    const now = Date.now();
    await this.store.upsertMemory({
      id,
      text,
      tags,
      vector: vec,
      createdAt: now,
      expiresAt: now + ttlDays * 24 * 60 * 60 * 1000,
    });
  }

  async recallMemory(query: string, topK = 5): Promise<MemoryResult[]> {
    const vec = await embedOne(query);
    const hits = await this.store.searchMemory(vec, topK);
    return hits.map(h => ({
      text: h.entry.text,
      tags: h.entry.tags,
      score: h.score,
      createdAt: h.entry.createdAt,
      expiresAt: h.entry.expiresAt,
    }));
  }

  async pruneMemories(): Promise<number> {
    return this.store.pruneExpiredMemories();
  }
}
