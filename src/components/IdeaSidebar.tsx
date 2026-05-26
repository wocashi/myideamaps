import { useState, useRef } from 'react'
import type { Idea, AnalysisResult } from '../types'

interface Props {
  ideas: Idea[]
  analysis: AnalysisResult | null
  onAdd: (text: string) => void
  onDelete: (id: string) => void
  onClearAll: () => void
}

const PALETTE_DOT = [
  '#1d4ed8', '#15803d', '#a16207', '#be185d', '#6d28d9', '#c2410c',
]

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

  const getClusterColor = (id: string) => {
    if (!analysis) return null
    const name = analysis.ideaClusters[id]
    const idx = analysis.clusters.findIndex(c => c.name === name)
    return idx >= 0 ? PALETTE_DOT[idx % PALETTE_DOT.length] : null
  }

  const getClusterName = (id: string) => {
    if (!analysis) return null
    return analysis.ideaClusters[id] ?? null
  }

  return (
    <aside className="flex flex-col h-full bg-white border-r border-border w-72 flex-shrink-0">
      {/* input */}
      <div className="p-4 border-b border-border">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">アイデアを追加</p>
        <textarea
          ref={ref}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="思いついたことを入力… (Enter で追加)"
          rows={3}
          className="input-base resize-none text-sm leading-relaxed"
          autoFocus
        />
        <button onClick={submit} disabled={!text.trim()} className="btn-primary w-full mt-2 justify-center">
          追加する
        </button>
      </div>

      {/* idea list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {ideas.length === 0 && (
          <p className="text-center text-muted text-xs mt-8">まだアイデアがありません</p>
        )}
        {[...ideas].reverse().map(idea => {
          const color = getClusterColor(idea.id)
          const name = getClusterName(idea.id)
          return (
            <div key={idea.id} className="group relative bg-surface rounded-lg p-3 border border-border hover:shadow-card transition-shadow">
              {color && (
                <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r" style={{ background: color }} />
              )}
              <p className="text-sm text-ink leading-snug pr-5">{idea.text}</p>
              {name && (
                <span className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: color + '20', color: color ?? '#64748b' }}>
                  {name}
                </span>
              )}
              <button
                onClick={() => onDelete(idea.id)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-muted hover:text-red-500 text-xs transition-all"
              >✕</button>
            </div>
          )
        })}
      </div>

      {/* count + clear */}
      <div className="border-t border-border px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">{ideas.length} 件のアイデア</span>
          {analysis && (
            <span className="text-xs text-primary font-medium">{analysis.clusters.length} クラスター</span>
          )}
        </div>
        {ideas.length > 0 && (
          confirmClear ? (
            <div className="flex gap-2">
              <button
                onClick={() => { onClearAll(); setConfirmClear(false) }}
                className="flex-1 text-xs bg-red-500 hover:bg-red-600 text-white py-1.5 rounded-lg transition-colors"
              >削除する</button>
              <button
                onClick={() => setConfirmClear(false)}
                className="flex-1 text-xs border border-border text-muted hover:text-ink py-1.5 rounded-lg transition-colors"
              >キャンセル</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="w-full text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 py-1.5 rounded-lg transition-colors"
            >すべて削除する</button>
          )
        )}
      </div>
    </aside>
  )
}
