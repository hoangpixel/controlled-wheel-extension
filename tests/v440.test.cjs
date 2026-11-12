const { test } = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../wheel-core.js');
const Adapter = require('../native-controller-v440.js');
const Link = require('../native-module-link.js');
const { Wheel440 } = require('./engine-v440.cjs');
const { environment } = require('./harness.cjs');

const makeConfig = names => ({ entries: names.map((text, index) => ({ id: String(index), text })), type: 'color', spinTime: 5, maxNames: 1000, allowDuplicates: true });
const permutations = values => values.length ? values.flatMap((value, index) => permutations(values.filter((_, i) => i !== index)).map(rest => [value, ...rest])) : [[]];

test('uploaded v440 engine: 288 controlled spins retain native entry, phase, renderer angle and callback', () => {
  let time = 0, called = 0, randomCalls = 0, winner;
  const wheel = new Wheel440(() => {}, entry => {
    called++; winner = entry;
    assert.equal(wheel.getEntryAtPointer(), entry);
    assert.equal(wheel.wheelState.phase, 'StoppedPhase');
  });
  let samples = 0;
  const control = Adapter.attach(wheel, { now: () => time, random: () => [0, .5, .999999][samples++ % 3] });
  const context = { frames: [] };
  for (const names of permutations(['Hoàng', 'Huy', 'Đạt', 'Vinh'])) {
    wheel.configure(makeConfig(names));
    for (const target of names) {
      control.configure({ enabled: true, target });
      for (let repeat = 0; repeat < 3; repeat++) {
        const before = called;
        wheel.click();
        wheel.tick(() => { randomCalls++; return .25; });
        time += 1000; wheel.tick(() => { randomCalls++; return .25; });
        assert.equal(called, before);
        assert.equal(wheel.isSpinning(), true);
        time += 5000; wheel.tick(() => { randomCalls++; return .25; });
        wheel.draw(context);
        assert.equal(called, before + 1);
        assert.equal(winner.text, target);
        assert.equal(winner, wheel.getDisplayEntries()[names.indexOf(target)]);
        assert.equal(wheel.getEntryAtAngle(wheel.wheelState.angle), winner);
        assert.equal(control.status().result, target);
        const drawn = context.frames.at(-1);
        assert.equal(drawn.angle, wheel.wheelState.angle);
        const center = drawn.angle - names.indexOf(target) * Core.TAU / names.length;
        const offset = Math.abs(Core.wrap(center + Math.PI) - Math.PI) / (Core.TAU / names.length);
        assert.ok(offset >= .1 - 1e-10 && offset <= .4 + 1e-10);
        wheel.tick(() => { randomCalls++; return .25; });
        assert.equal(called, before + 1);
      }
    }
  }
  assert.equal(called, 288); assert.equal(randomCalls, 0);
  assert.equal(samples, 288, 'one landing sample per spin, none from status checks'); control.dispose();
});

test('v440 cancellation on target/list/disable restores methods and native random spin', () => {
  let time = 0, called = 0, cancelled = 0;
  const wheel = new Wheel440(() => {}, () => called++);
  wheel.configure(makeConfig(['Hoàng', 'Huy', 'Đạt']));
  const saved = Object.fromEntries(['click', 'tick', 'configure', 'resetRotation'].map(key => [key, wheel[key]]));
  const control = Adapter.attach(wheel, { now: () => time, onCancel: () => cancelled++ });
  control.configure({ enabled: true, target: 'Huy' }); wheel.click();
  time += 1000; wheel.tick(() => .5);
  control.configure({ enabled: true, target: 'Đạt' }); assert.equal(wheel.isSpinning(), false);
  wheel.click(); wheel.configure(makeConfig(['Đạt', 'Hoàng']));
  assert.equal(wheel.isSpinning(), false); assert.equal(wheel.getDisplayEntries().length, 2);
  wheel.click(); control.dispose();
  assert.equal(called, 0); assert.equal(cancelled, 3);
  for (const [key, method] of Object.entries(saved)) assert.equal(wheel[key], method);
  let randomCalls = 0;
  wheel.click(); for (let i = 0; i < 400; i++) wheel.tick(() => { randomCalls++; return .5; });
  assert.equal(called, 1); assert.ok(randomCalls > 0);
});

test('v440 failed click releases busy after the component emits spin-started', async () => {
  let busy = false, called = 0;
  const wheel = new Wheel440(() => {}, () => called++);
  wheel.configure(makeConfig(['Hoàng', 'Huy']));
  const control = Adapter.attach(wheel, { onCancel: () => { busy = false; } });
  control.configure({ enabled: true, target: 'Absent' });
  wheel.click(); busy = true;
  await Promise.resolve();
  assert.equal(busy, false); assert.equal(called, 0); assert.equal(wheel.isSpinning(), false);
  assert.match(control.status().error, /Không tìm thấy/); control.dispose();
});

test('module link imports only an observed same-origin v440 module, captures exact draw instance and restores prototype', async () => {
  const env = environment(); const config = makeConfig(['Hoàng', 'Huy']);
  const wheel = new Wheel440(); wheel.configure(config);
  const store = { wheelConfigs: [config], setWheelBusy(index, value) { this.busy = value; } };
  const host = { canvas: env.nativeCanvas, component: { props: { wheelConfig: config }, appContext: { provides: { pinia: { _s: new Map([['wheel', store]]) } } } } };
  let imports = 0, captures = 0;
  const originalDraw = Wheel440.prototype.draw;
  const link = Link.create({ origin: 'https://wheelofnames.com', resources: () => [
    { name: 'https://evil.example/assets/dist-v4402.js' },
    { name: 'https://wheelofnames.com/assets/ConfettiLauncher-v440.js' },
    { name: 'https://wheelofnames.com/assets/dist-v4402.js' }
  ], compatible: Adapter.compatible,
    loadModule: async url => { imports++; assert.equal(url, 'https://wheelofnames.com/assets/dist-v4402.js'); return { t: Wheel440 }; },
    onCapture: () => captures++ });
  link.ensure([host]); await env.flush();
  assert.notEqual(Wheel440.prototype.draw, originalDraw);
  const unrelated = new Wheel440(); unrelated.configure(config);
  unrelated.draw({ canvas: {}, frames: [] });
  assert.equal(captures, 0);
  assert.notEqual(Wheel440.prototype.draw, originalDraw);
  wheel.draw(env.nativeCanvas.getContext('2d')); await env.flush();
  assert.equal(link.get([host]).wheel, wheel);
  assert.equal(captures, 1); assert.equal(imports, 1);
  assert.equal(Wheel440.prototype.draw, originalDraw);
  store.busy = true; link.get([host]).releaseBusy(); assert.equal(store.busy, false);
  link.cancel(); assert.equal(link.get([host]), null);
});

test('module link rejects unobserved, cross-origin and query-variant module URLs', async () => {
  for (const url of ['https://evil.example/assets/dist-v4402.js', 'https://wheelofnames.com/assets/dist-v4402.js?x=1', 'https://wheelofnames.com/assets/dist-v4412.js']) {
    let imported = false;
    const link = Link.create({ origin: 'https://wheelofnames.com', resources: () => [{ name: 'https://wheelofnames.com/assets/ConfettiLauncher-v440.js' }, { name: url }], compatible: Adapter.compatible, loadModule: async () => { imported = true; } });
    link.ensure([{}]); await Promise.resolve();
    assert.equal(imported, false); assert.equal(link.status().phase, 'module_not_observed'); link.cancel();
  }
});

test('disabling while waiting for native draw removes the temporary prototype hook', async () => {
  const original = Wheel440.prototype.draw;
  const link = Link.create({ origin: 'https://wheelofnames.com', resources: () => [{ name: 'https://wheelofnames.com/assets/ConfettiLauncher-v440.js' }, { name: 'https://wheelofnames.com/assets/dist-v4402.js' }],
    compatible: Adapter.compatible, loadModule: async () => ({ t: Wheel440 }) });
  link.ensure([{}]); await new Promise(resolve => setImmediate(resolve));
  assert.notEqual(Wheel440.prototype.draw, original);
  link.cancel(); assert.equal(Wheel440.prototype.draw, original);
});

test('full bridge connects a hidden v440 engine through its original module and handles native click/disable', async () => {
  const env = environment({ fixedWinnerDemo: { enabled: true, target: 'Đạt' } });
  const config = makeConfig(['Hoàng', 'Huy', 'Đạt', 'Vinh']); let result, busy = false, audioPreloads = 0;
  config.duringSpinSound = 'ticking-sound'; config.afterSpinSound = 'no-sound';
  const store = { wheelConfigs: [config], setWheelBusy(index, value) { busy = value; } };
  const wheel = new Wheel440(() => {}, entry => { result = entry; store.setWheelBusy(0, false); });
  wheel.configure(config);
  const component = { type: { __name: 'SpinningWheel' }, props: { wheelConfig: config }, data: {}, setupState: {}, ctx: {},
    exposed: { spin() { wheel.click(); store.setWheelBusy(0, true); }, resetRotation: () => wheel.resetRotation() },
    proxy: { $el: env.wheelContainer }, appContext: { provides: { pinia: { _s: new Map([['wheels', store]]) } } } };
  env.main._vnode = { component: { subTree: { el: env.main, children: [{ el: env.wheelContainer, component }] } } };
  env.resourceEntries.push({ name: 'https://wheelofnames.com/assets/dist-v4402.js' });
  env.resourceEntries.push({ name: 'https://wheelofnames.com/assets/ConfettiLauncher-v440.js' });
  env.resourceEntries.push({ name: 'https://wheelofnames.com/assets/WheelConfigUtil-v440.js' });
  ['wheel-core.js','native-motion-v440.js','native-controller-v440.js','native-controller.js','native-discovery.js','native-module-link.js'].forEach(file => env.load(file, 'page'));
  env.mockModuleLoader(async url => url.endsWith('WheelConfigUtil-v440.js') ? { l(during, after) {
    assert.equal(during, 'ticking-sound'); assert.equal(after, 'no-sound'); audioPreloads++;
  } } : { t: Wheel440 }); env.load('page-bridge.js', 'page');
  ['wheel-core.js','page-reader.js','content.js'].forEach(file => env.load(file));
  await env.flush();
  env.load('popup.js'); await env.flush();
  assert.match(env.elements.get('list-status').textContent, /Chưa kết nối/);
  const popupPoll = [...env.intervals.values()].at(-1);
  wheel.draw(env.nativeCanvas.getContext('2d')); await env.flush();
  await popupPoll(); await env.flush();
  assert.match(env.elements.get('list-status').textContent, /Đã kết nối/);
  assert.equal((await env.request('FWD_STATUS')).supported, true);
  component.exposed.spin(); assert.equal(busy, true);
  wheel.tick(() => .4);
  env.advance(6000); wheel.tick(() => .4); await env.flush();
  assert.equal(result.text, 'Đạt'); assert.equal(busy, false);
  assert.equal(env.roots.length, 0, 'no badge, debug panel or replacement canvas is injected');
  const report = (await env.request('FWD_DIAGNOSTICS')).diagnostics;
  assert.equal(report.extensionVersion, '1.4.4');
  assert.equal(audioPreloads, 1); assert.equal(report.moduleLink.audioWarmup.phase, 'preload_requested');
  assert.equal(report.motion.spin, 1); assert.equal(report.motion.firstTickDelayMs, 0);
  assert.doesNotMatch(JSON.stringify(report.motion), /Hoàng|Huy|Đạt|Vinh/);
  component.exposed.spin(); assert.equal(busy, true);
  await env.chrome.storage.local.set({ fixedWinnerDemo: { enabled: false, target: 'Đạt' } }); await env.flush();
  assert.equal(busy, false); assert.equal(env.roots.length, 0);
  assert.equal(Object.hasOwn(wheel, 'click'), false);
});
