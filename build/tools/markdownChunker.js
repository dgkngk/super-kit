import { createHash } from 'crypto';
/**
 * Splits a markdown document into chunks at heading boundaries.
 * Each chunk contains the heading path (e.g. "Parent > Child") and the
 * text content under that heading (exclusive of sub-headings' text).
 */
export function chunkMarkdown(markdown, sourceFile, sourceType) {
    const lines = markdown.split('\n');
    const chunks = [];
    // headingStack[i] is the text of the heading at level (i+1)
    const headingStack = [];
    let buffer = [];
    const flushBuffer = (path) => {
        const text = buffer.join('\n').trim();
        buffer = [];
        if (!text)
            return;
        const id = createHash('sha1')
            .update(`${sourceFile}::${path}`)
            .digest('hex')
            .slice(0, 16);
        chunks.push({ id, sourceFile, sourceType, headingPath: path, content: text });
    };
    const getPath = () => headingStack.length > 0 ? headingStack.join(' > ') : sourceFile;
    for (const line of lines) {
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            // Flush whatever was accumulated under the previous heading
            flushBuffer(getPath());
            const level = headingMatch[1].length;
            const title = headingMatch[2].trim();
            // Trim the stack to the parent level and push new heading
            headingStack.splice(level - 1);
            headingStack[level - 1] = title;
        }
        else {
            buffer.push(line);
        }
    }
    // Flush the last section
    flushBuffer(getPath());
    return chunks;
}
