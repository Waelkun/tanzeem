// Multi-provider LLM layer with priority-based failover. All three providers
// (Google Gemini, OpenRouter, NVIDIA NIM) expose the SAME OpenAI-compatible
// `/chat/completions` contract with `Authorization: Bearer <key>`, so a single
// request/response path handles all of them — we just swap base URL + key + model
// and try them in priority order until one succeeds.
//
// Config lives in the `app_config` table (see getConfig in util.ts). Keys:
//   <NAME>_API_KEY, <NAME>_MODEL, <NAME>_BASE_URL, <NAME>_PRIORITY   for NAME in
//   GEMINI / OPENROUTER / NVIDIA. A provider with no key or model is skipped.

export interface Provider {
  /** Human-friendly label surfaced to the UI (the "which AI answered" badge). */
  name: string
  baseUrl: string
  apiKey: string
  model: string
  extraHeaders?: Record<string, string>
  /** OpenAI params this provider rejects and that must be stripped before sending. */
  dropParams?: string[]
}

export interface ChatResult {
  message: { content?: string | null; tool_calls?: unknown[]; [k: string]: unknown }
  provider: string
  model: string
  finish_reason?: string
}

const DEFAULT_BASE_URL: Record<string, string> = {
  GEMINI: 'https://generativelanguage.googleapis.com/v1beta/openai',
  OPENROUTER: 'https://openrouter.ai/api/v1',
  NVIDIA: 'https://integrate.api.nvidia.com/v1',
}

const LABEL: Record<string, string> = {
  GEMINI: 'Gemini',
  OPENROUTER: 'OpenRouter',
  NVIDIA: 'NVIDIA',
}

/**
 * Build the ordered provider list from config. Providers missing an API key or a
 * model are dropped. Sorted ascending by `<NAME>_PRIORITY` (1 = tried first);
 * providers without a priority sort last.
 */
export function getProviders(cfg: Record<string, string>): Provider[] {
  const providers: (Provider & { priority: number })[] = []
  for (const key of ['GEMINI', 'OPENROUTER', 'NVIDIA']) {
    const apiKey = cfg[`${key}_API_KEY`]
    const model = cfg[`${key}_MODEL`]
    if (!apiKey || !model) continue
    const baseUrl = (cfg[`${key}_BASE_URL`] || DEFAULT_BASE_URL[key] || '').replace(/\/+$/, '')
    if (!baseUrl) continue
    const priority = Number(cfg[`${key}_PRIORITY`] ?? '99')
    const extraHeaders =
      key === 'OPENROUTER'
        ? { 'HTTP-Referer': 'https://tanzeem.app', 'X-Title': 'Tanzeem' }
        : undefined
    // Gemini's OpenAI-compat endpoint 400s on OpenAI-only sampling params.
    const dropParams = key === 'GEMINI' ? ['frequency_penalty', 'presence_penalty'] : undefined
    providers.push({ name: LABEL[key] ?? key, baseUrl, apiKey, model, extraHeaders, dropParams, priority })
  }
  providers.sort((a, b) => a.priority - b.priority)
  return providers.map(({ priority: _priority, ...p }) => p)
}

/**
 * Call the providers in order with one shared OpenAI chat-completions `body`
 * (WITHOUT `model` — each provider's own model is injected). Returns the first
 * successful reply plus which provider/model produced it. A provider is
 * considered failed on: a network error, a request timeout, a non-2xx status, or
 * a response with no assistant message — in every case we fall through to the
 * next. Throws only if ALL providers fail.
 */
export async function chatComplete(
  providers: Provider[],
  body: Record<string, unknown>,
  opts: { timeoutMs?: number } = {},
): Promise<ChatResult> {
  if (providers.length === 0) throw new Error('no AI providers configured')
  const timeoutMs = opts.timeoutMs ?? 30_000
  const errors: string[] = []

  for (const p of providers) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const payload: Record<string, unknown> = { ...body, model: p.model }
      for (const k of p.dropParams ?? []) delete payload[k]
      const res = await fetch(`${p.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${p.apiKey}`,
          'Content-Type': 'application/json',
          ...(p.extraHeaders ?? {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        errors.push(`${p.name}(${p.model}): HTTP ${res.status} ${text.slice(0, 200)}`)
        continue
      }
      const data = await res.json()
      const message = data.choices?.[0]?.message
      if (!message) {
        errors.push(`${p.name}(${p.model}): empty response`)
        continue
      }
      return {
        message,
        provider: p.name,
        model: p.model,
        finish_reason: data.choices?.[0]?.finish_reason,
      }
    } catch (e) {
      const reason = e instanceof Error ? (e.name === 'AbortError' ? 'timeout' : e.message) : 'error'
      errors.push(`${p.name}(${p.model}): ${reason}`)
    } finally {
      clearTimeout(timer)
    }
  }

  throw new Error(`all AI providers failed — ${errors.join(' | ')}`)
}
