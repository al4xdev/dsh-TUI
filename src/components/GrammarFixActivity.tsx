import React from 'react'
import { Box, Text, useTerminalSize } from '../ui.js'
import { t } from '../i18n.js'
import { truncateToWidth } from '../ink/truncateToWidth.js'
import {
  GRAMMAR_FRAME_MS, GRAMMAR_JOKES, grammarReducedMotion, grammarTrailFrame,
} from './grammarFixPresentation.js'
import type { GrammarFixPresentation } from './grammarFixPresentation.js'

/** The original two-line Pi widget, plus DSH-only elapsed/cancel affordances. */
export function GrammarFixActivity({ presentation }: { presentation: GrammarFixPresentation }): React.ReactNode {
  const { columns } = useTerminalSize()
  const [frame, setFrame] = React.useState(0)
  const reducedMotion = grammarReducedMotion()
  React.useEffect(() => {
    setFrame(0)
    if (reducedMotion) return
    const timer = setInterval(() => setFrame(value => (value + 1) % 16), GRAMMAR_FRAME_MS)
    ;(timer as { unref?: () => void }).unref?.()
    return () => clearInterval(timer)
  }, [presentation.startedAt, reducedMotion])
  const width = Math.max(0, columns - 3)
  const context = `${presentation.language} · ${presentation.model}`
  const joke = t(GRAMMAR_JOKES[presentation.joke]!)
  const elapsed = Math.max(0, Math.floor((Date.now() - presentation.startedAt) / 1000))
  const fit = (text: string) => truncateToWidth(text.replace(/[\r\n\x1b]/g, ' '), width)
  return (
    <Box flexDirection="column" paddingLeft={2} paddingRight={1} marginBottom={1}>
      <Text wrap="truncate">{fit(`${grammarTrailFrame(frame, presentation.trail)} (${context})`)}</Text>
      <Text wrap="truncate">{fit(`💬 ${joke}`)}</Text>
      <Text color="subtle" wrap="truncate">{fit(`${t('grammar-correcting')} · ${elapsed}s · ${t('grammar-cancel-hint')}`)}</Text>
    </Box>
  )
}
