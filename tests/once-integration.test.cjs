const { test } = require('node:test');
const assert = require('node:assert/strict');
const manifest = require('../manifest.json');
const { environment } = require('./harness.cjs');
const { ReferenceWheel } = require('./native-fixture.cjs');
const { Wheel440 } = require('./engine-v440.cjs');
const mainFiles = manifest.content_scripts.find(script => script.world === 'MAIN').js;
const isolatedFiles = manifest.content_scripts.find(script => !script.world).js;

async function boot(stored = { fixedWinnerDemo: { enabled: true, target: 'Huy' } }) {
  const env = environment(stored); const wheel = new ReferenceWheel(); let result, busy = false, time = 0;
  const instance = { myWheel: wheel, $el: env.wheelContainer, $store: { commit(_name, value) { busy = value; } },
    spin() { if (busy) return; busy = true; wheel.click(() => {}, entry => { result = entry; busy = false; }); } };
  env.wheelContainer.__vue__ = instance; env.nativeSpin.addEventListener('click', () => instance.spin());
  mainFiles.forEach(file => env.load(file, 'page')); isolatedFiles.forEach(file => env.load(file)); await env.flush();
  return Object.assign(env, { wheel, async fixed() {
    await env.nativeSpin.fire('click'); await env.flush(); wheel.tick();
    time += 6000; env.advance(time); wheel.tick(); await env.flush(); return result;
  }, async random() {
    await env.nativeSpin.fire('click'); await env.flush(); wheel.tick(); wheel.tick(); wheel.tick(); await env.flush(); return result;
  } });
}

test('first completion survives F5; random mode ignores a missing target, and popup target/toggle changes rearm it', async () => {
  const first = await boot(); assert.equal((await first.fixed()).text, 'Huy');
  const runId = first.storage.fixedWinnerDemo.runId;
  assert.equal(first.storage.fixedWinnerDemoSession.used, true);
  assert.equal((await first.request('FWD_STATUS')).mode, 'random');
  await first.random(); await first.random(); assert.equal(first.wheel.randomStarts, 2);
  const reloaded = await boot(first.storage);
  reloaded.wheel.setEntries([{ text: 'An' }, { text: 'Đạt' }]);
  assert.equal((await reloaded.request('FWD_STATUS')).firstSpinDone, true);
  reloaded.load('popup.js'); await reloaded.flush();
  assert.match(reloaded.elements.get('mode-label').textContent, /Ngẫu nhiên gốc/);
  assert.equal((await reloaded.random()).text, 'An'); assert.equal(reloaded.wheel.randomStarts, 1);
  reloaded.elements.get('winner').value = 'Đạt';
  await reloaded.elements.get('winner-form').fire('submit'); await reloaded.flush();
  assert.notEqual(reloaded.storage.fixedWinnerDemo.runId, runId);
  assert.equal((await reloaded.fixed()).text, 'Đạt');
  reloaded.elements.get('enabled').checked = false; await reloaded.elements.get('enabled').fire('change'); await reloaded.flush();
  reloaded.elements.get('enabled').checked = true; await reloaded.elements.get('enabled').fire('change'); await reloaded.flush();
  assert.equal(reloaded.storage.fixedWinnerDemoSession.used, false);
  assert.equal((await reloaded.fixed()).text, 'Đạt');
});

test('F5 during the controlled spin retries it instead of consuming the first result', async () => {
  const old = await boot(); await old.nativeSpin.fire('click'); await old.flush(); old.wheel.tick();
  assert.equal(old.storage.fixedWinnerDemoSession.used, false);
  const reloaded = await boot(old.storage);
  assert.equal((await reloaded.fixed()).text, 'Huy');
  assert.equal(reloaded.wheel.randomStarts, 0);
  assert.equal(reloaded.storage.fixedWinnerDemoSession.used, true);
});

test('an early click during v440 capture waits and starts exactly one reserved first spin', async () => {
  const env = environment({ fixedWinnerDemo: { enabled: true, target: 'Huy' } });
  const config = { entries: ['Hoàng', 'Huy', 'Đạt'].map(text => ({ text })), type: 'color', spinTime: 5, maxNames: 1000, allowDuplicates: true };
  let starts = 0, result;
  const store = { wheelConfigs: [config], setWheelBusy() {} };
  const wheel = new Wheel440(() => {}, entry => { result = entry; }); wheel.configure(config);
  const component = { type: { __name: 'SpinningWheel' }, props: { wheelConfig: config }, data: {}, setupState: {}, ctx: {},
    exposed: { spin() { starts++; wheel.click(); } }, proxy: { $el: env.wheelContainer }, appContext: { provides: { pinia: { _s: new Map([['wheels', store]]) } } } };
  env.main._vnode = { component: { subTree: { el: env.main, children: [{ el: env.wheelContainer, component }] } } };
  env.resourceEntries.push({ name: 'https://wheelofnames.com/assets/dist-v4402.js' }, { name: 'https://wheelofnames.com/assets/ConfettiLauncher-v440.js' });
  mainFiles.filter(file => file !== 'page-bridge.js').forEach(file => env.load(file, 'page'));
  env.mockModuleLoader(async () => ({ t: Wheel440 })); env.load('page-bridge.js', 'page');
  isolatedFiles.forEach(file => env.load(file)); await env.flush();
  for (let i = 0; i < 3; i++) {
    let stopped = false;
    env.docHandlers.click({ type: 'click', target: env.nativeCanvas, preventDefault() {}, stopImmediatePropagation() { stopped = true; } });
    assert.equal(stopped, true);
  }
  assert.equal(starts, 0);
  wheel.draw(env.nativeCanvas.getContext('2d')); await env.flush();
  assert.equal(starts, 1); wheel.tick(() => { throw new Error('Native RNG'); });
  env.advance(6000); wheel.tick(() => { throw new Error('Native RNG'); }); await env.flush();
  assert.equal(result.text, 'Huy'); assert.equal(env.storage.fixedWinnerDemoSession.used, true);
});
