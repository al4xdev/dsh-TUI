/** Source-only regression: node scripts/verify-external-plan-chat-source.mjs
 * Executes the actual Chat dispatch/effect/keyboard/click bodies without loading
 * the renderer, generated lib/, or a parallel implementation of /plan.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = ts.createSourceFile('Chat.tsx', readFileSync(new URL('../src/screens/Chat.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const nodes = []
function visit(node) { nodes.push(node); ts.forEachChild(node, visit) }
visit(source)
const text = node => node.getText(source)
function unique(predicate, label) {
  const matches = nodes.filter(predicate)
  assert.equal(matches.length, 1, `Expected exactly one ${label}`)
  return matches[0]
}
function execute(body, context) {
  const compiled = ts.transpile(body, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext })
  return new Function(...Object.keys(context), compiled)(...Object.values(context))
}
const planCase = unique(node => ts.isCaseClause(node) && text(node.expression) === "'plan'", 'plan command case')
const keyboard = unique(node => ts.isIfStatement(node) && text(node.expression) === "overlay.kind === 'plan'", 'plan keyboard branch')
const picker = unique(node => ts.isJsxSelfClosingElement(node) && text(node.tagName) === 'PlanPicker', 'PlanPicker')
const onPick = picker.attributes.properties.find(node => ts.isJsxAttribute(node) && text(node.name) === 'onPick').initializer.expression
const render = unique(node => ts.isJsxExpression(node) && node.expression && ts.isBinaryExpression(node.expression) && text(node.expression.right).includes('<PlanPicker'), 'PlanPicker render gate').expression.left
const effect = unique(node => ts.isCallExpression(node) && text(node.expression) === 'React.useEffect' && text(node.arguments[0]).includes("channel.externalPlanCommand && overlay.kind === 'plan'"), 'stale picker cleanup').arguments[0]

function fixture(externalPlanCommand, route = 'registry') {
  const commands = [], overlays = [], notifications = []
  const context = {
    channel: { externalPlanCommand, mode: { plan: true }, capabilities: () => ({ plan: { route } }), notify: (...args) => notifications.push(args) },
    dispatchOverlay: action => overlays.push(action),
    runExternalCommand: (...args) => { commands.push(args); return true },
    setHelpOpen() {}, t: key => key, images: [], rawInput: '',
    overlay: { kind: 'plan', index: 0 }, key: {}, plainReturn: false, index: 0,
  }
  return { context, commands, overlays, notifications }
}
for (const external of [false, true]) {
  for (const input of ['', ' on', ' off', ' on extra', ' off extra', ' auto on', ' auto off', ' auto status', ' status', ' open 7', ' approve 7']) {
    const f = fixture(external)
    f.context.rawInput = input
    assert.equal(execute(`switch ('plan') { ${text(planCase)} }`, f.context), true)
    if (external && /^ (on|off)( |$)/.test(input)) {
      assert.deepEqual(f.commands, [], 'legacy on/off must never be forwarded or translated to auto')
      assert.deepEqual(f.overlays, [])
      assert.equal(f.notifications[0][0], 'plan-artifact-native-controls-disabled')
    } else if (!external && input === '') {
      assert.deepEqual(f.overlays, [{ type: 'open', overlay: { kind: 'plan', index: 0 } }])
      assert.deepEqual(f.commands, [])
    } else {
      assert.deepEqual(f.commands, [['plan', input, []]], 'artifact arguments and native arguments pass through verbatim')
      assert.deepEqual(f.overlays, [])
    }
  }
  const missing = fixture(external, 'none')
  assert.equal(execute(`switch ('plan') { ${text(planCase)} }`, missing.context), false)
  assert.deepEqual(missing.commands, [])
  for (const index of [0, 1]) {
    const f = fixture(external)
    f.context.overlay.index = index
    assert.equal(execute(`return ${text(render)}`, f.context), !external)
    execute(text(effect.body), f.context)
    assert.deepEqual(f.overlays, external ? [{ type: 'close' }] : [], 'hidden stale modal must be retired without a keypress')
    f.overlays.length = 0
    f.context.plainReturn = true
    execute(text(keyboard), f.context)
    assert.deepEqual(f.overlays, [{ type: 'close' }])
    assert.deepEqual(f.commands, external ? [] : [['plan', index === 0 ? '' : ' off']])
    f.commands.length = 0
    f.overlays.length = 0
    f.context.index = index
    execute(text(onPick.body), f.context)
    assert.deepEqual(f.overlays, [{ type: 'close' }])
    assert.deepEqual(f.commands, external ? [] : [['plan', index === 0 ? '' : ' off']], 'stale click cannot dispatch native controls')
  }
  for (const key of [{ upArrow: true }, { downArrow: true }, { escape: true }, {}]) {
    const f = fixture(external)
    f.context.key = key
    execute(text(keyboard), f.context)
    assert.deepEqual(f.commands, [])
    assert.deepEqual(f.overlays, external || key.escape ? [{ type: 'close' }] : key.upArrow || key.downArrow ? [{ type: 'move', delta: key.upArrow ? -1 : 1, count: 2 }] : [])
  }
}
for (const input of [' on', ' off']) {
  const f = fixture(true, 'none')
  f.context.rawInput = input
  assert.equal(execute(`switch ('plan') { ${text(planCase)} }`, f.context), true, 'legacy controls stay consumed even without the artifact provider')
  assert.deepEqual(f.commands, [])
  assert.equal(f.notifications[0][0], 'plan-artifact-native-controls-disabled')
}
console.log('PASS: real Chat source blocks native Plan controls and stale picker actions only in external profiles; native dispatch preserved.')
