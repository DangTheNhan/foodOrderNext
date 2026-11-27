import { assertLoopbackHost } from './config.js';
import { modelJsonSchema } from '@foodordernext/contracts';

export function aiConfig(env = process.env) {
  const provider = env.AI_PROVIDER || 'disabled';
  if (provider !== 'disabled' && provider !== 'ollama') throw new Error('AI_PROVIDER must be disabled or ollama.');
  const model = env.AI_MODEL || '';
  if (provider === 'ollama' && (!/^[\w./:-]{1,100}$/.test(model) || /cloud|\.\.|\//i.test(model))) {
    throw new Error('AI_MODEL must name a local Ollama tag.');
  }
  const host = assertLoopbackHost(env.AI_OLLAMA_HOST || '127.0.0.1:11434', 'AI_OLLAMA_HOST');
  const timeoutMs = Number(env.AI_TIMEOUT_MS || 16_000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 20_000) throw new Error('Invalid AI timeout.');
  const cpuOnly = env.AI_CPU_ONLY === 'true';
  return { provider, model, host, timeoutMs, cpuOnly, identity: [provider, model, cpuOnly ? 'cpu' : 'auto'].join(':') };
}

class ProviderFailure extends Error {
  constructor(code, retry = false) { super(code); this.code = code; this.retry = retry; }
}

async function readResponse(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new ProviderFailure('AI_OUTPUT_INVALID');
  const decoder = new TextDecoder();
  let text = '', bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 65_536) throw new ProviderFailure('AI_OUTPUT_INVALID');
      text += decoder.decode(value, { stream: true });
    }
  } finally { await reader.cancel().catch(() => {}); }
  try {
    const payload = JSON.parse(text + decoder.decode());
    if (payload.done !== true || payload.message?.role !== 'assistant' || payload.done_reason === 'length') {
      throw new Error('Incomplete structured output');
    }
    return { value: JSON.parse(payload.message.content),
      inputTokens: Number.isSafeInteger(payload.prompt_eval_count) ? payload.prompt_eval_count : null,
      outputTokens: Number.isSafeInteger(payload.eval_count) ? payload.eval_count : null };
  } catch { throw new ProviderFailure('AI_OUTPUT_INVALID'); }
}

export class OllamaGateway {
  active = false;

  constructor(config, { fetchImpl = fetch, logger = console } = {}) {
    this.config = config;
    this.fetch = fetchImpl;
    this.logger = logger;
  }

  async generate({ kind, instructions, data, schema, takeAttempt, traceId }) {
    if (this.config.provider === 'disabled') return { failure: 'AI_DISABLED' };
    if (this.active) return { failure: 'AI_BUSY' };
    const content = JSON.stringify(data);
    if (Buffer.byteLength(content) > 24_000) return { failure: 'AI_INPUT_LIMIT' };
    this.active = true;
    try {
      for (let attempt = 1; attempt <= 2; attempt++) {
        if (!await takeAttempt()) return { failure: 'AI_BUDGET_REACHED' };
        const start = performance.now();
        try {
          const { value, ...metrics } = await this.request(instructions, content, schema);
          const parsed = schema.safeParse(value);
          if (!parsed.success) throw new ProviderFailure('AI_OUTPUT_INVALID');
          const latencyMs = Math.round(performance.now() - start);
          this.logger.info?.({ event: 'ai_model_call', traceId, kind, attempt,
            outcome: 'OK', latencyMs, inputTokens: metrics.inputTokens, outputTokens: metrics.outputTokens });
          return { value: parsed.data, usage: { ...metrics, latencyMs, attempts: attempt } };
        } catch (error) {
          const problem = error instanceof ProviderFailure ? error : new ProviderFailure('AI_UNAVAILABLE', true);
          this.logger.info?.({ event: 'ai_model_call', traceId, kind, attempt, outcome: problem.code,
            latencyMs: Math.round(performance.now() - start) });
          if (!problem.retry || attempt === 2) return { failure: problem.code };
        }
      }
    } finally { this.active = false; }
    return { failure: 'AI_UNAVAILABLE' };
  }

  async request(instructions, content, schema) {
    const deadline = AbortSignal.timeout(this.config.timeoutMs);
    try {
      const response = await this.fetch(`http://${this.config.host}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: deadline, redirect: 'error',
        body: JSON.stringify({
          model: this.config.model, stream: false, think: false, format: modelJsonSchema(schema),
          messages: [{ role: 'system', content: instructions }, { role: 'user', content }],
          options: { temperature: 0, num_ctx: this.config.cpuOnly ? 4096 : 8192, num_predict: 420,
            ...(this.config.cpuOnly ? { num_gpu: 0, num_thread: 4 } : {}) }, keep_alive: '5m',
        }),
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw new ProviderFailure('AI_UNAVAILABLE', [502, 503, 504].includes(response.status));
      }
      return await readResponse(response);
    } catch (error) {
      if (deadline.aborted) throw new ProviderFailure('AI_TIMEOUT');
      throw error;
    }
  }
}
