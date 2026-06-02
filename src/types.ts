export type Energy = 'high' | 'medium' | 'low'

export interface Idea {
  id: string
  text: string
  timestamp: string
  viewCount?: number
  lastViewed?: string
}

export interface Cluster {
  name: string
  count: number
  color: string
  description: string
}

export interface Connection {
  fromIndex: number
  toIndex: number
  strength: number  // 0-1
  reason?: string   // 関係性の説明
}

export interface Keyword {
  word: string
  count: number
}

export interface AnalysisResult {
  clusters: Cluster[]
  ideaClusters: Record<string, string>
  ideaEnergies: Record<string, Energy>
  ideaTopics: Record<string, string>
  ideaSummaries: Record<string, string>
  connections: Connection[]
  keywords: Keyword[]
  summary: string
  nextActions: string[]
  analyzedAt: string
}

export interface AppState {
  topic: string
  ideas: Idea[]
  analysis: AnalysisResult | null
}
