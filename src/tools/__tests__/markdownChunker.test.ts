import { describe, it, expect } from 'vitest';
import { chunkMarkdown } from '../markdownChunker.js';

describe('chunkMarkdown', () => {
  it('returns a single root chunk for file with no headings', () => {
    const md = 'Just some plain text\nwith multiple lines.';
    const chunks = chunkMarkdown(md, 'agents/coder.md', 'agent');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].headingPath).toBe('agents/coder.md');
    expect(chunks[0].content).toBe(md);
  });

  it('splits on H1 headings', () => {
    const md = '# Intro\nContent A\n# Usage\nContent B';
    const chunks = chunkMarkdown(md, 'agents/coder.md', 'agent');
    expect(chunks).toHaveLength(2);
    expect(chunks[0].headingPath).toBe('Intro');
    expect(chunks[0].content).toContain('Content A');
    expect(chunks[1].headingPath).toBe('Usage');
    expect(chunks[1].content).toContain('Content B');
  });

  it('builds nested heading paths', () => {
    const md = '# Parent\n## Child\nContent\n## Child2\nMore';
    const chunks = chunkMarkdown(md, 'skills/tech/react/SKILL.md', 'skill');
    expect(chunks).toHaveLength(2);
    expect(chunks[0].headingPath).toBe('Parent > Child');
    expect(chunks[1].headingPath).toBe('Parent > Child2');
  });

  it('includes sourceFile and sourceType metadata', () => {
    const md = '# Section\nsome text';
    const chunks = chunkMarkdown(md, 'agents/planner.md', 'agent');
    expect(chunks[0].sourceFile).toBe('agents/planner.md');
    expect(chunks[0].sourceType).toBe('agent');
  });

  it('skips empty chunks (heading with no text body)', () => {
    const md = '# Empty\n# HasContent\nsome text';
    const chunks = chunkMarkdown(md, 'test.md', 'system');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].headingPath).toBe('HasContent');
  });

  it('generates stable deterministic ids', () => {
    const md = '# Section\ntext';
    const a = chunkMarkdown(md, 'agents/coder.md', 'agent');
    const b = chunkMarkdown(md, 'agents/coder.md', 'agent');
    expect(a[0].id).toBe(b[0].id);
  });

  it('generates different ids for different source files', () => {
    const md = '# Section\ntext';
    const a = chunkMarkdown(md, 'agents/coder.md', 'agent');
    const b = chunkMarkdown(md, 'agents/planner.md', 'agent');
    expect(a[0].id).not.toBe(b[0].id);
  });
});
