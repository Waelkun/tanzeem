import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUp, Check, Sparkle, X } from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import { supabase, invokeFunction } from '@/lib/supabase'
import { qk, useTasks } from '@/lib/queries'
import type { Json } from '@/lib/database.types'
import type { ProposedToolCall } from '@/lib/types'
import { describeToolCall, executeToolCall, normalizeAddTask } from './executeTool'
import { cn } from '@/lib/cn'

interface Msg {
  id: string
  role: 'user' | 'assistant'
  content: string
  tool_call?: ProposedToolCall | null
  confirmed?: boolean
}

const SUGGESTIONS = ['ما هي مهامي اليوم؟', 'كم ساعة عملت هذا الأسبوع؟', 'أضف مهمة: مراجعة التقرير غداً 5 مساءً']

export function AISidePanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data: tasks } = useTasks()
  const taskTitleById = useMemo(() => new Map((tasks ?? []).map((t) => [t.id, t.title])), [tasks])
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (data) {
          setMessages(
            data.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              tool_call: (m.tool_call as ProposedToolCall | null) ?? null,
              confirmed: true,
            })),
          )
        }
      })
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  const send = async (text: string) => {
    const content = text.trim()
    if (!content || busy) return
    setInput('')
    const userMsg: Msg = { id: crypto.randomUUID(), role: 'user', content }
    setMessages((m) => [...m, userMsg])
    setBusy(true)
    void supabase.from('chat_messages').insert({ role: 'user', content })

    try {
      const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }))
      const res = await invokeFunction<{ reply: string; tool_call?: ProposedToolCall | null }>('ai-chat', {
        message: content,
        history,
      })
      let normalizedCall = res.tool_call ? normalizeAddTask(res.tool_call) : null
      let replyText = res.reply
      // Guard: sometimes the model stuffs a clarifying question into add_task's
      // title instead of just asking. Treat that as a plain question, no card.
      if (normalizedCall?.name === 'add_task') {
        const title = String(normalizedCall.arguments.title ?? '').trim()
        if (!title || /[؟?]/.test(title) || title === 'مهمة جديدة') {
          replyText = title && /[؟?]/.test(title) ? title : 'ما المهمة التي تريد إضافتها؟ ومتى موعدها؟'
          normalizedCall = null
        }
      }
      const aMsg: Msg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: replyText,
        tool_call: normalizedCall,
      }
      setMessages((m) => [...m, aMsg])
      void supabase
        .from('chat_messages')
        .insert({ role: 'assistant', content: replyText, tool_call: (normalizedCall ?? null) as unknown as Json })
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: e instanceof Error ? `تعذّر الاتصال بالمساعد: ${e.message}` : 'حدث خطأ.',
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  const confirmTool = async (msgId: string, tc: ProposedToolCall) => {
    try {
      const result = await executeToolCall(tc)
      setMessages((m) =>
        m.map((x) => (x.id === msgId ? { ...x, confirmed: true } : x)).concat({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result,
        }),
      )
      qc.invalidateQueries({ queryKey: qk.tasks })
      qc.invalidateQueries({ queryKey: qk.settings })
    } catch {
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', content: 'تعذّر تنفيذ الإجراء.' }])
    }
  }

  const cancelTool = (msgId: string) =>
    setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, tool_call: null, confirmed: false } : x)))

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-ink-950/60 backdrop-blur-sm"
      />
      <motion.aside
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', stiffness: 280, damping: 30 }}
        className="fixed inset-y-0 start-0 z-50 w-full sm:w-[26rem] glass border-e border-white/10 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center h-9 w-9 rounded-2xl bg-accent text-ink-950">
              <Sparkle size={20} weight="fill" />
            </span>
            <div>
              <p className="font-semibold tracking-tight leading-none">المساعد الذكي</p>
              <p className="text-[11px] text-ink-400 mt-1">يعتمد على بياناتك الحقيقية فقط</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-xl text-ink-400 hover:bg-white/[0.08] hover:text-ink-100 transition-colors focus-ring"
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && !busy && (
            <div className="text-center py-8">
              <div className="grid place-items-center h-14 w-14 rounded-3xl bg-accent-faint text-accent-strong mx-auto mb-3 animate-float">
                <Sparkle size={26} weight="fill" />
              </div>
              <p className="text-sm text-ink-300">كيف أساعدك اليوم؟</p>
              <div className="flex flex-col gap-2 mt-4">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-sm text-ink-200 glass-soft rounded-2xl px-3.5 py-2.5 text-start hover:bg-white/[0.06] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <Bubble key={m.id} msg={m} onConfirm={confirmTool} onCancel={cancelTool} taskTitleById={taskTitleById} />
          ))}

          {busy && (
            <div className="flex items-center gap-2 text-ink-400 text-sm ps-1">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-accent animate-breathe"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
              يفكّر…
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-white/[0.06]">
          <div className="flex items-end gap-2 glass-soft rounded-2xl p-1.5">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send(input)
                }
              }}
              rows={1}
              placeholder="اكتب رسالتك…"
              className="flex-1 bg-transparent resize-none px-2.5 py-2 text-sm text-ink-100 placeholder:text-ink-500 outline-none max-h-28"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || busy}
              className="grid place-items-center h-9 w-9 rounded-xl bg-accent text-ink-950 shrink-0 disabled:opacity-40 active:scale-95 transition-transform focus-ring"
            >
              <ArrowUp size={18} weight="bold" />
            </button>
          </div>
        </div>
      </motion.aside>
    </>
  )
}

function Bubble({
  msg,
  onConfirm,
  onCancel,
  taskTitleById,
}: {
  msg: Msg
  onConfirm: (id: string, tc: ProposedToolCall) => void
  onCancel: (id: string) => void
  taskTitleById: Map<string, string>
}) {
  const isUser = msg.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex', isUser ? 'justify-start' : 'justify-end')}
    >
      <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2.5', isUser ? 'bg-accent text-ink-950' : 'glass-soft text-ink-100')}>
        <div className="text-sm leading-relaxed prose-chat">
          {isUser ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
        </div>

        {msg.tool_call && !msg.confirmed && (
          <div className="mt-2.5 pt-2.5 border-t border-white/10">
            <p className="text-xs text-ink-300 mb-2">تأكيد الإجراء:</p>
            <p className="text-sm font-medium text-ink-100 mb-3">{describeToolCall(msg.tool_call, taskTitleById)}</p>
            <div className="flex gap-2">
              <button
                onClick={() => onConfirm(msg.id, msg.tool_call!)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl bg-accent text-ink-950 text-sm font-medium active:scale-95 transition-transform"
              >
                <Check size={16} weight="bold" />
                تأكيد
              </button>
              <button
                onClick={() => onCancel(msg.id)}
                className="px-4 h-9 rounded-xl text-ink-300 hover:bg-white/[0.08] text-sm transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
