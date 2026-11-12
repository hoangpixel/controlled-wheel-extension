const { test } = require('node:test');
const assert = require('node:assert/strict');
const Link = require('../native-module-link.js');
const Adapter = require('../native-controller-v440.js');
const { Wheel440 } = require('./engine-v440.cjs');
const { environment } = require('./harness.cjs');
const base = 'https://wheelofnames.com/assets/';
const engineURL = base + 'dist-v4402.js', audioURL = base + 'WheelConfigUtil-v440.js';
const resources = () => [{ name: engineURL }, { name: base + 'ConfettiLauncher-v440.js' }, { name: audioURL }];

test('observed v440 audio is preloaded before capture without playing a sound or emitting a fake entry event', async () => {
  const env = environment(); let time = 0, prepared = false, callbacks = 0, preloads = 0;
  const config = { entries: ['Nguyễn Văn An', 'Lê Minh Huy', 'Trần Quốc Đạt', 'Phạm Minh Hoàng'].map(text => ({ text })),
    type: 'color', spinTime: 10, maxNames: 1000, allowDuplicates: true, duringSpinSound: 'ticking-sound', afterSpinSound: 'no-sound' };
  const wheel = new Wheel440(() => { callbacks++; time += prepared ? .4 : 60; }, () => {});
  wheel.configure(config);
  const store = { wheelConfigs: [config], setWheelBusy() {} };
  const host = { canvas: env.nativeCanvas, component: { props: { wheelConfig: config }, appContext: { provides: { pinia: { _s: new Map([['wheels', store]]) } } } } };
  const link = Link.create({ origin: 'https://wheelofnames.com', resources, compatible: Adapter.compatible, now: () => time,
    loadModule: async url => url === engineURL ? { t: Wheel440 } : { l(during, after) {
      assert.equal(url, audioURL); assert.equal(during, 'ticking-sound'); assert.equal(after, 'no-sound');
      assert.equal(callbacks, 0); preloads++; time += 60; prepared = true;
    } } });
  link.ensure([host]); await env.flush();
  assert.equal(preloads, 1); assert.equal(callbacks, 0);
  assert.deepEqual(link.status().audioWarmup, { phase: 'preload_requested', durationMs: 60 });
  wheel.draw(env.nativeCanvas.getContext('2d')); await env.flush();
  assert.equal(link.get([host]).wheel, wheel);
  const control = Adapter.attach(wheel, { now: () => time, random: () => .5 });
  control.configure({ enabled: true, target: 'huy' }); wheel.click(); wheel.tick(() => .5);
  time += 250; wheel.tick(() => .5);
  assert.equal(callbacks, 1); assert.ok(control.timing().maxNameCallbackMs < 1);
  control.dispose(); link.cancel();
});

test('audio preload ignores unobserved/cross-origin/query URLs and cancellation before import completes', async () => {
  const env = environment();
  for (const invalid of ['https://evil.example/assets/WheelConfigUtil-v440.js', audioURL + '?variant=1']) {
    let imports = 0;
    const link = Link.create({ origin: 'https://wheelofnames.com', resources: () => resources().map(item => ({ name: item.name === audioURL ? invalid : item.name })),
      compatible: Adapter.compatible, loadModule: async url => { imports++; assert.equal(url, engineURL); return { t: Wheel440 }; } });
    link.ensure([{}]); await env.flush(); assert.equal(imports, 1);
    assert.equal(link.status().audioWarmup.phase, 'not_observed'); link.cancel();
  }
  let resolveAudio, preloads = 0;
  const link = Link.create({ origin: 'https://wheelofnames.com', resources, compatible: Adapter.compatible,
    loadModule: async url => url === engineURL ? { t: Wheel440 } : new Promise(resolve => { resolveAudio = resolve; }) });
  link.ensure([{ component: { props: { wheelConfig: {} } } }]); await env.flush();
  assert.equal(typeof resolveAudio, 'function'); link.cancel();
  resolveAudio({ l() { preloads++; } }); await env.flush(); assert.equal(preloads, 0);
});
