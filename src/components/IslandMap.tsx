import { useMemo } from 'react'
import type { Idea, AnalysisResult } from '../types'

interface Props {
  ideas: Idea[]
  analysis: AnalysisResult | null
}

// Portrait viewBox to match the sidebar-beside layout
const W = 520
const H = 620

const PALETTES = [
  { fill: '#dbeafe', stroke: '#93c5fd', dot: '#1d4ed8', label: '#1e40af' },
  { fill: '#dcfce7', stroke: '#86efac', dot: '#16a34a', label: '#166534' },
  { fill: '#fef9c3', stroke: '#fde047', dot: '#ca8a04', label: '#854d0e' },
  { fill: '#fce7f3', stroke: '#f9a8d4', dot: '#db2777', label: '#9d174d' },
  { fill: '#ede9fe', stroke: '#c4b5fd', dot: '#7c3aed', label: '#5b21b6' },
  { fill: '#ffedd5', stroke: '#fdba74', dot: '#ea580c', label: '#9a3412' },
]

function hash(s: string, salt: number) {
  let h = salt * 2654435761
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 2654435761)
  return (h >>> 0) / 0xffffffff
}

function ideaDotPos(id: string, cx: number, cy: number, rx: number, ry: number) {
  const angle = hash(id, 1) * 2 * Math.PI
  const dist = Math.sqrt(hash(id, 2)) * 0.75
  return { x: cx + rx * dist * Math.cos(angle), y: cy + ry * dist * Math.sin(angle) }
}

// Fibonacci spiral – spread relative to actual count so small numbers still spread out nicely
function fibPos(i: number, total: number, cx: number, cy: number, maxR: number) {
  const golden = 2.399963
  const r = maxR * Math.sqrt((i + 1) / Math.max(total * 1.3, 15))
  const theta = i * golden
  return { x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) }
}

function clusterPositions(n: number) {
  const cx = W / 2, cy = H / 2 - 20
  if (n === 0) return []
  if (n === 1) return [{ x: cx, y: cy }]
  // arrange in a circle, shifted up slightly to give label room
  const spread = n <= 3 ? 0.24 : n <= 5 ? 0.28 : 0.30
  const radius = Math.min(W, H) * spread
  return Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
  })
}

export default function IslandMap({ ideas, analysis }: Props) {
  const clusters = analysis?.clusters ?? []
  const positions = useMemo(() => clusterPositions(clusters.length), [clusters.length])

  const islandRx = (count: number) => Math.max(58, Math.min(105, 46 + count * 9))
  const islandRy = (rx: number) => rx * 0.80

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full rounded-2xl select-none"
      preserveAspectRatio="xMidYMid meet"
      style={{ background: 'linear-gradient(160deg, #e0f0ff 0%, #dbeafe 55%, #e8f4fd 100%)' }}
    >
      <defs>
        {/* subtle wave pattern */}
        <pattern id="wave" x="0" y="0" width="52" height="26" patternUnits="userSpaceOnUse">
          <path d="M0 13 Q13 6 26 13 Q39 20 52 13" fill="none" stroke="rgba(147,197,253,0.22)" strokeWidth="1" />
        </pattern>
        {/* island gradients */}
        {PALETTES.map((p, i) => (
          <radialGradient key={i} id={`ig${i}`} cx="38%" cy="32%" r="68%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
            <stop offset="45%" stopColor={p.stroke} stopOpacity="0.5" />
            <stop offset="100%" stopColor={p.fill} stopOpacity="0.88" />
          </radialGradient>
        ))}
        <filter id="islandShadow">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#1e40af" floodOpacity="0.10" />
        </filter>
        <filter id="dotGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* sea texture */}
      <rect width={W} height={H} fill="url(#wave)" />

      {/* decorative horizon line */}
      <line x1="0" y1={H * 0.88} x2={W} y2={H * 0.88} stroke="rgba(147,197,253,0.2)" strokeWidth="1" strokeDasharray="6 8" />

      {/* ── PRE-ANALYSIS: fibonacci spiral dots ── */}
      {!analysis && ideas.map((idea, i) => {
        const { x, y } = fibPos(i, ideas.length, W / 2, H / 2, Math.min(W, H) * 0.34)
        return (
          <g key={idea.id}>
            {/* glow ring */}
            <circle cx={x} cy={y} r={9} fill="#93c5fd" opacity={0.15} />
            <circle cx={x} cy={y} r={5.5} fill="#3b82f6" opacity={0.45}>
              <title>{idea.text}</title>
            </circle>
          </g>
        )
      })}

      {/* ── POST-ANALYSIS: islands ── */}
      {clusters.map((cluster, i) => {
        const pos = positions[i]
        if (!pos) return null
        const rx = islandRx(cluster.count)
        const ry = islandRy(rx)
        const pal = PALETTES[i % PALETTES.length]
        const clusterIdeas = ideas.filter(idea => analysis?.ideaClusters[idea.id] === cluster.name)

        return (
          <g key={cluster.name} filter="url(#islandShadow)">
            {/* shore / outer ring */}
            <ellipse cx={pos.x} cy={pos.y} rx={rx + 8} ry={ry + 6} fill={pal.stroke} opacity={0.25} />
            {/* island body */}
            <ellipse cx={pos.x} cy={pos.y} rx={rx} ry={ry} fill={`url(#ig${i})`} stroke={pal.stroke} strokeWidth="1.5" />
            {/* inner highlight */}
            <ellipse cx={pos.x - rx * 0.2} cy={pos.y - ry * 0.25} rx={rx * 0.35} ry={ry * 0.22}
              fill="white" opacity={0.25} />

            {/* idea dots */}
            {clusterIdeas.map(idea => {
              const { x, y } = ideaDotPos(idea.id, pos.x, pos.y, rx * 0.78, ry * 0.78)
              return (
                <g key={idea.id}>
                  <circle cx={x} cy={y} r={7} fill={pal.dot} opacity={0.12} />
                  <circle cx={x} cy={y} r={4.5} fill={pal.dot} opacity={0.80}>
                    <title>{idea.text}</title>
                  </circle>
                </g>
              )
            })}

            {/* cluster label pill */}
            <rect x={pos.x - 44} y={pos.y + ry + 10} width={88} height={22} rx={11}
              fill={pal.fill} stroke={pal.stroke} strokeWidth="1.2" />
            <text x={pos.x} y={pos.y + ry + 25} textAnchor="middle"
              fill={pal.label} fontSize="11" fontWeight="700">
              {cluster.name}
            </text>
          </g>
        )
      })}

      {/* empty state */}
      {ideas.length === 0 && (
        <g>
          <text x={W / 2} y={H / 2 - 10} textAnchor="middle" fill="#93c5fd" fontSize="32">🏝</text>
          <text x={W / 2} y={H / 2 + 24} textAnchor="middle" fill="#94a3b8" fontSize="13">
            アイデアを追加すると島が現れます
          </text>
        </g>
      )}

      {/* pre-analysis hint */}
      {ideas.length > 0 && !analysis && (
        <g>
          <rect x={W / 2 - 110} y={H - 36} width={220} height={24} rx={12} fill="white" opacity={0.7} />
          <text x={W / 2} y={H - 20} textAnchor="middle" fill="#64748b" fontSize="11.5" fontWeight="500">
            「AI で整理」を押すと島に分類されます
          </text>
        </g>
      )}
    </svg>
  )
}
