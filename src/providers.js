/**
 * Server-side provider adapter. Add future paid providers here, never in browser code.
 * A provider must return a ReadableStream of SSE events compatible with parseSSEEvent.
 * Only Cloudflare's Workers AI binding is enabled in this initial release.
 */
export const cloudflareProvider = {
  id:'cloudflare-workers-ai',
  async generate(env, {model, messages}) {
    if (!env.AI) throw new Error('Cloudflare AI binding missing');
    return env.AI.run(model, {messages, stream:true, max_tokens:2048});
  },
};
