import { useMemo, useState } from 'react'
import type { Idea, AnalysisResult } from '../types'

interface Props {
  ideas: Idea[]
  analysis: AnalysisResult | null
}

const W = 520
const H = 600
const NODE_R = 20

const CLUSTER_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ec4899',
  '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16',
]
const CLUSTER_LIGHT = [
  '#eff6ff', '#f0fdf4', '#fffbeb', '#fdf2f8',
  '#f5f3ff', '#fef2f2', '#ecfeff', '#f7fee7',
]

// Edge colors by relationship strength tier
const EDGE_COLORS = {
  strong: '#6366f1',   // strength >= 0.7
  medium: '#f59e0b',   // strength 0.5-0.7
  weak:   '#94a3b8',   // strength < 0.5
}

function edgeColor(strength: number) {
  if (strength >= 0.7) return EDGE_COLORS.strong
  if (strength >= 0.5) return EDGE_COLORS.medium
  return EDGE_COLORS.weak
}

function fibLayout(count: number) {
  const golden = 2.399963
  const cx = W / 2, cy = H / 2
  const maxR = Math.min(W, H) * 0.36
  return Array.from({ length: count }, (_, i) => {
    const r = maxR * Math.sqrt((i + 0.5) / count)
    const theta = i * golden
    return { x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) }
  })
}

function clusterLayout(ideas: Idea[], analysis: AnalysisResult) {
  const { clusters, ideaClusters } = analysis
  const n = clusters.length
  const cx = W / 2, cy = H / 2 - 10
  const clusterR = Math.min(W, H) * (n <= 2 ? 0.2 : n <= 4 ? 0.26 : 0.30)

  const positions: Record<string, { x: number; y: number }> = {}
  const clusterCenters: { x: number; y: number; name: string; color: string }[] = []

  clusters.forEach((cluster, ci) => {
    const angle = (ci / n) * 2 * Math.PI - Math.PI / 2
    const ccx = n === 1 ? cx : cx + clusterR * Math.cos(angle)
    const ccy = n === 1 ? cy : cy + clusterR * Math.sin(angle)
    clusterCenters.push({ x: ccx, y: ccy, name: cluster.name, color: cluster.color })

    const members = ideas.filter(idea => ideaClusters[idea.id] === cluster.name)
    const subR = Math.max(38, Math.min(72, 28 + members.length * 10))
    members.forEach((idea, ii) => {
      if (members.length === 1) {
        positions[idea.id] = { x: ccx, y: ccy }
      } else {
        const a = (ii / members.length) * 2 * Math.PI
        positions[idea.id] = { x: ccx + subR * Math.cos(a), y: ccy + subR * Math.sin(a) }
      }
    })
  })

  const unassigned = ideas.filter(i => !ideaClusters[i.id])
  unassigned.forEach((idea, i) => {
    const a = (i / Math.max(unassigned.length, 1)) * 2 * Math.PI
    positions[idea.id] = { x: cx + 160 * Math.cos(a), y: cy + 160 * Math.sin(a) }
  })

  return { positions, clusterCenters }
}

function truncate(text: string, max = 9) {
  return text.length <= max ? text : text.slice(0, max - 1) + '…'
}

function isUrl(text: string) {
  return /^https?:\/\//i.test(text.trim())
}

const ENERGY_LABEL = { high: '高', medium: '中', low: '低' }
const ENERGY_CLASS = {
  high: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-700',
  low: 'bg-slate-100 text-slate-500',
}

export default function NetworkMap({ ideas, analysis }: Props) {
  const fibPositions = useMemo(() => fibLayout(ideas.length), [ideas.length])
  const clustered = useMemo(() =>
    analysis ? clusterLayout(ideas, analysis) : null,
    [ideas, analysis]
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const nodePos = (idea: Idea, i: number) => {
    if (clustered) return clustered.positions[idea.id] ?? { x: W / 2, y: H / 2 }
    return fibPositions[i] ?? { x: W / 2, y: H / 2 }
  }

  const clusterIdx = (idea: Idea) => {
    if (!analysis) return -1
    return analysis.clusters.findIndex(c => c.name === analysis.ideaClusters[idea.id])
  }

  const selectedIdea = ideas.find(i => i.id === selectedId) ?? null
  const selectedCi = selectedIdea ? clusterIdx(selectedIdea) : -1
  const selectedColor = selectedCi >= 0 ? CLUSTER_COLORS[selectedCi] : '#94a3b8'

  return (
    <div className="relative w-full h-full">
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full rounded-2xl select-none"
      style={{ background: '#f8fafc' }}
    >
      <defs>
        <pattern id="grid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="0.8" cy="0.8" r="0.8" fill="#cbd5e1" opacity="0.5" />
        </pattern>
        {CLUSTER_COLORS.map((color, i) => (
          <filter key={i} id={`glow${i}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feFlood floodColor={color} floodOpacity="0.3" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        ))}
      </defs>

      <rect width={W} height={H} fill="url(#grid)" />

      {/* ── EDGES ── */}
      {analysis && analysis.connections.map((conn, ei) => {
        const fromIdea = ideas[conn.fromIndex]
        const toIdea = ideas[conn.toIndex]
        if (!fromIdea || !toIdea) return null
        const p1 = nodePos(fromIdea, conn.fromIndex)
        const p2 = nodePos(toIdea, conn.toIndex)
        const mx = (p1.x + p2.x) / 2
        const my = (p1.y + p2.y) / 2
        const color = edgeColor(conn.strength)
        const sw = 0.8 + conn.strength * 2.4
        const showLabel = conn.reason && conn.strength >= 0.5

        return (
          <g key={ei}>
            <line
              x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke={color}
              strokeWidth={sw}
              opacity={0.3 + conn.strength * 0.5}
              strokeLinecap="round"
            />
            {/* reason label on midpoint */}
            {showLabel && (
              <g>
                <rect
                  x={mx - 28} y={my - 8}
                  width={56} height={14}
                  rx={7}
                  fill={color}
                  opacity={0.88}
                />
                <text
                  x={mx} y={my + 3.5}
                  textAnchor="middle"
                  fill="white"
                  fontSize="7.5"
                  fontWeight="600"
                >
                  {truncate(conn.reason ?? '', 10)}
                </text>
              </g>
            )}
          </g>
        )
      })}

      {/* ── CLUSTER HALOS ── */}
      {clustered?.clusterCenters.map((cc, i) => (
        <ellipse key={i} cx={cc.x} cy={cc.y} rx={82} ry={66}
          fill={CLUSTER_LIGHT[i % CLUSTER_LIGHT.length]}
          stroke={CLUSTER_COLORS[i % CLUSTER_COLORS.length]}
          strokeWidth="1.2" strokeDasharray="5 4" opacity="0.55"
        />
      ))}

      {/* ── NODES ── */}
      {ideas.map((idea, i) => {
        const pos = nodePos(idea, i)
        const ci = clusterIdx(idea)
        const color = ci >= 0 ? CLUSTER_COLORS[ci] : '#94a3b8'
        const lightColor = ci >= 0 ? CLUSTER_LIGHT[ci] : '#f1f5f9'
        const topic = analysis?.ideaTopics?.[idea.id]

        const isSelected = idea.id === selectedId
        return (
          <g key={idea.id} onClick={() => setSelectedId(isSelected ? null : idea.id)}
            style={{ cursor: 'pointer' }}>
            <circle cx={pos.x} cy={pos.y} r={NODE_R + 6} fill={lightColor} opacity={isSelected ? 1 : 0.7} />
            <circle cx={pos.x} cy={pos.y} r={NODE_R} fill={color}
              filter={ci >= 0 ? `url(#glow${ci % CLUSTER_COLORS.length})` : undefined}
              stroke={isSelected ? 'white' : 'none'} strokeWidth={isSelected ? 2.5 : 0}
            />
            <circle cx={pos.x - 5} cy={pos.y - 6} r={5} fill="white" opacity={0.25} />
            <text x={pos.x} y={pos.y + 4} textAnchor="middle"
              fill="white" fontSize="8.5" fontWeight="700" letterSpacing="0.01em">
              {topic ? truncate(topic, 9) : truncate(idea.text, 8)}
            </text>
            <text x={pos.x} y={pos.y + NODE_R + 13} textAnchor="middle" fill="#475569" fontSize="9">
              {truncate(topic ?? idea.text, 16)}
            </text>
            <title>{idea.text}</title>
          </g>
        )
      })}

      {/* ── CLUSTER TITLE BADGES ── */}
      {clustered?.clusterCenters.map((cc, i) => {
        const color = CLUSTER_COLORS[i % CLUSTER_COLORS.length]
        const labelW = cc.name.length * 8 + 20
        return (
          <g key={cc.name}>
            <rect x={cc.x - labelW / 2} y={cc.y - 76} width={labelW} height={20} rx={10}
              fill={color} />
            <text x={cc.x} y={cc.y - 62} textAnchor="middle"
              fill="white" fontSize="10.5" fontWeight="700" letterSpacing="0.02em">
              {cc.name}
            </text>
          </g>
        )
      })}

      {/* ── EDGE LEGEND ── */}
      {analysis && analysis.connections.length > 0 && (
        <g>
          <rect x={8} y={H - 46} width={130} height={40} rx={8} fill="white" opacity={0.85} />
          {[
            { color: EDGE_COLORS.strong, label: '強い関連', y: H - 33 },
            { color: EDGE_COLORS.medium, label: '中程度',   y: H - 18 },
            { color: EDGE_COLORS.weak,   label: '弱い関連', y: H - 3  },
          ].map(({ color, label, y }) => (
            <g key={label}>
              <line x1={16} y1={y - 3} x2={34} y2={y - 3} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
              <text x={40} y={y} fill="#475569" fontSize="8.5">{label}</text>
            </g>
          ))}
        </g>
      )}

      {ideas.length === 0 && (
        <text x={W / 2} y={H / 2} textAnchor="middle" dominantBaseline="middle" fill="#94a3b8" fontSize="13">
          アイデアを追加するとネットワークが現れます
        </text>
      )}

      {ideas.length > 0 && !analysis && (
        <g>
          <rect x={W / 2 - 118} y={H - 36} width={236} height={24} rx={12} fill="white" opacity={0.85} />
          <text x={W / 2} y={H - 20} textAnchor="middle" fill="#64748b" fontSize="11" fontWeight="500">
            「AI で整理」を押すと関連性がつながります
          </text>
        </g>
      )}
    </svg>

    {/* ── Node detail popup ── */}
    {selectedIdea && (
      <div className="absolute top-3 right-3 bg-white rounded-2xl shadow-xl border border-border p-4 w-72 z-10">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-ink text-sm leading-snug pr-2">
            {analysis?.ideaTopics?.[selectedIdea.id] ?? (isUrl(selectedIdea.text) ? 'リンク' : 'メモ')}
          </h3>
          <button onClick={() => setSelectedId(null)}
            className="text-muted hover:text-ink text-lg leading-none flex-shrink-0">✕</button>
        </div>

        {/* Gemini summary */}
        {analysis?.ideaSummaries?.[selectedIdea.id] && (
          <p className="text-xs text-slate-600 leading-relaxed mb-3">
            {analysis.ideaSummaries[selectedIdea.id]}
          </p>
        )}

        {/* Original text or URL */}
        {isUrl(selectedIdea.text) ? (
          <a href={selectedIdea.text} target="_blank" rel="noreferrer"
            className="text-xs text-primary underline break-all block mb-3 hover:text-primary/80">
            {selectedIdea.text}
          </a>
        ) : (
          <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2 mb-3 break-words leading-relaxed">
            {selectedIdea.text}
          </p>
        )}

        {/* Badges */}
        {analysis && (
          <div className="flex flex-wrap gap-1.5">
            {analysis.ideaClusters[selectedIdea.id] && (
              <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                style={{ backgroundColor: selectedColor }}>
                {analysis.ideaClusters[selectedIdea.id]}
              </span>
            )}
            {analysis.ideaEnergies[selectedIdea.id] && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ENERGY_CLASS[analysis.ideaEnergies[selectedIdea.id]]}`}>
                エネルギー {ENERGY_LABEL[analysis.ideaEnergies[selectedIdea.id]]}
              </span>
            )}
          </div>
        )}
      </div>
    )}
    </div>
  )
}
