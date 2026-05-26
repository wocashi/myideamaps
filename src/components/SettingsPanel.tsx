import { useState } from 'react'
import { loadApiKey, saveApiKey } from '../lib/storage'

interface Props {
  topic: string
  ideaCount: number
  onUpdateTopic: (t: string) => void
  onClearData: () => void
  onClose: () => void
}

export default function SettingsPanel({ topic, ideaCount, onUpdateTopic, onClearData, onClose }: Props) {
  const [draft, setDraft] = useState(topic)
  const [apiKey, setApiKey] = useState(loadApiKey)
  const [savedTopic, setSavedTopic] = useState(false)
  const [savedKey, setSavedKey] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [showKey, setShowKey] = useState(false)

  const saveTopic = () => {
    if (!draft.trim()) return
    onUpdateTopic(draft.trim())
    setSavedTopic(true)
    setTimeout(() => setSavedTopic(false), 2000)
  }

  const handleSaveKey = () => {
    saveApiKey(apiKey.trim())
    setSavedKey(true)
    setTimeout(() => setSavedKey(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-border">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-ink">設定</h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-xl leading-none">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {/* API Key */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted uppercase tracking-wider">
              Gemini API キー
            </label>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="input-base flex-1 font-mono text-xs"
              />
              <button
                onClick={() => setShowKey(v => !v)}
                className="btn-ghost px-2 text-lg"
                title={showKey ? '隠す' : '表示'}
              >
                {showKey ? '🙈' : '👁'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleSaveKey} className="btn-primary">保存</button>
              {savedKey && <span className="text-emerald-600 text-sm">✓ 保存しました</span>}
            </div>
            <p className="text-xs text-muted">
              <a href="https://aistudio.google.com" target="_blank" rel="noreferrer"
                className="text-primary underline">aistudio.google.com</a> から無料取得。ブラウザに安全に保存されます。
            </p>
            <p className="text-xs">
              ステータス:{' '}
              {loadApiKey()
                ? <span className="text-emerald-600 font-medium">設定済み ✓</span>
                : <span className="text-red-500 font-medium">未設定</span>}
            </p>
          </div>

          {/* Topic */}
          <div className="space-y-2 pt-1 border-t border-border">
            <label className="text-xs font-semibold text-muted uppercase tracking-wider">ブレストテーマ</label>
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="input-base"
              placeholder="例: 新しいサービスのアイデア"
            />
            <div className="flex items-center gap-2">
              <button onClick={saveTopic} className="btn-primary">保存</button>
              {savedTopic && <span className="text-emerald-600 text-sm">✓ 保存しました</span>}
            </div>
          </div>

          {/* Clear */}
          <div className="space-y-2 pt-1 border-t border-border">
            <label className="text-xs font-semibold text-red-400 uppercase tracking-wider">データ管理</label>
            <p className="text-xs text-muted">{ideaCount} 件のアイデアが保存されています</p>
            {!confirmClear ? (
              <button onClick={() => setConfirmClear(true)}
                className="text-sm text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-4 py-1.5 rounded-lg transition-colors">
                すべて削除
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => { onClearData(); setConfirmClear(false); onClose() }}
                  className="bg-red-500 hover:bg-red-600 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">
                  削除する
                </button>
                <button onClick={() => setConfirmClear(false)} className="btn-ghost">キャンセル</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
