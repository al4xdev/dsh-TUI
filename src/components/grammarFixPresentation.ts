import { t } from '../i18n.js'

// Adapted from https://github.com/al4xdev/pi-grammar-fix (Copyright 2026 al4xdev, MIT).
// Original license: plugins/grammar-fix/LICENSE.pi-grammar-fix in dsh-customs.
export const TRAIL_THEMES = [
  { walker: '✍️ ', dirty: '❌', clean: '✨' },
  { walker: '🪄 ', dirty: '🐛', clean: '🦋' },
  { walker: '🧹 ', dirty: '💩', clean: '🧼' },
  { walker: '🔍 ', dirty: '❓', clean: '✅' },
  { walker: '🚀 ', dirty: '🐌', clean: '⚡' },
] as const
export const GRAMMAR_JOKES = [
  'grammar-joke-0', 'grammar-joke-1', 'grammar-joke-2', 'grammar-joke-3',
  'grammar-joke-4', 'grammar-joke-5', 'grammar-joke-6', 'grammar-joke-7',
  'grammar-joke-8', 'grammar-joke-9', 'grammar-joke-10', 'grammar-joke-11',
  'grammar-joke-12', 'grammar-joke-13',
] as const
export const GRAMMAR_ICONS = [
  '✍️', '✏️', '📝', '📄', '🖊️', '🖋️', '🖌️', '✒️', '📌', '📎',
  '🗒️', '📑', '📚', '📖', '🔍', '🔎', '💡', '✨', '⭐', '🌟',
  '🎯', '🚀', '⚡', '🔥', '🧠', '💬', '💭', '🗨️', '✅', '✔️',
  '☑️', '✓', '⚠️', '❌', '🔄', '⏳', '⌛', '📏', '📐', '✂️',
  '🧹', '🪄', '🔧', '🛠️', '🧩', '📂', '🗂️', '🏆', '🎉', '👏', '💪',
] as const
export const GRAMMAR_FRAME_MS = 150
export const GRAMMAR_TRAIL_LENGTH = 8

export interface GrammarFixMetadata {
  /** Human language label and model ID (without provider), resolved by the bridge. */
  language: string
  model: string
  naturalTips?: boolean
}
export interface GrammarFixProgress {
  language?: string
  model?: string
  phase?: string
}
export interface GrammarFixBridge {
  describe: (current: { provider?: string; model?: string }) => GrammarFixMetadata
  fix: (text: string, current: { provider?: string; model?: string }, signal?: AbortSignal,
    onProgress?: (message: string, metadata?: GrammarFixProgress) => void) => Promise<string>
  suggestTip?: (original: string, corrected: string, current: { provider?: string; model?: string }, signal?: AbortSignal) => Promise<string>
}
export interface GrammarFixPresentation extends GrammarFixMetadata {
  startedAt: number
  joke: number
  trail: number
}

/** Pick once per operation, never once per render. Random/clock injection keeps tests pure. */
export function createGrammarFixPresentation(metadata: GrammarFixMetadata, random = Math.random, now = Date.now): GrammarFixPresentation {
  return {
    language: metadata.language || t('grammar-language-auto'),
    model: metadata.model || t('grammar-session-model'),
    startedAt: now(),
    joke: Math.floor(random() * GRAMMAR_JOKES.length),
    trail: Math.floor(random() * TRAIL_THEMES.length),
  }
}
export function grammarFixSuccess(unchanged: boolean, random = Math.random): string {
  return `${GRAMMAR_ICONS[Math.floor(random() * GRAMMAR_ICONS.length)]} ${t(unchanged ? 'grammar-no-changes' : 'grammar-fixed')}`
}
/** Pi repeats each endpoint once: 0..7,7..0,0..7 (not a 14-frame wave). */
export function grammarTrailStep(frame: number): number {
  const phase = ((Math.floor(frame) % 16) + 16) % 16
  return phase < GRAMMAR_TRAIL_LENGTH ? phase : 15 - phase
}
export function grammarTrailFrame(frame: number, trail: number): string {
  const theme = TRAIL_THEMES[trail % TRAIL_THEMES.length]!
  const step = grammarTrailStep(frame)
  return Array.from({ length: GRAMMAR_TRAIL_LENGTH }, (_, index) => index < step ? theme.clean : index === step ? theme.walker : theme.dirty).join(' ')
}

/** NO_COLOR controls color, not animation; motion has its own explicit opt-out. */
export function grammarReducedMotion(env: Record<string, string | undefined> = process.env): boolean {
  return env.DSH_GRAMMAR_REDUCED_MOTION === '1'
}
