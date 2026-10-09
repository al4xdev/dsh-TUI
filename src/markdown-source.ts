import { marked, type Token } from 'marked'
import { configureMarked } from './terminal-utils/markdown.js'

/** Source coordinates, never terminal rows. The caller binds these to revision/hash. */
export interface MarkdownSourceRange {
  readonly startLine: number
  readonly endLine: number
  readonly quote: string
}

export interface MarkdownSourceBlock extends MarkdownSourceRange {
  readonly type: string
}

/** Keep each list item selectable without losing native list formatting/numbering. */
export function markdownNavigationTokens(tokens: readonly Token[]): Token[] {
  return tokens.flatMap(token => token.type === 'list'
    ? token.items.map((item, index) => ({ ...token, raw: item.raw, items: [item],
      start: token.ordered ? Number(token.start) + index : token.start }))
    : [token])
}

/** Select exact 1-based source lines; CRLF is retained in quoted context. */
export function markdownSourceRange(source: string, startLine: number, endLine = startLine): MarkdownSourceRange {
  const lines = source.split('\n')
  if (!Number.isSafeInteger(startLine) || !Number.isSafeInteger(endLine) ||
      startLine < 1 || endLine < startLine || endLine > lines.length) {
    throw new RangeError('Markdown source range must identify existing 1-based lines')
  }
  return { startLine, endLine, quote: lines.slice(startLine - 1, endLine).join('\n') }
}

/** Match lexer blocks to immutable source, including gaps such as link definitions. */
export function markdownTokenRanges(source: string, tokens: readonly Token[]): (MarkdownSourceBlock | null)[] {
  const normalized = source.replace(/\r\n/g, '\n')
  let cursor = 0
  return tokens.map(token => {
    const raw = token.raw.replace(/\r\n/g, '\n')
    const start = normalized.indexOf(raw, cursor)
    if (start < 0 || !raw) throw new Error('Markdown block cannot be mapped to its source')
    cursor = start + raw.length
    if (token.type === 'space' || token.type === 'def' || !raw.trim()) return null
    const startLine = normalized.slice(0, start).split('\n').length
    const endLine = startLine + raw.trimEnd().split('\n').length - 1
    return { ...markdownSourceRange(source, startLine, endLine), type: token.type }
  })
}

/** Navigation anchors: wrapped text, tables and diagrams keep their whole source block. */
export function markdownSourceBlocks(source: string): MarkdownSourceBlock[] {
  configureMarked()
  return markdownTokenRanges(source, markdownNavigationTokens(marked.lexer(source))).filter((range): range is MarkdownSourceBlock => range !== null)
}
