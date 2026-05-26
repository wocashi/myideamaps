import type { AnalysisResult, Idea } from '../types'

const CLUSTER_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ec4899',
  '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16',
]

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 },
      }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Gemini API error: ${res.status}`)
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

export async function analyzeIdeas(
  ideas: Idea[],
  topic: string,
  apiKey: string,
): Promise<AnalysisResult> {
  const numbered = ideas.map((idea, i) => `[${i}] ${idea.text}`).join('\n')

  const prompt = `
You are an idea and information organizer. Analyze the following memos.
If a memo contains a URL, infer its topic from the domain and path.
Reply ONLY with a JSON object — no markdown, no explanation.

Theme: ${topic}

Memos:
${numbered}

Return this exact JSON structure:
{
  "ideaTopics": [
    { "index": 0, "inferredTopic": "short topic label (max 10 chars in Japanese)" }
  ],
  "ideaSummaries": [
    { "index": 0, "summary": "1-2 sentence description in Japanese: for URLs describe what the site/page is about; for regular memos elaborate the concept briefly (max 80 chars)" }
  ],
  "clusters": [
    { "name": "cluster name (max 8 chars in Japanese)", "description": "brief description" }
  ],
  "ideaAnalysis": [
    { "index": 0, "cluster": "cluster name", "energy": "high|medium|low", "keywords": ["kw1","kw2"] }
  ],
  "connections": [
    { "from": 0, "to": 1, "strength": 0.9, "reason": "reason in Japanese (max 8 chars)" }
  ],
  "summary": "overall insight in Japanese (max 200 chars)",
  "nextActions": ["action1 in Japanese", "action2 in Japanese", "action3 in Japanese"]
}

Rules:
- 2 to 6 clusters
- connections: max 25 pairs, strength 0.3-1.0, no self-loops (from !== to)
- energy: high=impactful, medium=normal, low=minor reference
- ALL text values in Japanese
`

  const raw = await callGemini(prompt, apiKey)

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Geminiの応答を解析できませんでした')
  const parsed = JSON.parse(jsonMatch[0])

  const ideaTopicMap: Record<string, string> = {}
  for (const it of (parsed.ideaTopics ?? [])) {
    const idea = ideas[it.index]
    if (idea) ideaTopicMap[idea.id] = it.inferredTopic
  }

  const ideaSummaryMap: Record<string, string> = {}
  for (const is of (parsed.ideaSummaries ?? [])) {
    const idea = ideas[is.index]
    if (idea) ideaSummaryMap[idea.id] = is.summary
  }

  const ideaClusters: Record<string, string> = {}
  const ideaEnergies: Record<string, 'high' | 'medium' | 'low'> = {}
  const keywordMap: Record<string, number> = {}

  for (const ia of (parsed.ideaAnalysis ?? [])) {
    const idea = ideas[ia.index]
    if (!idea) continue
    ideaClusters[idea.id] = ia.cluster
    ideaEnergies[idea.id] = ia.energy ?? 'medium'
    for (const kw of (ia.keywords ?? [])) {
      keywordMap[kw] = (keywordMap[kw] ?? 0) + 1
    }
  }

  const clusterCountMap: Record<string, number> = {}
  for (const c of Object.values(ideaClusters)) {
    clusterCountMap[c] = (clusterCountMap[c] ?? 0) + 1
  }

  const clusters = (parsed.clusters ?? []).map(
    (c: { name: string; description: string }, i: number) => ({
      name: c.name,
      count: clusterCountMap[c.name] ?? 0,
      color: CLUSTER_COLORS[i % CLUSTER_COLORS.length],
      description: c.description,
    })
  )

  const connections = (parsed.connections ?? [])
    .filter((c: { from: number; to: number }) =>
      c.from !== c.to && ideas[c.from] && ideas[c.to]
    )
    .map((c: { from: number; to: number; strength: number; reason?: string }) => ({
      fromIndex: c.from,
      toIndex: c.to,
      strength: Math.max(0.1, Math.min(1, c.strength)),
      reason: c.reason ?? '',
    }))

  const keywords = Object.entries(keywordMap)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30)

  return {
    clusters,
    ideaClusters,
    ideaEnergies,
    ideaTopics: ideaTopicMap,
    ideaSummaries: ideaSummaryMap,
    connections,
    keywords,
    summary: parsed.summary ?? '',
    nextActions: parsed.nextActions ?? [],
    analyzedAt: new Date().toISOString(),
  }
}
