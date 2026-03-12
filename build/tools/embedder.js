import * as os from 'os';
import * as path from 'path';
// Lazily initialized pipeline — avoids blocking server startup
let pipelineInstance = null;
let loadingPromise = null;
async function getEmbedder() {
    if (pipelineInstance)
        return pipelineInstance;
    if (loadingPromise)
        return loadingPromise;
    loadingPromise = (async () => {
        // Dynamic import so the module loads lazily at runtime, not at parse time.
        // This prevents the 5-10s model load from blocking MCP server startup.
        const { pipeline, env } = await import('@huggingface/transformers');
        // Cache models in ~/.superkit/models to survive package updates
        env.cacheDir = path.join(os.homedir(), '.superkit', 'models');
        pipelineInstance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { device: 'cpu' });
        return pipelineInstance;
    })();
    return loadingPromise;
}
const BATCH_SIZE = 32;
/**
 * Embeds an array of texts using all-MiniLM-L6-v2 (384-dim).
 * Processes in batches of 32 to avoid OOM on large indexes.
 * Returns a parallel array of vectors.
 */
export async function embed(texts) {
    const extractor = await getEmbedder();
    const results = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE);
        const output = await extractor(batch, { pooling: 'mean', normalize: true });
        // output.data is a flat Float32Array; reshape into vectors of 384
        const dims = 384;
        for (let j = 0; j < batch.length; j++) {
            results.push(Array.from(output.data.slice(j * dims, (j + 1) * dims)));
        }
    }
    return results;
}
/** Embeds a single text. Convenience wrapper. */
export async function embedOne(text) {
    const [vec] = await embed([text]);
    return vec;
}
