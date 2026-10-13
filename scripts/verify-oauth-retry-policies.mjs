#!/usr/bin/env node
/**
 * Offline provider-owned OAuth retry regression. Import the explicitly selected
 * compiler output, never silently substitute the active lib tree.
 * Run: node scripts/verify-oauth-retry-policies.mjs --compiled-root ABSOLUTE_TYPES
 * No login, request, network, or real credential read; fixtures stay under the
 * fork's .dumps even when checking active lib. The retry executor is tested separately.
 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import { resolveRetryPolicy } from '@deepseek-ai/dsh-llm'

const args = process.argv.slice(2)
assert.equal(args.length, 2, 'Usage: --compiled-root ABSOLUTE_TYPES')
assert.equal(args[0], '--compiled-root')
assert.ok(isAbsolute(args[1]), 'Candidate path must be absolute')
const compiled = resolve(args[1])
assert.ok(existsSync(join(compiled, 'oauth.js')), 'Compile the candidate first')
// Fixture placement must not depend on the selected compiler output: a promoted
// lib/types check is read-only with respect to that active artifact tree.
const fixtureRoot = fileURLToPath(new URL('../.dumps/long-retry-20261013/', import.meta.url))
mkdirSync(fixtureRoot, { recursive: true })
const fixture = mkdtempSync(join(fixtureRoot, 'oauth-retry-fixture-'))
process.env.HOME = fixture
process.env.DSH_HOME = fixture
process.env.DSH_TUI_LANG = 'en'
globalThis.fetch = () => { throw new Error('Network forbidden in OAuth retry regression') }
globalThis.WebSocket = class {
  constructor() { throw new Error('WebSocket forbidden in OAuth retry regression') }
}
const oauth = await import(pathToFileURL(join(compiled, 'oauth.js')).href)
const { buildOAuthProfile } = oauth
const defaults = resolveRetryPolicy(undefined, 'fixture default')
const long = {
  mode: 'normal', maxRetries: 9,
  backoff: { initialDelayMs: 5000, maxDelayMs: 1200000, jitterRatio: 0.1 },
}
const expected = { ...defaults, maxRetries: 9, initialDelayMs: 5000, maxDelayMs: 1200000 }
const base = buildOAuthProfile('openai-codex')
assert.deepEqual(base.retryPolicy, defaults)
assert.deepEqual(buildOAuthProfile('anthropic').retryPolicy, defaults)
const tuned = buildOAuthProfile('openai-codex', undefined, long)
assert.deepEqual(tuned.retryPolicy, expected)
// builtinProviders creates fresh provider wrappers; compare catalog facts, not identity.
assert.deepEqual(tuned.piProvider.getModels(), base.piProvider.getModels(), 'Retry config must not mutate the catalog')
assert.equal(tuned.piProvider.auth.oauth.name, base.piProvider.auth.oauth.name)
assert.equal(typeof tuned.piProvider.auth.oauth.login, 'function')
assert.ok(Object.isFrozen(tuned.retryPolicy))
assert.ok(Object.isFrozen(tuned.retryPolicy.retryableCodes))
const mutable = structuredClone(long)
mutable.retryableCodes = ['SERVER', 'TRANSPORT']
const detached = buildOAuthProfile('openai-codex', undefined, mutable).retryPolicy
mutable.retryableCodes.push('AUTH')
mutable.backoff.maxDelayMs = 1
assert.deepEqual(detached.retryableCodes, ['SERVER', 'TRANSPORT'])
assert.equal(detached.maxDelayMs, 1200000)
assert.throws(() => { detached.maxRetries = 1 }, TypeError)

const catalogModel = base.piProvider.getModels().find(model => model.id === 'gpt-5.6-sol')
assert.ok(catalogModel, 'Existing modelOverride fixture must remain available')
const overridden = buildOAuthProfile('openai-codex', {
  [catalogModel.id]: { contextWindow: 1000000 },
}, long)
assert.equal(overridden.piProvider.getModels().find(model => model.id === catalogModel.id).contextWindow, 1000000)
assert.equal(base.piProvider.getModels().find(model => model.id === catalogModel.id).contextWindow, catalogModel.contextWindow)
assert.equal(overridden.piProvider.auth.oauth.name, base.piProvider.auth.oauth.name)
assert.equal(typeof overridden.piProvider.auth.oauth.login, 'function')
assert.deepEqual(overridden.retryPolicy, expected)
assert.throws(() => buildOAuthProfile('openai-codex', { 'not-a-model': { contextWindow: 1 } }, long), /does not ship/)

for (const invalid of [
  { mode: 'typo' }, { ...long, unknown: true },
  { ...long, maxRetries: -1 }, { ...long, maxRetries: 1.5 },
  { ...long, retryableCodes: [] }, { ...long, retryableCodes: ['SERVER', 'SERVER'] },
  { ...long, backoff: { initialDelayMs: 0 } },
  { ...long, backoff: { initialDelayMs: NaN } },
  { ...long, backoff: { initialDelayMs: 2, maxDelayMs: 1 } },
  { ...long, backoff: { jitterRatio: 1.1 } },
  { ...long, backoff: { maxDelayMs: Infinity } },
  { ...long, backoff: { unknown: 1 } },
]) {
  assert.throws(() => buildOAuthProfile('openai-codex', undefined, invalid), /retryPolicy/)
  // Raw apply must reject too, without any provider registration or store read.
  const ctx = new Context()
  try {
    assert.throws(() => oauth.apply(ctx, {
      providers: ['openai-codex'], credentialsFile: join(fixture, 'absent.json'),
      retryPolicies: { 'openai-codex': invalid },
    }), /retryPolicy/)
  } finally { await ctx.fiber.dispose() }
}
for (const key of ['typo-provider', 'anthropic']) {
  const ctx = new Context()
  try {
    assert.throws(() => oauth.apply(ctx, {
      providers: ['openai-codex'], retryPolicies: { [key]: long },
      credentialsFile: join(fixture, 'absent.json'),
    }), /retryPolicies names provider/)
  } finally { await ctx.fiber.dispose() }
}
assert.throws(() => oauth.Config({ retryPolicies: { 'openai-codex': { mode: 'typo' } } }))
// Schema defaulting must not erase unknown keys before the resolver sees them.
for (const invalid of [{ mode: 'normal', unknown: 1 }, { mode: 'normal', backoff: { unknown: 1 } }]) {
  const ctx = new Context()
  try {
    const parsed = oauth.Config({ providers: ['openai-codex'],
      credentialsFile: join(fixture, 'absent.json'), retryPolicies: { 'openai-codex': invalid } })
    assert.throws(() => oauth.apply(ctx, parsed), /unknown key/)
  } finally { await ctx.fiber.dispose() }
}
const config = oauth.Config({
  providers: ['openai-codex', 'anthropic'], credentialsFile: join(fixture, 'absent.json'),
  retryPolicies: { 'openai-codex': long },
  modelOverrides: { 'openai-codex': { [catalogModel.id]: { contextWindow: 1000000 } } },
})
const ctx = new Context()
const routes = new Map()
const released = []
ctx.provide('llm', {
  registerAdapter(ids, adapter) {
    for (const id of ids) routes.set(id, adapter)
    return () => { for (const id of ids) { routes.delete(id); released.push(id) } }
  },
})
ctx.provide('commands', { register: () => () => { released.push('auth') } })
try {
  const fiber = await ctx.plugin(oauth, config)
  assert.deepEqual([...routes.keys()], ['openai-codex', 'anthropic'])
  const codex = routes.get('openai-codex')
  assert.deepEqual(codex.providerRetryPolicy('openai-codex'), expected)
  assert.ok(Object.isFrozen(codex.providerRetryPolicy('openai-codex')))
  assert.deepEqual(routes.get('anthropic').providerRetryPolicy('anthropic'), defaults)
  config.retryPolicies['openai-codex'].maxRetries = 0
  assert.equal(codex.providerRetryPolicy('openai-codex').maxRetries, 9)
  const model = await codex.resolveModel('openai-codex', catalogModel.id)
  assert.equal(model.context.contextWindow, 1000000)
  assert.equal(existsSync(config.credentialsFile), false, 'Mount must not create a credential file')
  await fiber.dispose()
  assert.equal(routes.size, 0)
  assert.deepEqual(released.sort(), ['anthropic', 'auth', 'openai-codex'])
} finally { await ctx.fiber.dispose() }
console.log(`PASS OAuth retry defaults, validation, detached/frozen policies, model overrides and Cordis mount: ${compiled}`)
