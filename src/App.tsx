import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { loadState, saveState } from './lib/storage'
import { analyzeIdeasLocal } from './lib/localAnalysis'
import type { AppState, Idea } from './types'
import NetworkMap from './components/NetworkMap'
import IdeaSidebar from './components/IdeaSidebar'
import SettingsPanel from './components/SettingsPanel'

export default function App() {
  const [state, setState] = useState<AppState>(loadState)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  const persist = useCallback((next: AppState) => {
    setState(next)
    saveState(next)
  }, [])

  const addIdea = useCallback((text: string) => {
    const idea: Idea = { id: uuidv4(), text, timestamp: new Date().toISOString() }
    persist({ ...state, ideas: [...state.ideas, idea] })
  }, [state, persist])

  const deleteIdea = useCallback((id: string) => {
    persist({ ...state, ideas: state.ideas.filter(i => i.id !== id) })
  }, [state, persist])

  const touchIdea = useCallback((id: string) => {
    const ideas = state.ideas.map(idea =>
      idea.id === id
        ? { ...idea, viewCount: (idea.viewCount ?? 0) + 1, lastViewed: new Date().toISOString() }
        : idea
    )
    persist({ ...state, ideas })
  }, [state, persist])

  const runAnalysis = useCallback(() => {
    if (state.ideas.length < 2) { setError('2件以上のアイデアが必要です'); return }
    setAnalyzing(true)
    setError('')
    try {
      const analysis = analyzeIdeasLocal(state.ideas)
      persist({ ...state, analysis })
    } catch (e) {
      setError(e instanceof Error ? e.message : '分析に失敗しました')
    } finally {
      setAnalyzing(false)
    }
  }, [state, persist])

  const { topic, ideas, analysis } = state

  return (
    <div className="h-screen flex flex-col bg-surface overflow-hidden">
      {/* ── Header ── */}
      <header className="flex-shrink-0 bg-white border-b border-border px-5 flex items-center gap-4" style={{ height: 56 }}>
        <div className="flex items-center gap-2 mr-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#ff6b6b)' }}>
            <span className="text-white text-xs font-black">IM</span>
          </div>
          <span className="font-black text-ink tracking-tight">IdeaMap</span>
        </div>

        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium truncate"
            style={{ background: 'linear-gradient(90deg,#7c3aed,#ff6b6b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {topic}
          </span>
        </div>

        {error && (
          <span className="text-xs text-red-500 bg-red-50 border border-red-200 px-2 py-1 rounded-lg">{error}</span>
        )}

        {ideas.length > 0 && (
          <div className="hidden sm:flex items-center gap-3 text-xs">
            <span className="bg-primary-light text-primary font-bold px-2.5 py-1 rounded-full">{ideas.length} ideas</span>
            {analysis && <span className="bg-pink-50 text-pink-600 font-bold px-2.5 py-1 rounded-full">{analysis.clusters.length} clusters</span>}
          </div>
        )}

        <button
          onClick={runAnalysis}
          disabled={analyzing || ideas.length < 2}
          className="btn-primary"
        >
          {analyzing ? (
            <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>整理中…</>
          ) : (
            <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>AI で整理</>
          )}
        </button>

        <button onClick={() => setShowSettings(true)} className="btn-ghost p-2" title="設定">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <IdeaSidebar
          ideas={ideas}
          analysis={analysis}
          onAdd={addIdea}
          onDelete={deleteIdea}
          onClearAll={() => persist({ ...state, ideas: [], analysis: null })}
        />

        {/* Island map */}
        <main className="flex-1 flex flex-col min-w-0 p-4 gap-3">
          <div className="flex-1 min-h-0">
            <NetworkMap ideas={ideas} analysis={analysis} onTouch={touchIdea} />
          </div>

          {/* AI summary strip */}
          {analysis && (
            <div className="flex-shrink-0 rounded-2xl px-4 py-3 border border-purple-100"
              style={{ background: 'linear-gradient(135deg,#faf5ff 0%,#fff0f5 100%)' }}>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#ff6b6b)' }}>
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-primary mb-1 tracking-wide uppercase">✦ Insight</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{analysis.summary}</p>
                  {analysis.nextActions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {analysis.nextActions.map((a, i) => (
                        <span key={i} className="text-xs font-medium px-3 py-1 rounded-full text-white shadow-sm"
                          style={{ background: ['#7c3aed','#ff6b6b','#06d6a0','#ffd166','#118ab2'][i % 5] }}>
                          → {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <SettingsPanel
          topic={topic}
          ideaCount={ideas.length}
          onUpdateTopic={t => persist({ ...state, topic: t })}
          onClearData={() => persist({ ...state, ideas: [], analysis: null })}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
