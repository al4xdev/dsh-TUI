/** Source regression: node --import tsx/esm scripts/verify-managed-plan-completions.ts */
import assert from 'node:assert/strict'
import { createCommandCompletions } from '../src/dsh-adapter/channel/command-completions.js'
import { setLang, tOr } from '../src/i18n.js'
import { localizedDescription } from '../src/commands.js'
import { annotateCommandCapabilities, resolveAgentCapabilities } from '../src/dsh-adapter/channel/capabilities.js'
import { TIPS } from '../src/tips.js'

const state = { commandList: [{ name: 'plan', description: 'Managed plans' }], externalPlanCommand: true } as never
const complete = createCommandCompletions({
  state: () => state,
  themeHost: {} as never,
  workspaceCommands: () => [],
  model: {
    warmModelNodes() {}, modelNodes: () => [], warmPresetOptions() {}, presetOptions: () => [], warmEffortLevels() {},
  },
})
const root = complete('/plan ').map(item => item.name)
if (JSON.stringify(root) !== JSON.stringify(['plan new', 'plan auto'])) {
  throw new Error(`managed /plan suggestions are wrong: ${JSON.stringify(root)}`)
}
const auto = complete('/plan auto ').map(item => item.name)
if (JSON.stringify(auto) !== JSON.stringify(['plan auto on', 'plan auto off', 'plan auto status'])) {
  throw new Error(`managed /plan auto suggestions are wrong: ${JSON.stringify(auto)}`)
}
console.log('PASS: managed /plan completion omits legacy on/off and offers new/auto controls.')

setLang('en')
assert.match(complete('/plan ')[0]!.description, /project plan artifacts/)
assert.match(complete('/plan ')[1]!.description, /project autoApprove/)
for (const item of complete('/plan auto ')) assert.match(item.description, /project autoApprove/)
setLang('zh')
const localized = complete('/plan ').map(item => tOr(item.descriptionKey!, item.description))
assert.match(localized[0]!, /项目计划产物/)
assert.match(localized[1]!, /项目 autoApprove/)
;(state as { externalPlanCommand: boolean }).externalPlanCommand = false
assert.deepEqual(complete('/plan ').map(item => item.name), ['plan on', 'plan off'])
console.log('PASS: artifact labels localize project scope; native completion remains on/off.')

const commands = [
  { name: 'plan', description: 'Toggle native Plan mode', descriptionKey: 'cmd-desc-plan' },
  { name: 'goal', description: 'Set a goal' },
]
const capabilities = resolveAgentCapabilities({
  agent: undefined,
  commandService: { find(_agent: unknown, name: string) { return name === 'plan' ? {} : undefined } } as never,
  service: () => undefined, toolPresent: () => false, presetId: undefined,
})
assert.equal(annotateCommandCapabilities(commands, capabilities), commands, 'native command descriptions stay unchanged')
const artifacts = annotateCommandCapabilities(commands, capabilities, true)
assert.equal(artifacts[1], commands[1], 'unrelated command descriptors stay unchanged')
assert.equal(commands[0]!.descriptionKey, 'cmd-desc-plan', 'annotation does not mutate upstream descriptors')
setLang('en')
assert.match(localizedDescription(artifacts[0]!), /project .plan artifacts/)
setLang('zh')
assert.match(localizedDescription(artifacts[0]!), /项目 .plan 产物/)
const unavailable = annotateCommandCapabilities(commands, { ...capabilities, plan: { route: 'none', reasonKey: 'capability-reason-no-plan-command' } }, true)
setLang('en')
assert.match(localizedDescription(unavailable[0]!), /project \/plan provider is not mounted/)
assert.doesNotMatch(TIPS.find(tip => tip.id === 'cmd-plan-goal')!.en, /enters plan mode/)
assert.doesNotMatch(TIPS.find(tip => tip.id === 'keys-shift-tab')!.en, /default → plan/)
assert.doesNotMatch(TIPS.find(tip => tip.id === 'flow-plan-review')!.en, /press 1 \/ 2/)
console.log('PASS: Help/completion descriptors label project artifacts, native descriptors remain intact, and tips do not advertise legacy controls.')
