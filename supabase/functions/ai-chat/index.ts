import { cors, json, admin, getConfig, checkApiKey } from '../_shared/util.ts'
import { buildUserData, queryTasks, queryTime } from '../_shared/context.ts'
import { chatComplete, getProviders } from '../_shared/llm.ts'

const SYSTEM_RULES = `أنت مساعد إنتاجية شخصي ودود داخل تطبيق «منصة تنظيم». التزم بالقواعد التالية بصرامة:

قواعد الدقة:
- استخدم فقط بيانات المهام والجلسات والإحصائيات المعطاة لك في قسم «بيانات المستخدم الحقيقية» أو نتائج أدوات القراءة. لا تخترع مهاماً أو أوقاتاً أو نسب تقدّم أو أرقاماً.
- لديك أدوات قراءة تحسب لك بدقّة: «query_time» لحساب ساعات العمل ومتوسطاتها وتجميعها (حسب اليوم/الفئة/الهدف/المهمة) خلال أي فترة، و«query_tasks» للبحث في المهام حسب الحالة أو الفئة أو الهدف أو التواريخ. إذا سألك المستخدم عن رقم أو إحصائية غير جاهزة في السياق (مثل متوسط ساعات فترة محددة، أو مهام فئة معيّنة، أو ما أُنجز في شهر ما)، فاستدعِ الأداة المناسبة واعتمد على نتيجتها — لا تحسب الأرقام ذهنياً، ولا تقل «لا أعرف» قبل محاولة الاستعلام.
- إذا لم تتوفر المعلومة حتى بعد الاستعلام، قل «لا أعرف» بدل التخمين.

قواعد استمرارية المحادثة (مهم جداً):
- عامل المحادثة كسياق متصل، لا كأسئلة منفصلة. اقرأ الرسائل السابقة في هذه المحادثة دائماً قبل الرد.
- كثيراً ما تشير أسئلة المستخدم اللاحقة إلى عناصر ذكرتَها أنت في ردّك السابق باستخدام الترتيب أو الضمائر (مثل «المهمة الثالثة»، «المهمة رقم ٣»، «الثانية»، «تلك المهمة»، «وما فئتها؟»، «ومتى موعدها؟»، «هي»). في هذه الحالة حدّد العنصر المقصود من قائمتك السابقة بنفس ترتيبها، ثم اربطه بالمهمة المطابقة في «بيانات المستخدم الحقيقية» بالعنوان، وأجب مباشرةً.
- لا تقل «لا أعرف» لمعلومة موجودة فعلاً في بيانات المستخدم أو ذكرتَها للتو (مثل فئة أو أولوية أو موعد مهمة سردتها قبل قليل). «لا أعرف» تُقال فقط حين تكون المعلومة غير متوفرة في البيانات ولا يمكن حسابها بالأدوات.
- إن كان المرجع غامضاً فعلاً (لم تسرد قائمة من قبل، أو الرقم خارج نطاق القائمة)، اطلب توضيحاً بلطف بدل قول «لا أعرف».

قواعد العرض (مهم جداً):
- المعرّفات [id: ...] والتواريخ الخام بصيغة ISO بيانات داخلية: لا تذكرها أبداً في ردودك النصية للمستخدم.
- عند عرض مهمة اذكر: العنوان، والأولوية بكلمة عربية (عالية/متوسطة/منخفضة)، والموعد كما ورد منسّقاً بالعربية (مثل: الخميس 21 أغسطس الساعة 5:50 مساءً) — وإن كان الموعد اليوم فقل «اليوم» وإن كان غداً فقل «غداً» — والفئة إن وُجدت.
- عند سرد أكثر من مهمة، رقّمها بالترتيب (1، 2، 3…) حتى يسهل على المستخدم الإشارة إليها لاحقاً، والتزم بهذا الترتيب نفسه عند الإشارة إليها في الردود التالية.
- نسّق ردودك بشكل مرتب وطبيعي: قوائم مرقّمة قصيرة للمهام، وجمل مباشرة — تحدّث كمساعد شخصي وليس كقاعدة بيانات.

قواعد الإجراءات:
- لا تضف أو تعدّل أو تحذف أو تكمل أو تجدول أي مهمة أو هدف أو إعداد إلا عند طلب المستخدم الصريح. يتولّى التطبيق عرض بطاقة تأكيد قبل تنفيذ أي إجراء.
- إذا لم يطلب المستخدم إجراءً، فأجب نصّياً فقط (أو استخدم أدوات القراءة فقط) دون استدعاء أي أداة تعديل.
- قبل إضافة مهمة يجب أن تعرف عنوانها. إذا طلب المستخدم «أضف مهمة» دون ذكر عنوان واضح، لا تستدعِ الأداة، بل اسأله أولاً: «ما المهمة التي تريد إضافتها؟ ومتى موعدها؟». لا تخترع عنواناً مثل «مهمة جديدة».
- إذا ذكر المستخدم وقتاً للمهمة، حوّله إلى due_date بصيغة ISO 8601 اعتماداً على «التاريخ والوقت الحالي» في أعلى السياق. لا تضع تاريخاً في الماضي لمهمة جديدة.
- إذا لم يذكر موعداً، اترك due_date فارغاً.
- عند تعديل/إكمال/حذف/جدولة مهمة أو تعديل هدف، استخدم المعرّف id الصحيح من السياق داخل استدعاء الأداة فقط، وليس في النص.

- أجب دائماً باللغة العربية وبإيجاز.`

// Read-only tools: the SERVER computes the answer and feeds it back to the model,
// so figures are exact. These are always available (a question is not an action).
const READ_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'query_time',
      description:
        'حساب وقت العمل (الجلسات) خلال فترة اختيارية مع المتوسطات والتجميع. يعيد الساعات وعدد الجلسات والأيام النشطة والمتوسط لكل يوم نشط.',
      parameters: {
        type: 'object',
        properties: {
          range_start: { type: 'string', description: 'بداية الفترة ISO 8601 (اختياري)' },
          range_end: { type: 'string', description: 'نهاية الفترة ISO 8601 (اختياري)' },
          group_by: { type: 'string', enum: ['day', 'category', 'goal', 'task'], description: 'تجميع النتائج (اختياري)' },
          metric: { type: 'string', enum: ['sum', 'avg', 'count'], description: 'المقياس المطلوب (اختياري)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_tasks',
      description: 'البحث في المهام حسب الحالة أو الفئة أو الهدف أو تواريخ الاستحقاق/الإنجاز. يعيد قائمة المهام المطابقة.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['todo', 'doing', 'done'] },
          category: { type: 'string' },
          goal: { type: 'string', description: 'عنوان الهدف أو معرّفه' },
          due_before: { type: 'string', description: 'ISO 8601' },
          due_after: { type: 'string', description: 'ISO 8601' },
          completed_before: { type: 'string', description: 'ISO 8601' },
          completed_after: { type: 'string', description: 'ISO 8601' },
          limit: { type: 'number' },
        },
      },
    },
  },
]

// Action (write) tools: returned to the frontend as a proposed tool_call that the
// user must confirm before it runs.
const ACTION_TOOLS = [
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
      name: 'edit_task',
      description: 'تعديل حقول مهمة موجودة (العنوان/الملاحظات/الأولوية/الفئة/الاستحقاق/الحالة)',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'string' },
          title: { type: 'string' },
          notes: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'med', 'high'] },
          category: { type: 'string' },
          due_date: { type: 'string', description: 'ISO 8601' },
          status: { type: 'string', enum: ['todo', 'doing', 'done'] },
        },
        required: ['task_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_task',
      description: 'حذف مهمة نهائياً',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'string' },
          title: { type: 'string', description: 'عنوان المهمة للعرض' },
        },
        required: ['task_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_goal',
      description: 'إنشاء هدف جديد',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          target_hours: { type: 'number' },
          color: { type: 'string' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_goal',
      description: 'تعديل هدف موجود (العنوان/الوصف/الساعات المستهدفة/الأرشفة)',
      parameters: {
        type: 'object',
        properties: {
          goal_id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          target_hours: { type: 'number' },
          archived: { type: 'boolean' },
        },
        required: ['goal_id'],
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
  {
    type: 'function',
    function: {
      name: 'update_settings',
      description: 'تعديل إعدادات التطبيق (مدد البومودورو/التنبيهات/السمة/المنطقة الزمنية)',
      parameters: {
        type: 'object',
        properties: {
          pomodoro_focus_min: { type: 'number' },
          pomodoro_break_min: { type: 'number' },
          pomodoro_long_break_min: { type: 'number' },
          pomodoro_cycles: { type: 'number' },
          notif_task_reminders: { type: 'boolean' },
          notif_pomodoro: { type: 'boolean' },
          notif_daily_plan: { type: 'boolean' },
          theme: { type: 'string' },
          timezone: { type: 'string' },
        },
      },
    },
  },
]

const READ_TOOL_NAMES = new Set(['query_time', 'query_tasks'])

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
  /(اضف|ضيف|انشئ|سجل|اكمل|كمل|انه|خلص|جدول|رتب|ذكرني|بومودورو|اضبط|عدل|احذف|امسح|الغ|غير|add|create|complete|finish|schedule|pomodoro|remind|set|edit|update|delete|remove)/i

// deno-lint-ignore no-explicit-any
function parseArgs(tc: any): Record<string, unknown> {
  try {
    return JSON.parse(tc?.function?.arguments || '{}')
  } catch {
    return {}
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { message, history, tz } = await req.json()
    const sb = admin()
    const cfg = await getConfig(sb)
    if (!checkApiKey(req, cfg.APP_ANON_KEY)) return json({ error: 'unauthorized' }, 401)
    const providers = getProviders(cfg)
    if (providers.length === 0) return json({ error: 'no AI providers configured' }, 500)

    const { contextText, raw } = await buildUserData(sb, typeof tz === 'string' ? tz : undefined)

    // Action tools appear only when the user is actually asking for an action.
    // IMPORTANT: scan only the USER's own words (current message + recent user
    // turns), never the assistant's replies. The assistant naturally describes
    // tasks using words like «مجدولة» or «رتّب» that would match the action regex
    // as substrings — letting its prose flip the mode to 'action' hijacks the
    // user's next *question* into a forced write-tool proposal instead of an
    // answer. A follow-up that only supplies a missing detail still carries no
    // keyword on its own; the add-task clarifier below handles that case.
    const recentHistory = Array.isArray(history) ? history.slice(-4) : []
    const recentUserTurns = recentHistory.filter((h) => h?.role === 'user')
    const actionWindow = [String(message ?? ''), ...recentUserTurns.map((h) => String(h?.content ?? ''))].join(' ')
    const wantsAction = ACTION_RE.test(normalizeAr(actionWindow))

    // If the previous assistant turn was our "which task do you want to add?"
    // clarifier, the current user message IS the answer — force add_task.
    const lastAssistant = [...recentHistory].reverse().find((h) => h?.role === 'assistant')
    const answeringAddPrompt = /تريد إضافتها|ما المهمة|ومتى موعدها/.test(String(lastAssistant?.content ?? ''))

    const messages: Record<string, unknown>[] = [
      { role: 'system', content: `${SYSTEM_RULES}\n\n=== بيانات المستخدم الحقيقية ===\n${contextText}` },
      ...(Array.isArray(history) ? history.slice(-10) : []),
      { role: 'user', content: String(message ?? '') },
    ]

    // Tool exposure — keep read and write tools SEPARATE so the model doesn't get
    // distracted. An action request gets only the write tools (so it proposes the
    // action instead of running analytics); a question gets only the read tools
    // (so it can fetch/compute, then answer). answeringAddPrompt forces add_task.
    const baseTools = answeringAddPrompt
      ? ACTION_TOOLS.filter((t) => t.function.name === 'add_task')
      : wantsAction
        ? ACTION_TOOLS
        : READ_TOOLS
    // When the user asks for an action, REQUIRE a tool call. Gemini (and some free
    // models) otherwise reply in prose and the action never reaches a confirm card.
    // Only action tools are exposed here, so "required" picks the right one; the
    // frontend still guards empty/ambiguous add_task titles into a clarifier.
    const baseToolChoice = answeringAddPrompt || wantsAction ? 'required' : 'auto'

    // Tool loop: auto-run READ tool calls server-side and feed results back (max 3
    // rounds), so the model can fetch/compute before answering. A WRITE tool call
    // is NOT executed here — it's returned to the frontend for user confirmation.
    let provider = ''
    let model = ''
    // deno-lint-ignore no-explicit-any
    let answerMsg: any = null
    let toolCall: { name: string; arguments: Record<string, unknown> } | null = null

    for (let step = 0; step < 4; step++) {
      const useTools = baseTools
      const toolChoice = step === 0 ? baseToolChoice : 'auto'
      const result = await chatComplete(providers, {
        messages,
        tools: useTools,
        tool_choice: toolChoice,
        temperature: 0.2,
        max_tokens: 2048,
        frequency_penalty: 0.3,
      })
      provider = result.provider
      model = result.model
      const m = result.message
      const calls = Array.isArray(m.tool_calls) ? m.tool_calls : []
      const actionCall = calls.find((c) => !READ_TOOL_NAMES.has(c?.function?.name))
      const readCalls = calls.filter((c) => READ_TOOL_NAMES.has(c?.function?.name))

      if (!actionCall && readCalls.length) {
        // Run the read tools and loop again with their results in context.
        messages.push({ role: 'assistant', content: m.content ?? '', tool_calls: calls })
        for (const c of readCalls) {
          const args = parseArgs(c)
          const out = c.function.name === 'query_time' ? queryTime(raw, args) : queryTasks(raw, args)
          messages.push({ role: 'tool', tool_call_id: c.id, content: out })
        }
        continue
      }

      if (actionCall) toolCall = { name: actionCall.function.name, arguments: parseArgs(actionCall) }
      answerMsg = m
      break
    }

    // Safety net for the add-task clarifier: if the model still didn't propose an
    // add_task, synthesize one from the user's message so a confirm card appears.
    if (!toolCall && answeringAddPrompt) {
      const title = String(message ?? '').trim()
      if (title && !/^\s*(لا|إلغاء|الغاء|no|cancel)\b/i.test(title)) {
        toolCall = { name: 'add_task', arguments: { title } }
      }
    }

    // Broader add-task net: some providers (e.g. gemini preview, free models) reply
    // in prose even with tool_choice 'required'. For an explicit "add a task X"
    // request, deterministically synthesize the add_task call by stripping the
    // leading add keyword so a confirm card always appears (frontend normalizes the
    // date and guards empty/question titles into a clarifier).
    if (!toolCall && wantsAction) {
      const norm = normalizeAr(String(message ?? ''))
      if (/(اضف|ضيف|انشئ|اضيف|add|create)/.test(norm) && /مهم|task/i.test(norm)) {
        const title = String(message ?? '')
          .replace(/^\s*(أضف|اضف|ضيف|أضيف|اضيف|أنشئ|انشئ|add|create)\s*(مهمّ?ة|مهمه|task)?\s*[:：\-–]?\s*/i, '')
          .trim()
        if (title && !/[؟?]/.test(title) && title !== 'مهمة جديدة') {
          toolCall = { name: 'add_task', arguments: { title } }
        }
      }
    }

    const reply =
      (answerMsg?.content && String(answerMsg.content).trim()) ||
      (toolCall ? 'أقترح تنفيذ الإجراء التالي — راجعه وأكّده:' : 'لا أعرف.')

    return json({ reply, tool_call: toolCall, provider, model })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unknown error' }, 502)
  }
})
