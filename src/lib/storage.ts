import type { AppState } from '../types'

const KEY = 'idea-map-v1'
const API_KEY_KEY = 'idea-map-apikey'

export function loadApiKey(): string {
  return localStorage.getItem(API_KEY_KEY) ?? import.meta.env.VITE_GEMINI_API_KEY ?? ''
}

export function saveApiKey(key: string): void {
  localStorage.setItem(API_KEY_KEY, key)
}

const exampleIdeas = [
  '大学の授業中にモバイルバッテリーを忘れる',
  '家でインターンシップ先のタスクをやる気にならない',
  '火曜日と金曜日にゴミステーションへゴミを捨てるのを忘れる',
  '学科の友達との授業資料・過去問の情報共有ができていない',
  '食堂がお昼に混みすぎている',
  '朝、アラームを止めた記憶がないまま遅刻ギリギリになる',
  '提出前のPCファイル名が「最終版」「最終版2」など増殖する',
  '部活の道具の持ち主が分からず管理できていない',
  '部活イベントごとの引き継ぎがうまくいかない',
  '論文の文献をどこまで参照すればよいかわからない',
  '眼科や歯医者の定期健診を忘れがち',
  'クレカ・PayPay・Suica・現金をまとめて管理できる家計簿アプリがない',
  'コンタクトレンズの定期配送を家にいなくて受け取れない',
  'LINEグループが多すぎて情報整理しづらい',
  '授業資料がPDFのみで、紙で見たい時に毎回印刷が面倒',
  'PCだと授業資料へ書き込みしづらく不便',
  '今まで配られた授業資料を見返しにくい',
  '誰がどの団体に所属しているのかわからない',
  '英語の学習が続かない',
  'ウィンドサーフィン部の練習動画はファイルが重く、保存・共有しにくい',
].map((text, i) => ({
  id: `example-${i + 1}`,
  text,
  timestamp: new Date(Date.UTC(2025, 0, 1, 0, i)).toISOString(),
}))

const defaultState: AppState = {
  topic: '大学生活の困りごと・改善したいこと',
  ideas: exampleIdeas,
  analysis: null,
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultState
    return { ...defaultState, ...JSON.parse(raw) }
  } catch {
    return defaultState
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(KEY, JSON.stringify(state))
}
