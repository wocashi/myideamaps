import type { AppState } from '../types'
import StatCard from '../components/StatCard'
import AISummary from '../components/AISummary'
import ThemesBarChart from '../components/charts/ThemesBarChart'
import SentimentChart from '../components/charts/SentimentChart'
import KeywordsCloud from '../components/charts/KeywordsCloud'
import ResponseList from '../components/ResponseList'

interface Props {
  state: AppState
  analyzing: boolean
  analyzeError: string
  onAnalyze: () => void
}

export default function DashboardPage({ state, analyzing, analyzeError, onAnalyze }: Props) {
  const { responses, analysis, question } = state

  const sentimentValues = analysis ? Object.values(analysis.responseSentiments) : []
  const positiveCount = sentimentValues.filter(s => s === 'positive').length
  const topTheme = analysis?.themes.sort((a, b) => b.count - a.count)[0]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-white mb-1">ダッシュボード</h1>
          <p className="text-sm text-gray-500 line-clamp-1">{question}</p>
        </div>
        <button
          onClick={onAnalyze}
          disabled={analyzing || responses.length < 2}
          className="btn-primary text-sm flex items-center gap-2 flex-shrink-0"
        >
          {analyzing ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              分析中…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI 分析を実行
            </>
          )}
        </button>
      </div>

      {analyzeError && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3 text-sm text-rose-300">
          {analyzeError}
        </div>
      )}

      {responses.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-500 text-sm">まだ回答がありません。</p>
          <p className="text-gray-600 text-xs mt-1">「回答する」ページから意見を収集してください。</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="総回答数" value={responses.length} sub="件" />
            <StatCard
              label="テーマ数"
              value={analysis ? analysis.themes.length : '—'}
              sub={analysis ? 'クラスター' : '分析前'}
              color="text-violet-400"
            />
            <StatCard
              label="ポジティブ率"
              value={analysis && sentimentValues.length > 0
                ? `${Math.round(positiveCount / sentimentValues.length * 100)}%`
                : '—'}
              color="text-emerald-400"
            />
            <StatCard
              label="主要テーマ"
              value={topTheme ? topTheme.count : '—'}
              sub={topTheme ? topTheme.name : '分析前'}
              color="text-amber-400"
            />
          </div>

          {analysis && (
            <>
              <AISummary summary={analysis.summary} analyzedAt={analysis.analyzedAt} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ThemesBarChart themes={analysis.themes} />
                <SentimentChart sentiments={analysis.responseSentiments} />
              </div>

              {analysis.keywords.length > 0 && (
                <KeywordsCloud keywords={analysis.keywords} />
              )}
            </>
          )}

          <ResponseList responses={responses} analysis={analysis} />
        </>
      )}
    </div>
  )
}
