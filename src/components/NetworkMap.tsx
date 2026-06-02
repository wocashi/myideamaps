import { useRef, useState, useMemo, useEffect } from 'react'
import type { Idea, AnalysisResult } from '../types'

interface Props {
  ideas: Idea[]
  analysis: AnalysisResult | null
  onTouch: (id: string) => void
}

const W = 560
const H = 620

const ISLAND_FILL   = ['#ede9fe','#ffe4e6','#d1fae5','#fef3c7','#dbeafe','#fce7f3','#ccfbf1','#fef9c3']
const ISLAND_STROKE = ['#8b5cf6','#fb7185','#10b981','#f59e0b','#3b82f6','#ec4899','#14b8a6','#eab308']
const GOLDEN = 2.399963229

// ── Heat ─────────────────────────────────────────────────────────
function calcHeat(idea: Idea): number {
  const views = idea.viewCount ?? 0
  const lastSeen = idea.lastViewed ?? idea.timestamp
  const h = (Date.now() - new Date(lastSeen).getTime()) / 3_600_000
  const recency = Math.exp(-h / 48)
  const freq = Math.min(1, Math.log1p(views) / Math.log1p(20))
  const newness = h < 0.5 ? 0.4 * (1 - h * 2) : 0
  return Math.min(1, recency * 0.5 + freq * 0.4 + newness)
}

function markerColor(heat: number): string {
  if (heat < 0.25) return '#a5b4fc'
  if (heat < 0.55) return '#fb923c'
  if (heat < 0.8)  return '#f43f5e'
  return '#7c3aed'
}

function nodeRadius(heat: number): number {
  return 14 + heat * 12
}

// ── Layouts ───────────────────────────────────────────────────────
function heatLayout(ideas: Idea[], heats: Record<string, number>) {
  const sorted = [...ideas].sort((a, b) => (heats[b.id] ?? 0) - (heats[a.id] ?? 0))
  const cx = W / 2, cy = H / 2, maxR = Math.min(W, H) * 0.44
  const pos: Record<string, { x: number; y: number }> = {}
  sorted.forEach((idea, i) => {
    const frac = ideas.length > 1 ? i / (ideas.length - 1) : 0
    const r = maxR * Math.pow(frac, 0.6)
    pos[idea.id] = { x: cx + r * Math.cos(i * GOLDEN), y: cy + r * Math.sin(i * GOLDEN) }
  })
  return pos
}

function clusterLayout(ideas: Idea[], analysis: AnalysisResult, heats: Record<string, number>) {
  const { clusters, ideaClusters } = analysis
  const avgHeat = (c: typeof clusters[0]) => {
    const m = ideas.filter(i => ideaClusters[i.id] === c.name)
    return m.length ? m.reduce((s, i) => s + (heats[i.id] ?? 0), 0) / m.length : 0
  }
  const sorted = [...clusters].sort((a, b) => avgHeat(b) - avgHeat(a))
  const n = sorted.length, cx = W / 2, cy = H / 2
  const pos: Record<string, { x: number; y: number }> = {}
  const centers: { x: number; y: number; name: string; ci: number }[] = []

  sorted.forEach((cluster, ci) => {
    const heat = avgHeat(cluster)
    const cr = n === 1 ? 0 : 105 + (1 - heat) * 150
    const angle = n === 1 ? 0 : (ci / n) * 2 * Math.PI - Math.PI / 2
    const ccx = n === 1 ? cx : cx + cr * Math.cos(angle)
    const ccy = n === 1 ? cy : cy + cr * Math.sin(angle)
    centers.push({ x: ccx, y: ccy, name: cluster.name, ci })

    const members = ideas.filter(i => ideaClusters[i.id] === cluster.name)
    const subR = Math.max(48, Math.min(88, 36 + members.length * 12))
    members.forEach((idea, ii) => {
      const a = members.length === 1 ? 0 : (ii / members.length) * 2 * Math.PI
      pos[idea.id] = members.length === 1
        ? { x: ccx, y: ccy }
        : { x: ccx + subR * Math.cos(a), y: ccy + subR * Math.sin(a) }
    })
  })

  ideas.filter(i => !ideaClusters[i.id]).forEach((idea, i, arr) => {
    const a = (i / Math.max(arr.length, 1)) * 2 * Math.PI
    pos[idea.id] = { x: cx + 185 * Math.cos(a), y: cy + 185 * Math.sin(a) }
  })

  return { pos, centers }
}

const GRID_H = Array.from({ length: Math.ceil(H / 56) + 1 }, (_, i) => i * 56)
const GRID_V = Array.from({ length: Math.ceil(W / 56) + 1 }, (_, i) => i * 56)

function truncate(t: string, n = 10) { return t.length <= n ? t : t.slice(0, n - 1) + '…' }
function isUrl(t: string) { return /^https?:\/\//i.test(t.trim()) }

// ── Component ─────────────────────────────────────────────────────
export default function NetworkMap({ ideas, analysis, onTouch }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  // manual overrides from drag
  const [overrides, setOverrides] = useState<Record<string, { x: number; y: number }>>({})
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null)

  // Reset overrides when analysis changes
  useEffect(() => { setOverrides({}) }, [analysis])

  const heats = useMemo(() => {
    const m: Record<string, number> = {}
    ideas.forEach(i => { m[i.id] = calcHeat(i) })
    return m
  }, [ideas])

  const layout = useMemo(() => {
    if (!analysis) return { pos: heatLayout(ideas, heats), centers: [] }
    const { pos, centers } = clusterLayout(ideas, analysis, heats)
    return { pos, centers }
  }, [ideas, analysis, heats])

  function getPos(id: string): { x: number; y: number } {
    return overrides[id] ?? layout.pos[id] ?? { x: W / 2, y: H / 2 }
  }

  function toSvgPt(e: React.MouseEvent): { x: number; y: number } {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    }
  }

  function handleNodeDown(e: React.MouseEvent, idea: Idea) {
    e.preventDefault()
    e.stopPropagation()
    const pt = toSvgPt(e)
    const orig = getPos(idea.id)
    dragRef.current = { id: idea.id, startX: pt.x, startY: pt.y, origX: orig.x, origY: orig.y }
  }

  function handleSvgMove(e: React.MouseEvent) {
    const d = dragRef.current
    if (!d) return
    const pt = toSvgPt(e)
    const r = 20
    const nx = Math.max(r, Math.min(W - r, d.origX + (pt.x - d.startX)))
    const ny = Math.max(r, Math.min(H - r, d.origY + (pt.y - d.startY)))
    setOverrides(prev => ({ ...prev, [d.id]: { x: nx, y: ny } }))
  }

  function handleSvgUp(e: React.MouseEvent) {
    const d = dragRef.current
    if (!d) return
    const pt = toSvgPt(e)
    const moved = Math.hypot(pt.x - d.startX, pt.y - d.startY)

    if (moved < 5) {
      // Tap → select
      const next = d.id === selectedId ? null : d.id
      setSelectedId(next)
      if (next) onTouch(d.id)
    }
    dragRef.current = null
  }

  const isDragging = (id: string) => dragRef.current?.id === id
  const selectedIdea = ideas.find(i => i.id === selectedId) ?? null
  const selectedHeat = selectedIdea ? (heats[selectedIdea.id] ?? 0) : 0

  const sortedIdeas = useMemo(
    () => [...ideas].sort((a, b) => (heats[a.id] ?? 0) - (heats[b.id] ?? 0)),
    [ideas, heats]
  )

  return (
    <div className="relative w-full h-full" style={{ userSelect: 'none' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full rounded-2xl"
        style={{
          background: 'linear-gradient(135deg,#ede9fe 0%,#e0f2fe 50%,#fce7f3 100%)',
          cursor: dragRef.current ? 'grabbing' : 'default',
          touchAction: 'none',
        }}
        onMouseMove={handleSvgMove}
        onMouseUp={handleSvgUp}
        onMouseLeave={handleSvgUp}
      >
        {/* Grid */}
        {GRID_H.map(y => <line key={`h${y}`} x1={0} y1={y} x2={W} y2={y} stroke="#c4b5fd" strokeWidth="0.5" opacity="0.4" />)}
        {GRID_V.map(x => <line key={`v${x}`} x1={x} y1={0} x2={x} y2={H} stroke="#c4b5fd" strokeWidth="0.5" opacity="0.4" />)}

        {/* Islands */}
        {layout.centers.map((cc, i) => {
          const members = ideas.filter(idea => analysis?.ideaClusters[idea.id] === cc.name)
          const rx = Math.max(72, Math.min(115, 58 + members.length * 9))
          const ry = rx * 0.78
          return (
            <g key={cc.name}>
              <ellipse cx={cc.x} cy={cc.y} rx={rx} ry={ry}
                fill={ISLAND_FILL[i % ISLAND_FILL.length]}
                stroke={ISLAND_STROKE[i % ISLAND_STROKE.length]}
                strokeWidth="1.5"
                style={{ filter: 'drop-shadow(1px 2px 3px rgba(139,92,246,0.12))' }}
              />
              <ellipse cx={cc.x} cy={cc.y} rx={rx * 0.62} ry={ry * 0.62}
                fill="none" stroke={ISLAND_STROKE[i % ISLAND_STROKE.length]}
                strokeWidth="0.7" strokeDasharray="4 3" opacity="0.45" />
            </g>
          )
        })}

        {/* Connections */}
        {analysis?.connections.map((conn, ei) => {
          const from = ideas[conn.fromIndex], to = ideas[conn.toIndex]
          if (!from || !to) return null
          const p1 = getPos(from.id), p2 = getPos(to.id)
          return (
            <line key={ei}
              x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke="#a78bfa" strokeWidth={0.8 + conn.strength * 2}
              strokeDasharray="5 4"
              opacity={0.2 + conn.strength * 0.4}
              strokeLinecap="round"
            />
          )
        })}

        {/* Nodes */}
        {sortedIdeas.map(idea => {
          const pos   = getPos(idea.id)
          const heat  = heats[idea.id] ?? 0
          const r     = nodeRadius(heat)
          const color = markerColor(heat)
          const topic = analysis?.ideaTopics?.[idea.id]
          const isSel = idea.id === selectedId
          const isDrag = isDragging(idea.id)

          return (
            <g key={idea.id}
              onMouseDown={e => handleNodeDown(e, idea)}
              style={{ cursor: isDrag ? 'grabbing' : 'grab' }}
            >
              {isSel && (
                <circle cx={pos.x} cy={pos.y} r={r + 7}
                  fill="none" stroke={color} strokeWidth="2.5"
                  strokeDasharray="5 3" opacity="0.8" />
              )}

              {/* Shadow */}
              <circle cx={pos.x + 2} cy={pos.y + 3} r={r} fill="rgba(0,0,0,0.1)" />

              {/* Node */}
              <circle cx={pos.x} cy={pos.y} r={r}
                fill={color}
                stroke="white" strokeWidth="2"
                style={heat > 0.5 ? { filter: `drop-shadow(0 0 ${4 + heat * 6}px ${color}88)` } : undefined}
              />

              {/* Highlight */}
              <circle cx={pos.x - r * 0.25} cy={pos.y - r * 0.3} r={r * 0.32}
                fill="white" opacity={0.25} />

              {/* Label */}
              {(() => {
                const label = truncate(topic ?? idea.text, 11)
                const tw = label.length * 5.8 + 10
                return (
                  <g>
                    <rect x={pos.x - tw / 2} y={pos.y + r + 3} width={tw} height={15} rx={4}
                      fill="rgba(255,255,255,0.93)" stroke="#ddd6fe" strokeWidth="1" />
                    <text x={pos.x} y={pos.y + r + 13} textAnchor="middle"
                      fill="#4c1d95" fontSize="9.5" fontWeight="700">
                      {label}
                    </text>
                  </g>
                )
              })()}
              <title>{idea.text}</title>
            </g>
          )
        })}

        {/* Cluster badges */}
        {layout.centers.map((cc, i) => {
          const lw = cc.name.length * 8.5 + 20
          return (
            <g key={cc.name}>
              <rect x={cc.x - lw / 2} y={cc.y - 84} width={lw} height={19} rx={9}
                fill={ISLAND_STROKE[i % ISLAND_STROKE.length]} />
              <text x={cc.x} y={cc.y - 71} textAnchor="middle"
                fill="white" fontSize="10.5" fontWeight="800" letterSpacing="0.04em">
                {cc.name}
              </text>
            </g>
          )
        })}

        {/* Legend */}
        <g>
          <rect x={8} y={H - 82} width={122} height={76} rx={12}
            fill="rgba(255,255,255,0.9)" stroke="#ddd6fe" strokeWidth="1.5" />
          <text x={69} y={H - 66} textAnchor="middle" fill="#7c3aed" fontSize="9" fontWeight="800" letterSpacing="0.06em">
            思考の温度
          </text>
          {([
            { label: '注目・よく見る', heat: 0.9 },
            { label: '最近触れた',     heat: 0.5 },
            { label: 'しばらく放置',   heat: 0.1 },
          ] as const).map(({ label, heat }, i) => (
            <g key={label}>
              <circle cx={22} cy={H - 53 + i * 15} r={5}
                fill={markerColor(heat)} stroke="white" strokeWidth="1.5" />
              <text x={33} y={H - 49 + i * 15} fill="#6b7280" fontSize="8.5" fontWeight="500">{label}</text>
            </g>
          ))}
        </g>

        {/* Compass */}
        <g transform={`translate(${W - 30}, 28)`}>
          <circle cx={0} cy={0} r={18} fill="rgba(255,255,255,0.9)" stroke="#ddd6fe" strokeWidth="1.5" />
          {(['N','S','E','W'] as const).map((d, i) => {
            const rad = (i * 90 - 90) * Math.PI / 180
            return <text key={d} x={Math.cos(rad)*11} y={Math.sin(rad)*11+3.5}
              textAnchor="middle" fill="#7c3aed" fontSize="7.5" fontWeight="800">{d}</text>
          })}
          <polygon points="0,-10 3,0 0,3 -3,0" fill="#f43f5e" />
          <polygon points="0,10 3,0 0,-3 -3,0" fill="#7c3aed" />
        </g>

        {/* Hints */}
        {ideas.length === 0 && (
          <text x={W/2} y={H/2} textAnchor="middle" dominantBaseline="middle" fill="#a78bfa" fontSize="13">
            アイデアを追加すると地図が広がります
          </text>
        )}
        {ideas.length > 0 && !analysis && (
          <g>
            <rect x={W/2 - 125} y={H - 38} width={250} height={26} rx={13}
              fill="rgba(255,255,255,0.92)" stroke="#ddd6fe" strokeWidth="1" />
            <text x={W/2} y={H - 21} textAnchor="middle" fill="#7c3aed" fontSize="11" fontWeight="600">
              「AI で整理」を押すと島が現れます
            </text>
          </g>
        )}
      </svg>

      {/* Detail popup */}
      {selectedIdea && (
        <div className="absolute top-3 right-3 w-72 z-10 rounded-2xl border-2 p-4 shadow-xl"
          style={{ background: 'white', borderColor: '#ddd6fe' }}>
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-black text-sm leading-snug pr-2 text-ink">
              {analysis?.ideaTopics?.[selectedIdea.id] ?? (isUrl(selectedIdea.text) ? 'リンク' : 'メモ')}
            </h3>
            <button onClick={() => setSelectedId(null)}
              className="text-muted hover:text-ink text-lg leading-none">✕</button>
          </div>

          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted font-medium">思考の温度</span>
              <span className="text-xs font-black" style={{ color: markerColor(selectedHeat) }}>
                {Math.round(selectedHeat * 100)}°
              </span>
            </div>
            <div className="h-2 rounded-full bg-purple-100 overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${selectedHeat * 100}%`, background: `linear-gradient(90deg,#a5b4fc,${markerColor(selectedHeat)})` }} />
            </div>
          </div>

          {isUrl(selectedIdea.text) ? (
            <a href={selectedIdea.text} target="_blank" rel="noreferrer"
              className="text-xs text-blue-600 underline break-all block mb-3">
              {selectedIdea.text}
            </a>
          ) : (
            <p className="text-xs text-slate-600 bg-primary-light rounded-xl p-2 mb-3 leading-relaxed break-words">
              {selectedIdea.text}
            </p>
          )}

          <div className="flex flex-wrap gap-1.5 text-xs">
            {analysis?.ideaClusters[selectedIdea.id] && (
              <span className="px-2.5 py-0.5 rounded-full text-white font-bold"
                style={{ background: markerColor(selectedHeat) }}>
                {analysis.ideaClusters[selectedIdea.id]}
              </span>
            )}
            {(selectedIdea.viewCount ?? 0) > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-primary font-medium bg-primary-light">
                {selectedIdea.viewCount} 回タップ
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
