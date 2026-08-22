import { cors, json, admin, getConfig, checkApiKey } from '../_shared/util.ts'
import { buildUserData } from '../_shared/context.ts'

const SYSTEM_RULES = `أنت مساعد إنتاجية شخصي ودود داخل تطبيق «منصة تنظيم». التزم بالقواعد التالية بصرامة:

قواعد الدقة:
- استخدم فقط بيانات المهام والجلسات والإحصائيات المعطاة لك في قسم «بيانات المستخدم الحقيقية». لا تخترع مهاماً أو أوقاتاً أو نسب تقدّم أو أرقاماً.
- إذا لم تكن المعلومة متوفرة في السياق، قل «لا أعرف» بدل التخمين.

قواعد العرض (مهم جداً):
- المعرّفات [id: ...] والتواريخ الخام بصيغة ISO بيانات داخلية: لا تذكرها أبداً في ردودك النصية للمستخدم.
- عند عرض مهمة اذكر: العنوان، والأولوية بكلمة عربية (عالية/متوسطة/منخفضة)، والموعد كما ورد منسّقاً بالعربية (مثل: الخميس 21 أغسطس الساعة 5:50 مساءً) — وإن كان الموعد اليوم فقل «اليوم» وإن كان غداً فقل «غداً» — والفئة إن وُجدت.
- نسّق ردودك بشكل مرتب وطبيعي: قوائم نقطية قصيرة للمهام، وجمل مباشرة — تحدّث كمساعد شخصي وليس كقاعدة بيانات.

قواعد الإجراءات:
- لا تضف أو تعدّل أو تكمل أو تجدول أي مهمة إلا عند طلب المستخدم الصريح.
- إذا لم يطلب المستخدم إجراءً، فأجب نصّياً فقط دون استدعاء أي أداة.
- قبل إضافة مهمة يجب أن تعرف عنوانها. إذا طلب المستخدم «أضف مهمة» دون ذكر عنوان واضح للمهمة، لا تستدعِ الأداة إطلاقاً، بل اسأله أولاً بجملة قصيرة: «ما المهمة التي تريد إضافتها؟ ومتى موعدها؟». لا تخترع عنواناً أبداً مثل «مهمة جديدة».
- إذا ذكر المستخدم وقتاً أو موعداً للمهمة، حوّله إلى حقل due_date بصيغة ISO 8601 اعتماداً على «التاريخ والوقت الحالي» المذكور في أعلى السياق (استخدم قيمة ISO المرفقة). لا تضع أبداً تاريخاً في الماضي لمهمة جديدة.
- إذا لم يذكر المستخدم موعداً، اترك حقل due_date فارغاً؛ سيُضبط تلقائياً على اليوم.
- عند إكمال أو جدولة مهمة قائمة، استخدم المعرّف id الصحيح من السياق داخل استدعاء الأداة فقط، وليس في النص.

- أجب دائماً باللغة العربية وبإيجاز.`

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_task',
      description: 'إضافة مهمة جديدة',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'عنوان المهمة' },
          notes: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'med', 'high'] },
          category: { type: 'string' },
          due_date: { type: 'string', description: 'ISO 8601 datetime' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_task',
      description: 'وضع علامة إكمال على مهمة موجودة',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'معرّف المهمة من السياق' },
          title: { type: 'string', description: 'عنوان المهمة للعرض' },
        },
        required: ['task_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'schedule_task',
      description: 'جدولة مهمة في وقت محدد',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'string' },
          title: { type: 'string' },
          scheduled_start: { type: 'string', description: 'ISO 8601' },
          scheduled_end: { type: 'string', description: 'ISO 8601' },
        },
        required: ['task_id', 'scheduled_start', 'scheduled_end'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_pomodoro',
      description: 'ضبط مدد البومودورو',
      parameters: {
        type: 'object',
        properties: {
          focus_min: { type: 'number' },
          break_min: { type: 'number' },
          cycles: { type: 'number' },
        },
      },
    },
  },
]

// Normalize Arabic (strip diacritics, unify alef/ya/ta-marbuta) so keyword
// matching is robust to hamza and tashkeel variants.
function normalizeAr(s: string): string {
  return s
    .replace(/[ً-ْٰ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
}
const ACTION_RE =
  /(اضف|ضيف|انشئ|سجل|اكمل|كمل|انه|خلص|جدول|رتب|ذكرني|بومودورو|اضبط|عدل|add|create|complete|finish|schedule|pomodoro|remind|set)/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { message, history, tz } = await req.json()
    const sb = admin()
    const cfg = await getConfig(sb)
    if (!checkApiKey(req, cfg.APP_ANON_KEY)) return json({ error: 'unauthorized' }, 401)
    const { contextText } = await buildUserData(sb, typeof tz === 'string' ? tz : undefined)

    // Only expose action tools when the user is actually asking for an action.
    // For questions (progress, "what are my tasks?"), the model answers from
    // context with no tool call — prevents spurious/hallucinated actions.
    //
    // Crucially, we scan the current message AND the last few turns, not just the
    // current message. Otherwise a follow-up that only supplies the missing detail
    // (e.g. user: «أضف مهمة» → assistant: «ما المهمة؟» → user: «مراجعة التقرير غداً
    // 5 مساءً») carries no action keyword on its own, the tools stay hidden, and
    // the task is never actually added.
    const recentHistory = Array.isArray(history) ? history.slice(-4) : []
    const actionWindow = [String(message ?? ''), ...recentHistory.map((h) => String(h?.content ?? ''))].join(' ')
    const wantsAction = ACTION_RE.test(normalizeAr(actionWindow))

    // If the previous assistant turn was our "which task do you want to add?"
    // clarifier, the current user message IS the answer. Left on 'auto', the model
    // often just replies in prose and the task is never added. Force the add_task
    // tool so the follow-up deterministically produces a confirm card. The frontend
    // still guards against a clarifying-question-as-title and requires confirmation.
    // If the previous assistant turn was our «which task do you want to add?»
    // clarifier, the current user message IS the answer.
    const lastAssistant = [...recentHistory].reverse().find((h) => h?.role === 'assistant')
    const answeringAddPrompt = /تريد إضافتها|ما المهمة|ومتى موعدها/.test(String(lastAssistant?.content ?? ''))

    const messages = [
      { role: 'system', content: `${SYSTEM_RULES}\n\n=== بيانات المستخدم الحقيقية ===\n${contextText}` },
      ...(Array.isArray(history) ? history.slice(-10) : []),
      { role: 'user', content: String(message ?? '') },
    ]

    // When the user is answering our "which task?" clarifier, expose ONLY the
    // add_task tool and require a tool call. The named-function tool_choice form
    // is ignored by this endpoint, but restricting the toolset + 'required'
    // reliably yields an add_task call. (A server-side fallback below covers the
    // case where the model still refuses.)
    const toolsToSend = answeringAddPrompt ? TOOLS.filter((t) => t.function.name === 'add_task') : TOOLS
    const toolChoice = answeringAddPrompt ? 'required' : 'auto'

    const res = await fetch(`${cfg.NVIDIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: cfg.NVIDIA_MODEL,
        messages,
        ...(wantsAction || answeringAddPrompt ? { tools: toolsToSend, tool_choice: toolChoice } : {}),
        temperature: 0.2,
        max_tokens: 800,
        frequency_penalty: 0.3,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return json({ error: `NVIDIA error: ${text.slice(0, 300)}` }, 502)
    }

    const data = await res.json()
    const msg = data.choices?.[0]?.message ?? {}
    let tool_call = null
    const tc = msg.tool_calls?.[0]
    if (tc?.function) {
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(tc.function.arguments || '{}')
      } catch {
        args = {}
      }
      tool_call = { name: tc.function.name, arguments: args }
    }

    // Safety net: if the user was answering our add-task clarifier but the model
    // still didn't emit a tool call (some models ignore tool_choice entirely and
    // reply in prose — which is exactly how tasks silently failed to get added),
    // synthesize one from their message so a confirm card always appears. The
    // frontend normalizes the date and the user can edit the title before saving.
    if (!tool_call && answeringAddPrompt) {
      const title = String(message ?? '').trim()
      if (title && !/^\s*(لا|إلغاء|الغاء|no|cancel)\b/i.test(title)) {
        tool_call = { name: 'add_task', arguments: { title } }
      }
    }

    const reply =
      (msg.content && String(msg.content).trim()) ||
      (tool_call ? 'أقترح تنفيذ الإجراء التالي — راجعه وأكّده:' : 'لا أعرف.')

    return json({ reply, tool_call })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unknown error' }, 500)
  }
})
