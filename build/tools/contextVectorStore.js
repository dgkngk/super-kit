import * as fs from 'fs/promises';
import * as path from 'path';
function cosine(a, b) {
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
    storeDir;
    chunksPath;
    memoriesPath;
    chunksCache = null;
    memoriesCache = null;
    constructor(storeDir) {
        this.storeDir = storeDir;
        this.chunksPath = path.join(storeDir, 'context-index.json');
        this.memoriesPath = path.join(storeDir, 'memory.json');
    }
    async loadChunks() {
        if (this.chunksCache)
            return this.chunksCache;
        try {
            const raw = await fs.readFile(this.chunksPath, 'utf-8');
            this.chunksCache = JSON.parse(raw);
        }
        catch {
            this.chunksCache = [];
        }
        return this.chunksCache;
    }
    async saveChunks(chunks) {
        this.chunksCache = chunks;
        await fs.mkdir(this.storeDir, { recursive: true });
        await fs.writeFile(this.chunksPath, JSON.stringify(chunks), 'utf-8');
    }
    async loadMemories() {
        if (this.memoriesCache)
            return this.memoriesCache;
        try {
            const raw = await fs.readFile(this.memoriesPath, 'utf-8');
            this.memoriesCache = JSON.parse(raw);
        }
        catch {
            this.memoriesCache = [];
        }
        return this.memoriesCache;
    }
    async saveMemories(memories) {
        this.memoriesCache = memories;
        await fs.mkdir(this.storeDir, { recursive: true });
        await fs.writeFile(this.memoriesPath, JSON.stringify(memories), 'utf-8');
    }
    /**
     * Upserts chunks. Existing chunks with the same id are replaced.
     */
    async upsertChunks(items) {
        const existing = await this.loadChunks();
        const byId = new Map(existing.map(c => [c.chunk.id, c]));
        for (const item of items)
            byId.set(item.chunk.id, item);
        await this.saveChunks(Array.from(byId.values()));
    }
    /**
     * Removes all chunks from the given source files and upserts the new ones.
     * Used during incremental re-indexing.
     */
    async replaceChunksForFiles(files, newChunks) {
        const existing = await this.loadChunks();
        const fileSet = new Set(files);
        const kept = existing.filter(c => !fileSet.has(c.chunk.sourceFile));
        await this.saveChunks([...kept, ...newChunks]);
    }
    async searchChunks(queryVector, topK) {
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
    async getStaleFiles(currentMtimes) {
        const all = await this.loadChunks();
        // Latest recorded mtime per source file
        const recorded = new Map();
        for (const c of all) {
            const prev = recorded.get(c.chunk.sourceFile) ?? 0;
            if (c.sourceMtime > prev)
                recorded.set(c.chunk.sourceFile, c.sourceMtime);
        }
        const stale = [];
        for (const [file, mtime] of Object.entries(currentMtimes)) {
            const prev = recorded.get(file);
            if (prev === undefined || prev !== mtime)
                stale.push(file);
        }
        return stale;
    }
    async upsertMemory(entry) {
        const all = await this.loadMemories();
        const idx = all.findIndex(m => m.id === entry.id);
        if (idx >= 0)
            all[idx] = entry;
        else
            all.push(entry);
        await this.saveMemories(all);
    }
    async searchMemory(queryVector, topK) {
        const all = await this.loadMemories();
        const now = Date.now();
        return all
            .filter(m => m.expiresAt > now)
            .map(entry => ({ entry, score: cosine(queryVector, entry.vector) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }
    async pruneExpiredMemories() {
        const all = await this.loadMemories();
        const now = Date.now();
        const live = all.filter(m => m.expiresAt > now);
        await this.saveMemories(live);
        return all.length - live.length;
    }
}
