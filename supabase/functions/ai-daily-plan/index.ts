import { cors, json, admin, getConfig, checkApiKey } from '../_shared/util.ts'
import { buildUserData } from '../_shared/context.ts'

const SYSTEM = `أنت مخطّط يومي داخل تطبيق «منصة تنظيم». مهمتك اقتراح جدول لليوم من المهام النشطة الحقيقية فقط.
قواعد صارمة:
- استخدم فقط المهام الموجودة في السياق (بمعرّفاتها id). لا تخترع مهاماً.
- وزّع المهام على أوقات اليوم مع مراعاة الأولوية وأوقات الذروة المذكورة إن وُجدت.
- لا تجدول في الماضي. استخدم توقيت اليوم الحالي وما بعده.
- أعِد الناتج بصيغة JSON فقط بدون أي نص إضافي، بالشكل التالي:
{"summary":"جملة تحفيزية قصيرة","plan":[{"task_id":"...","title":"...","scheduled_start":"ISO8601","scheduled_end":"ISO8601","reason":"سبب مختصر"}]}`

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const sb = admin()
    const cfg = await getConfig(sb)
    if (!checkApiKey(req, cfg.APP_ANON_KEY)) return json({ error: 'unauthorized' }, 401)
    const body = await req.json().catch(() => ({}))
    const tz = typeof body?.tz === 'string' ? body.tz : undefined
    const { contextText, activeTasks } = await buildUserData(sb, tz)

    if (activeTasks.length === 0) {
      return json({ plan: [], summary: 'لا توجد مهام معلّقة لجدولتها اليوم.' })
    }

    const res = await fetch(`${cfg.NVIDIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.NVIDIA_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.NVIDIA_MODEL,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `السياق:\n${contextText}\n\nاقترح خطة اليوم الآن بصيغة JSON فقط.` },
        ],
        temperature: 0.3,
        max_tokens: 1200,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return json({ error: `NVIDIA error: ${text.slice(0, 300)}` }, 502)
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? ''
    const parsed = extractJson(content) as { summary?: string; plan?: unknown[] } | null

    if (!parsed || !Array.isArray(parsed.plan)) {
      return json({ plan: [], summary: 'تعذّر توليد خطة صالحة. حاول مرة أخرى.' })
    }

    // Keep only items that reference real active tasks.
    const validIds = new Set(activeTasks.map((t) => t.id))
    const plan = (parsed.plan as Record<string, string>[])
      .filter((it) => it.task_id && validIds.has(it.task_id) && it.scheduled_start && it.scheduled_end)
      .map((it) => ({
        task_id: it.task_id,
        title: it.title ?? activeTasks.find((t) => t.id === it.task_id)?.title ?? '',
        scheduled_start: it.scheduled_start,
        scheduled_end: it.scheduled_end,
        reason: it.reason ?? '',
      }))

    // Record the proposal.
    const today = new Date().toISOString().slice(0, 10)
    await sb.from('daily_plans').insert({ plan_date: today, items: plan, status: 'proposed' })

    return json({ plan, summary: parsed.summary ?? 'خطة اليوم جاهزة للمراجعة.' })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unknown error' }, 500)
  }
})
