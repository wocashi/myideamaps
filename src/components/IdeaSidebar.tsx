import { useState, useRef } from 'react'
import type { Idea, AnalysisResult } from '../types'

interface Props {
  ideas: Idea[]
  analysis: AnalysisResult | null
  onAdd: (text: string) => void
  onDelete: (id: string) => void
  onClearAll: () => void
}

const PILL_COLORS = [
  { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' },
  { bg: '#fff0f5', text: '#e11d74', border: '#fecdd3' },
  { bg: '#f0fdf4', text: '#059669', border: '#bbf7d0' },
  { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  { bg: '#fdf2f8', text: '#c026d3', border: '#f5d0fe' },
]

function dateLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000)
  if (diffDays === 0) return '今日'
  if (diffDays === 1) return '昨日'
  if (diffDays < 7) return `${diffDays}日前`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function groupByDate(ideas: Idea[]): { label: string; ideas: Idea[] }[] {
  const map = new Map<string, Idea[]>()
  for (const idea of [...ideas].reverse()) {
    const key = dateLabel(idea.timestamp)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(idea)
  }
  return [...map.entries()].map(([label, ideas]) => ({ label, ideas }))
}

function timeStr(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function IdeaSidebar({ ideas, analysis, onAdd, onDelete, onClearAll }: Props) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const submit = () => {
    const t = text.trim()
    if (!t) return
    onAdd(t)
    setText('')
    ref.current?.focus()
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  const getClusterInfo = (id: string) => {
    if (!analysis) return null
    const name = analysis.ideaClusters[id]
    if (!name) return null
    const idx = analysis.clusters.findIndex(c => c.name === name)
    return { name, colors: PILL_COLORS[idx % PILL_COLORS.length] }
  }

  const groups = groupByDate(ideas)
  const todayCount = ideas.filter(i => dateLabel(i.timestamp) === '今日').length

  return (
    <aside className="flex flex-col h-full bg-white border-r border-border w-72 flex-shrink-0">

      {/* Header: daily report style */}
      <div className="px-4 pt-4 pb-3 border-b border-border"
        style={{ background: 'linear-gradient(135deg,#faf5ff 0%,#fff0f5 100%)' }}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-black text-primary uppercase tracking-widest">✦ 思考ログ</span>
          <span className="text-xs text-muted">{new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}</span>
        </div>
        {todayCount > 0 && (
          <p className="text-xs text-slate-500 mb-2">今日 <b className="text-primary">{todayCount}</b> 件のメモ</p>
        )}

        {/* Input */}
        <textarea
          ref={ref}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="今思っていることを… (Enter で追加)"
          rows={2}
          className="input-base resize-none text-sm leading-relaxed"
          autoFocus
        />
        <button onClick={submit} disabled={!text.trim()} className="btn-primary w-full mt-2 justify-center">
          + 追加する
        </button>
      </div>

      {/* Timeline log */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {ideas.length === 0 && (
          <div className="text-center mt-10">
            <div className="text-3xl mb-2">📓</div>
            <p className="text-muted text-xs leading-relaxed">思いついたことを<br />どんどん書き留めよう</p>
          </div>
        )}

        {groups.map(({ label, ideas: groupIdeas }) => (
          <div key={label} className="mb-4">
            {/* Date header */}
            <div className="flex items-center gap-2 mb-2 sticky top-0 bg-white py-0.5 z-10">
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full text-white"
                style={{ background: label === '今日' ? 'linear-gradient(135deg,#7c3aed,#ff6b6b)' : '#94a3b8' }}>
                {label}
              </span>
              <span className="text-xs text-muted">{groupIdeas.length}件</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Ideas */}
            <div className="space-y-2 pl-1">
              {groupIdeas.map(idea => {
                const cluster = getClusterInfo(idea.id)
                return (
                  <div key={idea.id}
                    className="group relative bg-white rounded-2xl px-3 py-2.5 border-2 hover:shadow-md transition-all"
                    style={{ borderColor: cluster?.colors.border ?? '#e5e7ff' }}>

                    {/* Time stamp */}
                    <span className="text-xs text-muted float-right mt-0.5 ml-1">{timeStr(idea.timestamp)}</span>

                    <p className="text-sm text-ink leading-snug pr-2">{idea.text}</p>

                    {cluster && (
                      <span className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{ background: cluster.colors.bg, color: cluster.colors.text }}>
                        {cluster.name}
                      </span>
                    )}

                    <button
                      onClick={() => onDelete(idea.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 text-xs transition-all font-bold"
                    >✕</button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted font-medium">計 {ideas.length} メモ</span>
          {analysis && (
            <span className="text-xs font-bold text-primary bg-primary-light px-2 py-0.5 rounded-full">
              {analysis.clusters.length} クラスター
            </span>
          )}
        </div>
        {ideas.length > 0 && (
          confirmClear ? (
            <div className="flex gap-2">
              <button onClick={() => { onClearAll(); setConfirmClear(false) }}
                className="flex-1 text-xs bg-red-500 hover:bg-red-600 text-white py-1.5 rounded-xl font-bold">
                削除する
              </button>
              <button onClick={() => setConfirmClear(false)}
                className="flex-1 text-xs border-2 border-border text-muted py-1.5 rounded-xl">
                キャンセル
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmClear(true)}
              className="w-full text-xs text-red-400 hover:text-red-500 border-2 border-red-100 hover:border-red-300 py-1.5 rounded-xl">
              すべて削除する
            </button>
          )
        )}
      </div>
    </aside>
  )
}
