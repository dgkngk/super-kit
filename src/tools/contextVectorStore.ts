import * as fs from 'fs/promises';
import * as path from 'path';
import type { MarkdownChunk } from './markdownChunker.js';

export interface StoredChunk {
  chunk: MarkdownChunk;
  vector: number[];
  sourceMtime: number;
}

export interface MemoryEntry {
  id: string;
  text: string;
  tags: string[];
  vector: number[];
  createdAt: number;
  expiresAt: number;
}

interface SearchResult<T> {
  entry: T;
  score: number;
}

interface ChunkSearchResult {
  chunk: MarkdownChunk;
  score: number;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export class ContextVectorStore {
  private chunksPath: string;
  private memoriesPath: string;
  private chunksCache: StoredChunk[] | null = null;
  private memoriesCache: MemoryEntry[] | null = null;

  constructor(private storeDir: string) {
    this.chunksPath = path.join(storeDir, 'context-index.json');
    this.memoriesPath = path.join(storeDir, 'memory.json');
  }

  private async loadChunks(): Promise<StoredChunk[]> {
    if (this.chunksCache) return this.chunksCache;
    try {
      const raw = await fs.readFile(this.chunksPath, 'utf-8');
      this.chunksCache = JSON.parse(raw) as StoredChunk[];
    } catch {
      this.chunksCache = [];
    }
    return this.chunksCache;
  }

  private async saveChunks(chunks: StoredChunk[]): Promise<void> {
    this.chunksCache = chunks;
    await fs.mkdir(this.storeDir, { recursive: true });
    await fs.writeFile(this.chunksPath, JSON.stringify(chunks), 'utf-8');
  }

  private async loadMemories(): Promise<MemoryEntry[]> {
    if (this.memoriesCache) return this.memoriesCache;
    try {
      const raw = await fs.readFile(this.memoriesPath, 'utf-8');
      this.memoriesCache = JSON.parse(raw) as MemoryEntry[];
    } catch {
      this.memoriesCache = [];
    }
    return this.memoriesCache;
  }

  private async saveMemories(memories: MemoryEntry[]): Promise<void> {
    this.memoriesCache = memories;
    await fs.mkdir(this.storeDir, { recursive: true });
    await fs.writeFile(this.memoriesPath, JSON.stringify(memories), 'utf-8');
  }

  /**
   * Upserts chunks. Existing chunks with the same id are replaced.
   */
  async upsertChunks(items: StoredChunk[]): Promise<void> {
    const existing = await this.loadChunks();
    const byId = new Map(existing.map(c => [c.chunk.id, c]));
    for (const item of items) byId.set(item.chunk.id, item);
    await this.saveChunks(Array.from(byId.values()));
  }

  /**
   * Removes all chunks from the given source files and upserts the new ones.
   * Used during incremental re-indexing.
   */
  async replaceChunksForFiles(files: string[], newChunks: StoredChunk[]): Promise<void> {
    const existing = await this.loadChunks();
    const fileSet = new Set(files);
    const kept = existing.filter(c => !fileSet.has(c.chunk.sourceFile));
    await this.saveChunks([...kept, ...newChunks]);
  }

  async searchChunks(queryVector: number[], topK: number): Promise<ChunkSearchResult[]> {
    const all = await this.loadChunks();
    return all
      .map(c => ({ chunk: c.chunk, score: cosine(queryVector, c.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Returns source files whose recorded mtime differs from the provided map,
   * plus files in the map that have no chunks recorded.
   */
  async getStaleFiles(currentMtimes: Record<string, number>): Promise<string[]> {
    const all = await this.loadChunks();
    // Latest recorded mtime per source file
    const recorded = new Map<string, number>();
    for (const c of all) {
      const prev = recorded.get(c.chunk.sourceFile) ?? 0;
      if (c.sourceMtime > prev) recorded.set(c.chunk.sourceFile, c.sourceMtime);
    }
    const stale: string[] = [];
    for (const [file, mtime] of Object.entries(currentMtimes)) {
      const prev = recorded.get(file);
      if (prev === undefined || prev !== mtime) stale.push(file);
    }
    return stale;
  }

  async upsertMemory(entry: MemoryEntry): Promise<void> {
    const all = await this.loadMemories();
    const idx = all.findIndex(m => m.id === entry.id);
    if (idx >= 0) all[idx] = entry;
    else all.push(entry);
    await this.saveMemories(all);
  }

  async searchMemory(queryVector: number[], topK: number): Promise<SearchResult<MemoryEntry>[]> {
    const all = await this.loadMemories();
    const now = Date.now();
    return all
      .filter(m => m.expiresAt > now)
      .map(entry => ({ entry, score: cosine(queryVector, entry.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async pruneExpiredMemories(): Promise<number> {
    const all = await this.loadMemories();
    const now = Date.now();
    const live = all.filter(m => m.expiresAt > now);
    await this.saveMemories(live);
    return all.length - live.length;
  }
}
