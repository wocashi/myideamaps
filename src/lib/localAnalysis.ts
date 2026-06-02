import type { AnalysisResult, Idea } from '../types'

const CLUSTER_COLORS = [
  '#4a7c59', '#7c5c4a', '#4a627c', '#7c4a6a',
  '#6a7c4a', '#7c6a4a', '#4a7c72', '#7c784a',
]
const STOP = new Set([
  'の','に','は','を','た','が','で','て','と','し','れ','さ','ある','いる',
  'する','なる','ない','から','こと','ので','ため','これ','それ','この','その',
  'もの','とき','よう','ほど','まで','など','でも','また','しかし','そして',
  'という','として','について','ところ','ように','ていく','てい','てく','って',
  'です','ます','した','して','しい','ない','たい','られ','でき',
])

// Tokenize with word-priority: prefer longer chunks, bigrams only as fallback
function tokenize(text: string, forNaming = false): string[] {
  const tokens: string[] = []
  // Split into word-like chunks first
  const chunks = text.split(/[\s、。！？「」『』【】（）\(\)\[\],.!?\-_/]+/)
  for (const w of chunks) {
    if (w.length >= 2 && !STOP.has(w)) tokens.push(w)
  }
  // CJK bigrams only when not used for naming (for vector similarity)
  if (!forNaming) {
    for (let i = 0; i < text.length - 1; i++) {
      const bi = text.slice(i, i + 2)
      if (/[぀-鿿]{2}/.test(bi) && !STOP.has(bi)) tokens.push(bi)
    }
  }
  return tokens
}

// Extract best label word from a set of ideas (for cluster naming)
function extractLabel(texts: string[]): string {
  const freq = new Map<string, number>()
  for (const text of texts) {
    // Count words of 2+ chars that are not stop words
    const words = text.split(/[\s、。！？「」『』【】（）\(\)\[\],.!?\-_/]+/)
      .filter(w => w.length >= 2 && !STOP.has(w))
    const seen = new Set(words)
    seen.forEach(w => freq.set(w, (freq.get(w) ?? 0) + 1))
  }
  if (freq.size === 0) return texts[0]?.slice(0, 6) ?? 'テーマ'
  // Prefer words that appear in multiple ideas, and are reasonably long
  const scored = [...freq.entries()]
    .map(([w, c]) => ({ w, score: c * Math.min(w.length, 5) }))
    .sort((a, b) => b.score - a.score)
  return scored[0]?.w?.slice(0, 8) ?? 'テーマ'
}

function buildTfidf(ideas: Idea[]): { vecs: number[][]; vocab: string[] } {
  const tokenSets = ideas.map(i => tokenize(i.text))
  const vocabSet = new Set<string>()
  tokenSets.forEach(ts => ts.forEach(t => vocabSet.add(t)))
  const vocab = [...vocabSet]
  const V = vocab.length
  const idx = new Map(vocab.map((w, i) => [w, i]))

  // IDF
  const df = new Float64Array(V)
  for (const ts of tokenSets) {
    const seen = new Set(ts)
    seen.forEach(t => { const i = idx.get(t); if (i !== undefined) df[i]++ })
  }
  const idf = df.map(d => Math.log((ideas.length + 1) / (d + 1)) + 1)

  // TF-IDF vectors (normalized)
  const vecs = tokenSets.map(ts => {
    const tf = new Float64Array(V)
    for (const t of ts) { const i = idx.get(t); if (i !== undefined) tf[i]++ }
    const vec = Array.from(tf).map((v, i) => (v / Math.max(ts.length, 1)) * idf[i])
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0))
    return norm > 0 ? vec.map(v => v / norm) : vec
  })

  return { vecs, vocab }
}

function cosine(a: number[], b: number[]): number {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return Math.max(0, Math.min(1, dot))
}

function kmeans(vecs: number[][], k: number): number[] {
  const n = vecs.length
  if (n <= k) return vecs.map((_, i) => i % k)

  // k-means++ init
  const centroids: number[][] = [vecs[Math.floor(n / 2)].slice()]
  while (centroids.length < k) {
    const dists = vecs.map(v => {
      const best = centroids.reduce((mn, c) => {
        const d = 1 - cosine(v, c); return d < mn ? d : mn
      }, Infinity)
      return best * best
    })
    const total = dists.reduce((s, d) => s + d, 0)
    let r = Math.random() * total
    let pick = 0
    while (r > 0 && pick < n - 1) { r -= dists[pick]; pick++ }
    centroids.push(vecs[pick].slice())
  }

  let assigns = new Array(n).fill(0)
  for (let iter = 0; iter < 25; iter++) {
    const next = vecs.map(v => {
      let best = 0, bestSim = -1
      for (let ki = 0; ki < k; ki++) {
        const s = cosine(v, centroids[ki])
        if (s > bestSim) { bestSim = s; best = ki }
      }
      return best
    })
    if (next.every((a, i) => a === assigns[i])) break
    assigns = next
    // Update centroids
    for (let ki = 0; ki < k; ki++) {
      const members = vecs.filter((_, i) => assigns[i] === ki)
      if (!members.length) continue
      const dim = members[0].length
      for (let d = 0; d < dim; d++) {
        centroids[ki][d] = members.reduce((s, v) => s + v[d], 0) / members.length
      }
    }
  }
  return assigns
}

function topWords(vecs: number[][], vocab: string[], indices: number[], top = 3): string[] {
  if (!indices.length) return []
  const avg = new Array(vocab.length).fill(0)
  for (const i of indices) vecs[i].forEach((v, d) => { avg[d] += v })
  const n = indices.length
  return vocab
    .map((w, i) => ({ w, s: avg[i] / n }))
    .sort((a, b) => b.s - a.s)
    .slice(0, top)
    .map(x => x.w)
}

export function analyzeIdeasLocal(ideas: Idea[]): AnalysisResult {
  if (ideas.length < 2) throw new Error('2件以上のアイデアが必要です')

  const { vecs, vocab } = buildTfidf(ideas)

  // Choose k
  const k = Math.max(2, Math.min(5, Math.floor(ideas.length / 3)))
  const assigns = kmeans(vecs, k)

  // Build clusters
  const clusterMembers: Record<number, number[]> = {}
  assigns.forEach((ki, i) => {
    if (!clusterMembers[ki]) clusterMembers[ki] = []
    clusterMembers[ki].push(i)
  })

  const usedKs = [...new Set(assigns)].sort()
  const clusters = usedKs.map((ki, ci) => {
    const members = clusterMembers[ki] ?? []
    const memberTexts = members.map(i => ideas[i].text)
    const name = extractLabel(memberTexts)
    const words = topWords(vecs, vocab, members, 3)
    return {
      name,
      count: members.length,
      color: CLUSTER_COLORS[ci % CLUSTER_COLORS.length],
      description: words.join(', '),
    }
  })

  const ideaClusters: Record<string, string> = {}
  assigns.forEach((ki, i) => {
    const ci = usedKs.indexOf(ki)
    ideaClusters[ideas[i].id] = clusters[ci]?.name ?? ''
  })

  // ideaTopics: most meaningful word per idea
  const ideaTopics: Record<string, string> = {}
  ideas.forEach(idea => {
    const label = extractLabel([idea.text])
    ideaTopics[idea.id] = label.slice(0, 10)
  })

  // Energy: based on vector magnitude (richness of text)
  const ideaEnergies: Record<string, 'high' | 'medium' | 'low'> = {}
  const mags = vecs.map(v => Math.sqrt(v.reduce((s, x) => s + x * x, 0)))
  const maxMag = Math.max(...mags, 0.001)
  ideas.forEach((idea, i) => {
    const ratio = mags[i] / maxMag
    ideaEnergies[idea.id] = ratio > 0.6 ? 'high' : ratio > 0.3 ? 'medium' : 'low'
  })

  // Connections: top similarity pairs
  const pairs: { from: number; to: number; strength: number }[] = []
  for (let i = 0; i < ideas.length; i++) {
    for (let j = i + 1; j < ideas.length; j++) {
      const s = cosine(vecs[i], vecs[j])
      if (s > 0.15) pairs.push({ from: i, to: j, strength: s })
    }
  }
  pairs.sort((a, b) => b.strength - a.strength)
  const connections = pairs.slice(0, 20).map(p => ({
    fromIndex: p.from,
    toIndex: p.to,
    strength: p.strength,
    reason: '',
  }))

  // Global keywords
  const kwMap: Record<string, number> = {}
  vecs.forEach(v => {
    v.forEach((val, di) => { if (val > 0) kwMap[vocab[di]] = (kwMap[vocab[di]] ?? 0) + val })
  })
  const keywords = Object.entries(kwMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word, count]) => ({ word, count }))

  const clusterNames = clusters.map(c => c.name).join('、')
  const summary = `${ideas.length}件のアイデアを${clusters.length}つのテーマに整理しました：${clusterNames}`

  return {
    clusters,
    ideaClusters,
    ideaEnergies,
    ideaTopics,
    ideaSummaries: {},
    connections,
    keywords,
    summary,
    nextActions: clusters.map(c => `「${c.name}」を深掘りする`),
    analyzedAt: new Date().toISOString(),
  }
}
