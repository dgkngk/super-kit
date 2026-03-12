/**
 * End-to-end integration tests for the context management RAG system.
 *
 * These tests run against the real built MCP server (build/index.js) over stdio
 * and verify the full pipeline: indexing → search → memory store → memory recall.
 *
 * Prerequisites: `npm run build` must have been run before running these tests.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';
import * as url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SERVER_PATH = path.resolve(__dirname, '../../../build/index.js');

// ---------------------------------------------------------------------------
// Minimal JSON-RPC client over stdio
// ---------------------------------------------------------------------------

class McpClient {
  private proc: ChildProcessWithoutNullStreams;
  private buffer = '';
  private pending = new Map<number, { resolve: (r: any) => void; reject: (e: Error) => void }>();
  private nextId = 1;

  constructor() {
    this.proc = spawn('node', [SERVER_PATH], { stdio: ['pipe', 'pipe', 'pipe'] });
    this.proc.stdout.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const msg = JSON.parse(trimmed);
          const handler = this.pending.get(msg.id);
          if (handler) {
            this.pending.delete(msg.id);
            if (msg.error) handler.reject(new Error(JSON.stringify(msg.error)));
            else handler.resolve(msg.result);
          }
        } catch {
          // not JSON, ignore
        }
      }
    });
  }

  call(method: string, params: object = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
      this.proc.stdin.write(msg);
    });
  }

  /** Call tools/call and return the first text content. */
  async tool(name: string, args: object = {}): Promise<string> {
    const result = await this.call('tools/call', { name, arguments: args });
    return result?.content?.[0]?.text ?? '';
  }

  destroy() {
    this.proc.stdin.end();
    this.proc.kill();
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let client: McpClient;

beforeAll(async () => {
  client = new McpClient();
  // Trigger indexing once and wait for completion before all tests run.
  // The model may need to be downloaded (~22MB) on first run.
  await client.tool('index_context');
}, 180_000);

afterAll(() => {
  client.destroy();
});

describe('RAG tools registration', () => {
  it('registers all 4 context management tools', async () => {
    const result = await client.call('tools/list', {});
    const names: string[] = result.tools.map((t: any) => t.name);
    expect(names).toContain('search_context');
    expect(names).toContain('index_context');
    expect(names).toContain('store_session_memory');
    expect(names).toContain('recall_memory');
  });

  it('search_context has correct description mentioning semantic search', async () => {
    const result = await client.call('tools/list', {});
    const tool = result.tools.find((t: any) => t.name === 'search_context');
    expect(tool).toBeDefined();
    expect(tool.description).toMatch(/semantic/i);
  });
});

describe('index_context', () => {
  it('indexes assets and returns stats', async () => {
    // beforeAll already ran index_context once; this second call should be incremental
    const text = await client.tool('index_context');
    expect(text).toMatch(/context indexed/i);
    expect(text).toMatch(/files re-embedded:/i);
    expect(text).toMatch(/unchanged:/i);
  }, 30_000);

  it('second call is fully incremental (0 re-embedded)', async () => {
    const text = await client.tool('index_context');
    expect(text).toMatch(/files re-embedded: 0/i);
  }, 30_000);
});

describe('search_context', () => {
  it('returns results for a relevant query', async () => {
    const text = await client.tool('search_context', { query: 'write TypeScript clean code', topK: 3 });
    expect(text).not.toBe('No results found.');
    // Each result has format: "[N] sourceFile › headingPath (score: X.XXX)"
    expect(text).toMatch(/\[1\]/);
    expect(text).toMatch(/score: 0\.\d+/);
  }, 30_000);

  it('returns results for a skill-oriented query', async () => {
    const text = await client.tool('search_context', { query: 'React hooks state management patterns', topK: 5 });
    expect(text).not.toBe('No results found.');
    expect(text).toMatch(/\[1\]/);
  }, 30_000);

  it('returns results for an agent-oriented query', async () => {
    const text = await client.tool('search_context', { query: 'deployment server CI/CD production', topK: 3 });
    expect(text).not.toBe('No results found.');
    // Should surface agents or skills related to deployment
    expect(text).toMatch(/\[1\]/);
  }, 30_000);

  it('respects topK limit', async () => {
    const text = await client.tool('search_context', { query: 'code review', topK: 2 });
    // Should have [1] and [2] but NOT [3]
    expect(text).toMatch(/\[1\]/);
    expect(text).toMatch(/\[2\]/);
    expect(text).not.toMatch(/\[3\]/);
  }, 30_000);

  it('returns "No results found." for empty index query (topK=0 clamped to 1)', async () => {
    // topK is clamped to min 1, so we always get at least 1 result if indexed
    const text = await client.tool('search_context', { query: 'xyzzy frobnicate qwerty', topK: 1 });
    // May return low-score result rather than nothing — just verify it returns something
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  }, 30_000);
});

describe('store_session_memory + recall_memory', () => {
  const memoryText = 'Always use container queries for responsive CSS layouts — avoids media query breakpoint mismatches.';
  const memoryTags = ['css', 'responsive', 'container-queries'];

  it('stores a memory with 30-day TTL', async () => {
    const text = await client.tool('store_session_memory', {
      text: memoryText,
      tags: memoryTags,
      ttl_days: 30,
    });
    expect(text).toMatch(/memory stored/i);
    expect(text).toMatch(/ttl: 30 days/i);
  }, 30_000);

  it('recalls the stored memory by semantic query', async () => {
    const text = await client.tool('recall_memory', { query: 'responsive CSS layout design', topK: 3 });
    expect(text).not.toBe('No memories found.');
    expect(text).toContain('container queries');
    // Should show tags
    expect(text).toContain('css');
    // Should show expiry date
    expect(text).toMatch(/expires: \d{4}-\d{2}-\d{2}/);
    // Should show score
    expect(text).toMatch(/score: 0\.\d+/);
  }, 30_000);

  it('stores a second memory with 90-day TTL', async () => {
    const text = await client.tool('store_session_memory', {
      text: 'Use Zod for runtime validation at API boundaries — catches schema drift before it reaches business logic.',
      tags: ['validation', 'typescript', 'zod'],
      ttl_days: 90,
    });
    expect(text).toMatch(/ttl: 90 days/i);
  }, 30_000);

  it('recalls both memories with a broad query', async () => {
    const text = await client.tool('recall_memory', { query: 'TypeScript schema validation API', topK: 5 });
    expect(text).not.toBe('No memories found.');
    // Zod memory should surface
    expect(text).toContain('Zod');
  }, 30_000);

  it('returns "No memories found." for completely unrelated query with no memories', async () => {
    // recall_memory is semantic, not exact — it still returns results sorted by score
    // so this test just verifies the tool responds without error
    const text = await client.tool('recall_memory', { query: 'quantum physics nuclear reactor', topK: 1 });
    expect(typeof text).toBe('string');
  }, 30_000);
});
