/**
 * Fork regression for `externalPlanCommand` (FORK.md "External /plan command").
 *
 *   1. Completion: with the flag, `/plan` children come from tuiCommandTrees
 *      (the external command's own grammar); without it, native on/off stay.
 *   2. Chat source: the flag dispatches the registry command before the
 *      native picker and the `on` normalization.
 *   3. Shift+Tab source: the flag strips plan atoms from the mode cycle.
 *
 * Run: node --import tsx/esm scripts/verify-external-plan.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createCommandCompletions } from '../src/dsh-adapter/channel/command-completions.js'

const state = { commandList: [{ name: 'plan', description: 'Managed plans' }], externalPlanCommand: true } as never
const tree = (path: readonly string[]) => path.length === 1 && path[0] === 'plan'
  ? [{ name: 'new', description: 'Create plan artifacts' }, { name: 'auto', description: 'Configure autoApprove' }]
  : []
const complete = createCommandCompletions({
  state: () => state,
  themeHost: {} as never,
  commandTrees: { children: tree },
  workspaceCommands: () => [],
  model: {
    warmModelNodes() {}, modelNodes: () => [], warmPresetOptions() {}, presetOptions: () => [], warmEffortLevels() {},
  },
})
assert.deepEqual(complete('/plan ').map(item => item.name), ['plan new', 'plan auto'])
;(state as { externalPlanCommand: boolean }).externalPlanCommand = false
assert.deepEqual(complete('/plan ').map(item => item.name), ['plan on', 'plan off'])
console.log('PASS: external /plan completes from its command tree; native /plan keeps on/off.')

const chat = readFileSync(new URL('../src/screens/Chat.tsx', import.meta.url), 'utf8')
const planCase = chat.slice(chat.indexOf("case 'plan': {"), chat.indexOf("case 'add-dir':"))
const external = planCase.indexOf('channel.externalPlanCommand')
assert.ok(external > 0, 'Chat /plan case reads externalPlanCommand')
assert.ok(external < planCase.indexOf("kind: 'plan'"), 'external dispatch precedes the native picker')
assert.ok(external < planCase.indexOf("parts[0] === 'on'"), 'external dispatch precedes the on normalization')
assert.match(planCase.slice(external, planCase.indexOf("kind: 'plan'")), /runExternalCommand\('plan', rawInput, images\)/)
console.log('PASS: Chat routes external /plan verbatim, before the native picker.')

const extensions = readFileSync(new URL('../src/dsh-adapter/channel/extensions.ts', import.meta.url), 'utf8')
assert.match(extensions, /options\.externalPlanCommand !== true\s*\? cycleModes/)
assert.match(extensions, /filter\(spec => spec\.plan !== true\)\.map\(\(\{ plan: _plan, \.\.\.spec \}\) => spec\)/)
console.log('PASS: Shift+Tab cycle drops native plan atoms under externalPlanCommand.')
