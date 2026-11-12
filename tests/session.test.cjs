const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const Native = require('../native-controller.js');
const First = require('../first-spin-controller.js');
require('../native-controller-v440.js');
const { Wheel440 } = require('./engine-v440.cjs');
const { ReferenceWheel } = require('./native-fixture.cjs');

const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
const caller = (tab = 1, documentId = 'doc-1') => ({ tab: { id: tab, url: 'https://wheelofnames.com/' },
  url: 'https://wheelofnames.com/', frameId: 0, documentId });
function worker(store = { fixedWinnerDemo: { enabled: true, target: 'huy' } }, alive = new Map()) {
  let receive;
  const chrome = { storage: { local: {
    async get(keys) { return structuredClone(Object.fromEntries(keys.map(key => [key, store[key]]))); },
    async set(patch) { Object.assign(store, structuredClone(patch)); }
  } }, runtime: { onMessage: { addListener(fn) { receive = fn; } } }, tabs: {
    async sendMessage(tab, _message, options) {
      if (!alive.has(options.documentId)) throw new Error('Document is gone');
      return { active: alive.get(options.documentId) };
    }
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'session-worker.js'), 'utf8'), { chrome, crypto: webcrypto, URL });
  const request = (type, data = {}, sender = caller()) => new Promise(resolve => receive({ type: 'FWD_SESSION_' + type, ...data }, sender, resolve));
  return { store, alive, request, async require(type, data, sender) {
    const result = await request(type, data, sender); if (!result.ok) throw new Error(result.error); return result;
  } };
}

test('worker serializes competing tabs and keeps consumed state through reload and worker restart', async () => {
  const server = worker(); const config = (await server.require('READ')).config;
  server.alive.set('doc-1', true); server.alive.set('doc-2', true);
  const grants = await Promise.all([server.request('ACQUIRE', { runId: config.runId }), server.request('ACQUIRE', { runId: config.runId }, caller(2, 'doc-2'))]);
  assert.equal(grants.filter(x => x.ok && x.controlled).length, 1);
  assert.equal(grants.filter(x => !x.ok).length, 1);
  const restarted = worker(server.store, server.alive);
  assert.equal((await restarted.request('ACQUIRE', { runId: config.runId }, caller(2, 'doc-2'))).ok, false);
  await restarted.require('FINISH', { runId: config.runId, leaseId: grants[0].leaseId, completed: true });
  const afterF5 = worker(server.store, new Map());
  assert.equal((await afterF5.require('READ')).config.consumed, true);
  assert.equal((await afterF5.require('ACQUIRE', { runId: config.runId }, caller(1, 'doc-reloaded'))).controlled, false);
  const unchanged = await afterF5.require('UPDATE', { patch: { target: 'huy' } }, {});
  assert.equal(unchanged.config.consumed, true); assert.equal(unchanged.config.runId, config.runId);
  const changed = await afterF5.require('UPDATE', { patch: { target: 'đạt' } }, {});
  assert.equal(changed.config.consumed, false); assert.notEqual(changed.config.runId, config.runId);
  await afterF5.require('UPDATE', { patch: { enabled: false } }, {});
  const enabled = await afterF5.require('UPDATE', { patch: { enabled: true } }, {});
  assert.notEqual(enabled.config.runId, changed.config.runId);
});

test('abandoned document reservations are reclaimed; stale completions and non-page callers cannot consume a run', async () => {
  const server = worker(); const config = (await server.require('READ')).config;
  const old = await server.require('ACQUIRE', { runId: config.runId });
  const fresh = await server.require('ACQUIRE', { runId: config.runId }, caller(1, 'after-f5'));
  assert.notEqual(old.leaseId, fresh.leaseId);
  assert.equal((await server.request('FINISH', { runId: config.runId, leaseId: old.leaseId, completed: true })).ok, false);
  assert.equal(server.store.fixedWinnerDemoSession.used, false);
  assert.equal((await server.request('ACQUIRE', { runId: config.runId }, { ...caller(), url: 'https://evil.example/' })).ok, false);
  assert.equal((await server.request('UPDATE', { patch: { target: 'other' } })).ok, false);
  await server.require('FINISH', { runId: config.runId, leaseId: fresh.leaseId, completed: false }, caller(1, 'after-f5'));
  assert.equal(server.store.fixedWinnerDemoSession.lease, null); assert.equal(server.store.fixedWinnerDemoSession.used, false);
});

function setup(profile, server, extra = {}) {
  let time = 0, results = [], nativeCalls = 0;
  const done = entry => { assert.equal(server.store.fixedWinnerDemoSession.used, true); results.push(entry); };
  const wheel = profile === 'v440' ? new Wheel440(() => {}, done) : new ReferenceWheel();
  if (profile === 'v440') wheel.configure({ entries: ['Hoàng', 'Huy', 'Đạt'].map(text => ({ text })), type: 'color', spinTime: 5, maxNames: 1000, allowDuplicates: true });
  const saved = { click: wheel.click, tick: wheel.tick, done: wheel.doneSpinningCallback };
  const control = First.attach(wheel, Native, { now: () => time, random: () => .75,
    acquire: data => server.require('ACQUIRE', data), finish: (data, completed) => server.require('FINISH', { ...data, completed }), ...extra });
  const click = () => profile === 'v440' ? wheel.click() : wheel.click(() => {}, done);
  const tick = () => wheel.tick(() => { nativeCalls++; return .75; });
  return { wheel, control, click, tick, saved, results, advance(value) { time += value; }, get nativeCalls() { return nativeCalls; } };
}

for (const profile of ['legacy', 'v440']) {
  test(`${profile}: only the first result is controlled and spins two/three use native randomness with the full list`, async () => {
    const server = worker(); const config = (await server.require('READ')).config;
    const env = setup(profile, server); env.control.configure(config);
    env.click(); await flush(); env.tick(); env.advance(6000); env.tick(); await flush();
    assert.equal(env.results.length, 1); assert.equal(env.results[0].text, 'Huy');
    assert.equal(env.control.status().mode, 'random');
    assert.equal(server.store.fixedWinnerDemoSession.used, true);
    for (let repeat = 0; repeat < 2; repeat++) {
      env.click(); await flush(); for (let tick = 0; tick < 400; tick++) env.tick();
      assert.equal(env.results.length, repeat + 2);
    }
    if (profile === 'v440') assert.ok(env.nativeCalls >= 2); else assert.equal(env.wheel.randomStarts, 2);
    assert.equal((profile === 'v440' ? env.wheel.getDisplayEntries() : env.wheel.entries).length, 3);
    env.control.dispose(); assert.equal(env.wheel.click, env.saved.click); assert.equal(env.wheel.tick, env.saved.tick);
  });

  test(`${profile}: cancelled/reordered first spin is released and retried before any native random spin`, async () => {
    const server = worker(); const config = (await server.require('READ')).config;
    const env = setup(profile, server); env.control.configure(config);
    env.click(); await flush(); env.tick();
    if (profile === 'v440') env.wheel.resetRotation(); else env.wheel.setEntries([{ text: 'Huy' }, { text: 'Hoàng' }, { text: 'Đạt' }]);
    await flush(); assert.equal(server.store.fixedWinnerDemoSession.used, false); assert.equal(env.results.length, 0);
    env.click(); await flush(); env.tick(); env.advance(6000); env.tick(); await flush();
    assert.equal(env.results.length, 1); assert.equal(env.results[0].text, 'Huy');
    env.control.dispose();
  });
}

test('failed persistent completion cannot publish a winner and allows retry', async () => {
  const server = worker(); const config = (await server.require('READ')).config; let fail = true;
  const env = setup('v440', server, { finish: (data, completed) => {
    if (completed && fail) { fail = false; return Promise.reject(new Error('Simulated storage failure')); }
    return server.require('FINISH', { ...data, completed });
  } });
  env.control.configure(config); env.click(); await flush(); env.tick(); env.advance(6000); env.tick(); await flush();
  assert.equal(env.results.length, 0); assert.equal(server.store.fixedWinnerDemoSession.used, false);
  env.click(); await flush(); env.tick(); env.advance(6000); env.tick(); await flush();
  assert.equal(env.results.length, 1); env.control.dispose();
});

test('disposal before reservation reply releases it without starting a spin', async () => {
  const server = worker(); const config = (await server.require('READ')).config; let grant;
  const env = setup('v440', server, { acquire: () => new Promise(resolve => { grant = resolve; }) });
  env.control.configure(config); env.click(); env.control.dispose();
  grant(await server.require('ACQUIRE', { runId: config.runId })); await flush();
  assert.equal(env.results.length, 0); assert.equal(env.wheel.isSpinning(), false);
  assert.equal(server.store.fixedWinnerDemoSession.lease, null); assert.equal(env.wheel.click, env.saved.click);
});

test('read-only native result callback rolls back all first-spin adapter patches', () => {
  const wheel = new Wheel440(); wheel.configure({ entries: [{ text: 'Huy' }], type: 'color', spinTime: 5, maxNames: 1000, allowDuplicates: true });
  const click = wheel.click, tick = wheel.tick;
  Object.defineProperty(wheel, 'doneSpinningCallback', { value: wheel.doneSpinningCallback, writable: false });
  assert.throws(() => First.attach(wheel, Native, {}), /hoàn tác/);
  assert.equal(wheel.click, click); assert.equal(wheel.tick, tick);
});
