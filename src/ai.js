import { systemPrompt, compactHistory, chooseModel } from './lib.js';
import {cloudflareProvider} from './providers.js';

export async function beginInference(env, kind, projectInstructions, history, preferredModel) {
  const model = chooseModel(preferredModel);
  const messages = [
    {role:'system', content:systemPrompt(kind, projectInstructions)},
    ...compactHistory(history),
  ];
  const result = await cloudflareProvider.generate(env, {model,messages});
  if (!result || typeof result.getReader !== 'function') throw new Error('AI provider did not return a stream');
  return {model, stream:result};
}

export function parseSSEEvent(frame) {
  const data = frame.split(/\r?\n/).filter(x => x.startsWith('data:')).map(x=>x.slice(5).trimStart()).join('\n');
  if (!data || data === '[DONE]') return {done: data === '[DONE]'};
  try {
    const value = JSON.parse(data);
    if (value.error) return {error: typeof value.error === 'string' ? value.error : 'AI streaming error'};
    // Cloudflare Workers AI emits incremental response chunks under `response`.
    return {delta:typeof value.response === 'string' ? value.response : '', usage: value.usage || null};
  } catch { return {}; }
}

export function streamAIToClient(providerStream, onComplete) {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const wire = (event, data) => enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  return new ReadableStream({
    async start(controller) {
      const reader = providerStream.getReader();
      let dataBuffer = '';
      let answer = '';
      let usage = null;
      let interrupted = false;
      try {
        while (true) {
          const {value, done} = await reader.read();
          if (done) break;
          dataBuffer += dec.decode(value, {stream:true});
          dataBuffer = dataBuffer.replace(/\r\n/g, '\n');
          if (dataBuffer.length > 100000) throw new Error('AI stream frame exceeded limit');
          let separator;
          while ((separator = dataBuffer.indexOf('\n\n')) !== -1) {
            const frame = dataBuffer.slice(0, separator);
            dataBuffer = dataBuffer.slice(separator + 2);
            const event = parseSSEEvent(frame);
            if (event.error) throw new Error(event.error);
            if (event.usage) usage = event.usage;
            if (event.delta) {
              answer += event.delta;
              if (answer.length > 60000) throw new Error('Response size limit reached');
              controller.enqueue(wire('delta', {text:event.delta}));
            }
          }
        }
      } catch (error) {
        interrupted = true;
        controller.enqueue(wire('error', {message: error instanceof Error ? error.message : 'AI connection interrupted'}));
      } finally {
        try {
          await onComplete({answer, interrupted, usage});
          if (!interrupted && !answer.trim()) controller.enqueue(wire('error', {message:'AI returned an empty response. Retry this message.'}));
          else if (!interrupted) controller.enqueue(wire('done', {}));
        } catch (error) {
          controller.enqueue(wire('error', {message: 'Could not persist response. Please retry.'}));
        }
        controller.close();
        try { reader.releaseLock(); } catch {}
      }
    },
    cancel() { // Client may disconnect; the server stream closes and onComplete persists partial output if feasible.
    },
  });
}
