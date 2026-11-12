const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../wheel-core.js');
const Reader = require('../page-reader.js');
const Native = require('../native-controller.js');
const { Element, environment } = require('./harness.cjs');
const { ReferenceWheel } = require('./native-fixture.cjs');

test('Vietnamese names preserve accents, internal spaces and duplicates, with NFC normalization', () => {
  assert.deepEqual(Core.parseNames('  Hoàng  \r\nHuy\n\nĐạt\nNguyễn Văn An\nHuy'), ['Hoàng', 'Huy', 'Đạt', 'Nguyễn Văn An', 'Huy']);
  assert.equal(Core.findTarget(['Hoàng'], ' Hoàng '), 0);
  assert.equal(Core.findTarget(['Hoàng'], 'hoàng'), -1);
});

test('shared geometry retains correct top-pointer results over 5,000 cases', () => {
  for (const count of [1, 2, 3, 7, 32, 100, 1000]) for (let index = 0; index < count; index++) {
    for (const start of [-28, 0, .7, 6.1, 135]) {
      const stop = Core.landingAngle(count, index, start);
      const center = stop + (index + .5) * Math.PI * 2 / count;
      assert.ok(Math.abs(Math.cos(center)) < 1e-10);
      assert.ok(Math.abs(Math.sin(center) + 1) < 1e-10);
      assert.equal(Core.indexAtPointer(count, stop), index);
    }
  }
});

test('DOM reader distinguishes visible editors and refuses ambiguity', () => {
  const editor = new Element('TEXTAREA'); editor.id = 'entries'; editor.value = 'Hoàng\nHuy\nĐạt';
  const doc = (...items) => ({ querySelectorAll: () => items });
  assert.deepEqual(Reader.read(doc(editor)).names, ['Hoàng', 'Huy', 'Đạt']);
  editor.hidden = true; assert.equal(Reader.read(doc(editor)).available, false);
  editor.hidden = false; editor.id = '';
  assert.equal(Reader.read(doc(editor, new Element('TEXTAREA'))).available, false);
});

test('native adapter: 72 spins after reorder/target changes use actual engine entry and right-hand pointer', () => {
  let now = 0;
  const wheel = new ReferenceWheel();
  const control = Native.attach(wheel, { now: () => now });
  const permutations = [ ['Hoàng','Huy','Đạt'], ['Hoàng','Đạt','Huy'], ['Huy','Hoàng','Đạt'], ['Huy','Đạt','Hoàng'], ['Đạt','Hoàng','Huy'], ['Đạt','Huy','Hoàng'] ];
  let total = 0;
  for (const names of permutations) {
    wheel.setEntries(names.map(text => ({ text })));
    for (const target of names) {
      control.configure({ enabled: true, target });
      for (let repeat = 0; repeat < 4; repeat++) {
        let result, callbacks = 0;
        wheel.click(() => {}, entry => { result = entry; callbacks++; });
        now += 500; wheel.tick();
        assert.equal(callbacks, 0); assert.equal(wheel.isSpinning(), true);
        now += 5000; wheel.tick(); wheel.tick();
        assert.equal(callbacks, 1);
        assert.equal(result, wheel.entries[names.indexOf(target)]);
        assert.equal(wheel.getEntryAtPointer(), result);
        assert.equal(control.status().result, target);
        const center = wheel.angle - names.indexOf(target) * Math.PI * 2 / names.length;
        assert.ok(Math.abs(Math.cos(center) - 1) < 1e-10);
        assert.ok(Math.abs(Math.sin(center)) < 1e-10);
        total++;
      }
    }
  }
  assert.equal(total, 72); assert.equal(wheel.randomStarts, 0);
  control.dispose();
});

test('missing target, truncated wheels, weights and incompatible geometry cannot publish a false winner', () => {
  for (const condition of ['missing', 'subset', 'weights', 'geometry']) {
    const wheel = new ReferenceWheel();
    const control = Native.attach(wheel);
    control.configure({ enabled: true, target: condition === 'missing' ? 'Absent' : 'Huy' });
    if (condition === 'subset') wheel.entryPicker.getAllEntries = () => [...wheel.entries, { text: 'An' }];
    if (condition === 'weights') wheel.entries[1].weight = 5;
    if (condition === 'geometry') wheel.getIndexAtPointer = () => 0;
    let called = 0;
    wheel.click(() => {}, () => called++);
    assert.equal(called, 0); assert.equal(wheel.randomStarts, 0);
    assert.ok(control.status().error.length > 0);
    control.dispose();
  }
});

test('changing target/list or disabling mid-spin cancels without a winner; restores original methods', () => {
  const wheel = new ReferenceWheel(); let now = 0, called = 0, cancelled = 0;
  const originalClick = wheel.click, originalSet = wheel.setEntries, originalConfigure = wheel.configure;
  const control = Native.attach(wheel, { now: () => now, onCancel: () => cancelled++ });
  control.configure({ enabled: true, target: 'Huy' });
  wheel.click(() => {}, () => called++); now = 1000; wheel.tick();
  control.configure({ enabled: true, target: 'Đạt' });
  assert.equal(wheel.isSpinning(), false); assert.equal(called, 0);
  wheel.click(() => {}, () => called++);
  wheel.setEntries([{ text: 'Đạt' }, { text: 'Huy' }]);
  assert.equal(wheel.isSpinning(), false); assert.equal(wheel.entries.length, 2);
  wheel.click(() => {}, () => called++); control.dispose();
  assert.equal(called, 0); assert.equal(cancelled, 3);
  assert.equal(wheel.click, originalClick); assert.equal(wheel.setEntries, originalSet); assert.equal(wheel.configure, originalConfigure);
  assert.equal(Object.hasOwn(wheel, 'click'), false);
  wheel.click(() => {}, () => called++); wheel.tick(); wheel.tick(); wheel.tick();
  assert.equal(wheel.randomStarts, 1); assert.equal(called, 1);
});

test('engine movement after state.tick is checked before publishing a native result', () => {
  const wheel = new ReferenceWheel(); let now = 0, called = 0;
  const originalTick = wheel.tick;
  wheel.tick = function () { originalTick.call(this); this.angle += Math.PI * 2 / this.entries.length; };
  const control = Native.attach(wheel, { now: () => now });
  control.configure({ enabled: true, target: 'Huy' });
  wheel.click(() => {}, () => called++);
  now = 5000; wheel.tick();
  assert.equal(called, 0);
  assert.match(control.status().error, /không khớp/);
  control.dispose();
});

test('partial adapter installation rolls back if a native method is read-only', () => {
  const wheel = new ReferenceWheel(); const original = wheel.click;
  Object.defineProperty(wheel, 'tick', { value: wheel.tick, writable: false, configurable: true });
  assert.throws(() => Native.attach(wheel), /đã khôi phục/);
  assert.equal(wheel.click, original);
  assert.equal(Object.hasOwn(wheel, 'click'), false);
});

async function boot(config = { enabled: true, target: 'Huy' }, supported = true) {
  const env = environment({ fixedWinnerDemo: config });
  const wheel = new ReferenceWheel(); let result = null, busy = false;
  const instance = { myWheel: wheel, $el: env.wheelContainer, displayOverlayText: true,
    $store: { commit(_key, value) { busy = value; } },
    spin() { if (busy) return; busy = true; wheel.click(() => {}, entry => { result = entry; busy = false; }); }
  };
  if (supported) env.wheelContainer.__vue__ = instance;
  env.nativeSpin.addEventListener('click', () => instance.spin());
  ['wheel-core.js','native-controller.js','page-bridge.js'].forEach(file => env.load(file, 'page'));
  ['wheel-core.js','page-reader.js','content.js'].forEach(file => env.load(file));
  await env.flush();
  return Object.assign(env, { wheel, instance, getResult: () => result, getBusy: () => busy });
}

test('two-world bridge: native control publishes site result, creates no second canvas, and restores on disable', async () => {
  const env = await boot();
  let status = await env.request('FWD_STATUS');
  assert.equal(status.supported, true); assert.equal(status.source, 'native');
  assert.doesNotMatch(env.ui.markup, /<canvas|<dialog/);
  assert.match(env.ui.markup, /CONTROLLED DEMO/);
  await env.nativeSpin.fire('click'); env.advance(500); env.wheel.tick(); env.advance(5000); env.wheel.tick(); await env.flush();
  assert.equal(env.getResult()?.text, 'Huy'); assert.equal(env.getBusy(), false);
  assert.match(env.ui.querySelector('.debug').textContent, /Kết quả thực tế: Huy/);
  await env.ui.querySelector('.disable').fire('click'); await env.flush();
  assert.equal(env.roots.at(-1).isConnected, false); assert.equal(env.storage.fixedWinnerDemo.enabled, false);
  await env.nativeSpin.fire('click'); env.wheel.tick(); env.wheel.tick(); env.wheel.tick();
  assert.equal(env.wheel.randomStarts, 1);
});

test('unsupported live shape is reported and native canvas click is blocked while controlled mode is enabled', async () => {
  const env = await boot({ enabled: true, target: 'Huy' }, false);
  const status = await env.request('FWD_STATUS');
  assert.equal(status.supported, false); assert.equal(status.available, false);
  assert.match(env.ui.querySelector('.status').textContent, /chưa được hỗ trợ/);
  let stopped = false;
  env.docHandlers.click({ type: 'click', target: env.nativeCanvas, preventDefault() {}, stopImmediatePropagation() { stopped = true; } });
  assert.equal(stopped, true);
});

test('popup persists normalized winner and shows native compatibility/missing-target feedback', async () => {
  const env = await boot(); env.load('popup.js'); await env.flush();
  env.elements.get('winner').value = ' Hoàng ';
  await env.elements.get('winner-form').fire('submit'); await env.flush();
  assert.equal(env.storage.fixedWinnerDemo.target, 'Hoàng');
  assert.match(env.elements.get('list-status').textContent, /Đã kết nối vòng quay gốc/);
  env.elements.get('winner').value = 'Absent'; await env.elements.get('winner-form').fire('submit'); await env.flush();
  assert.match(env.elements.get('message').textContent, /không tồn tại/);
  env.elements.get('enabled').checked = false; await env.elements.get('enabled').fire('change'); await env.flush();
  assert.equal(env.storage.fixedWinnerDemo.enabled, false);
});

test('manifest scopes both worlds to target host, uses only storage and includes packaged assets', () => {
  const root = path.join(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3); assert.deepEqual(manifest.permissions, ['storage']);
  assert.ok(manifest.content_scripts.some(script => script.world === 'MAIN'));
  for (const script of manifest.content_scripts) {
    assert.deepEqual(script.matches, ['https://wheelofnames.com/*']);
    for (const file of script.js) assert.ok(fs.statSync(path.join(root, file)).size > 0);
  }
});
