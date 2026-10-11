/** Source regression: node --import tsx/esm scripts/verify-external-plan-modes.ts */
import assert from 'node:assert/strict'
import { createModeActions } from '../src/dsh-adapter/channel/mode-actions.js'
import { createPermissionModeActions } from '../src/dsh-adapter/channel/mode-permission-actions.js'
import { createPermissionModeRoster } from '../src/dsh-adapter/channel/mode-roster.js'
import { DEFAULT_SESSION_MODES, externalPlanSessionModes } from '../src/sessionModes.js'

for (const permissionAware of [false, true]) {
  for (const externalPlanCommand of [false, true]) {
    const events = [
      { type: 'sandbox/mode', data: { mode: 'read-only' } },
      { type: 'approval/policy', data: { policy: 'ask' } },
      { type: 'plan/mode', data: { active: true } },
    ]
    const session = { events, append(type: string, data: object) { events.push({ type, data } as never) } }
    const agent = { id: 'fixture', session }
    const capture = { agent }
    const commands: string[] = []
    const ctx = {
      logger: { warn() {} },
      get(name: string) {
        if (name === 'planMode') {
          assert.equal(externalPlanCommand, false, 'external artifacts must not consult native planMode')
          return { get: () => ({ active: true }) }
        }
        return undefined
      },
    } as never
    const roster = createPermissionModeRoster(ctx, {
      configuredModes: DEFAULT_SESSION_MODES, externalPlanCommand, agent: () => agent as never,
    })
    assert.deepEqual(roster.modes.map(mode => mode.id), externalPlanCommand ? ['default', 'full'] : ['default', 'plan', 'full'])
    roster.rebuild(agent as never)
    assert.equal(roster.modes.some(mode => mode.plan === true), !externalPlanCommand)
    const state = { mode: roster.modes[0]!, modeIndex: 0, externalPlanCommand, emit() {} }
    const deps = {
      owner: { current: () => true }, runtime: { mode: 'new' } as never,
      binding: { agent, capture: () => capture, isCurrent: () => true } as never,
      sessionModes: roster.modes, roster,
      async executeRegistryCommand(name: string, input: string) {
        commands.push(name + input)
        return 'ok'
      }, notify() {},
    }
    const actions = permissionAware ? createPermissionModeActions(ctx, state, deps) : createModeActions(ctx, state, deps)
    actions.refreshMode()
    assert.equal(state.mode.id, externalPlanCommand ? 'default' : 'plan', 'old plan/mode only selects Plan in native profiles')
    assert.equal(events.length, 3, 'refresh never rewrites durable history')
    if (!externalPlanCommand) continue
    await actions.applyMode(DEFAULT_SESSION_MODES[1]!)
    assert.equal(events.length, 3, 'native Plan target must not mutate sandbox/approval')
    assert.deepEqual(commands, [])
    await actions.cycleMode()
    assert.equal(state.mode.id, 'full')
    assert.deepEqual(commands, [], 'Shift+Tab must not execute the project artifact command')
    assert.deepEqual(events.slice(3), [
      { type: 'sandbox/mode', data: { mode: 'danger-full-access' } },
      { type: 'approval/policy', data: { policy: 'never' } },
    ], 'real sandbox and approval switches remain effective')
    const before = structuredClone(events)
    actions.onSessionEvent(session as never, { type: 'plan/mode', data: { active: false } } as never)
    await Promise.resolve()
    assert.deepEqual(events, before, 'old native exit must not restore permissions')
    actions.refreshMode()
    assert.equal(state.mode.id, 'full', 'historical Plan must not mask real full-access state')
    await actions.cycleMode()
    assert.equal(state.mode.id, 'default')
    assert.equal(events.filter(event => event.type === 'plan/mode').length, 1)
  }
}
assert.deepEqual(externalPlanSessionModes([{ id: 'only-native', plan: true }]).map(mode => mode.id), ['default', 'full'])
assert.deepEqual(externalPlanSessionModes([{ id: 'custom', plan: false, sandbox: 'read-only', approval: 'never' }]), [
  { id: 'custom', sandbox: 'read-only', approval: 'never' },
])
console.log('PASS: external artifacts exclude native Plan routing/history and preserve real sandbox/approval; native profiles unchanged.')
