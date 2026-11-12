const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../wheel-core.js');
const Reader = require('../page-reader.js');
const { Element, environment } = require('./harness.cjs');

test('Vietnamese names retain accents, internal spaces and duplicates; normalize NFC and outer spaces', () => {
  assert.deepEqual(Core.parseNames('  Hoàng  \r\nHuy\n\nĐạt\nNguyễn Văn An\nHuy'), ['Hoàng', 'Huy', 'Đạt', 'Nguyễn Văn An', 'Huy']);
  assert.equal(Core.findTarget(['Hoàng', 'Huy', 'Đạt'], ' Hoàng '), 0);
  assert.equal(Core.findTarget(['Hoàng'], 'hoàng'), -1);
  assert.equal(Core.findTarget(['Hoàng'], 'Hoang'), -1);
});

test('pointer geometrically aligns with target center across sizes, orderings and starting angles', () => {
  let checked = 0;
  for (const count of [1, 2, 3, 7, 32, 100, 1000]) {
    for (let index = 0; index < count; index++) {
      for (const start of [-28, 0, .7, 6.1, 135]) {
        const stop = Core.landingAngle(count, index, start);
        const center = stop + (index + .5) * Math.PI * 2 / count;
        // Independent Cartesian geometry: center must face straight up.
        assert.ok(Math.abs(Math.cos(center)) < 1e-10);
        assert.ok(Math.abs(Math.sin(center) + 1) < 1e-10);
        assert.ok(stop - start >= 6 * Math.PI * 2 - 1e-10);
        assert.equal(Core.indexAtPointer(count, stop), index);
        checked++;
      }
    }
  }
  assert.ok(checked > 5000);
});

test('reader supports textarea, contenteditable, empty lists, ambiguous/hidden/unrelated fields', () => {
  const editor = new Element('TEXTAREA'); editor.id = 'entries'; editor.value = 'Hoàng\nHuy\nĐạt';
  const doc = (...items) => ({ querySelectorAll: () => items });
  assert.deepEqual(Reader.read(doc(editor)).names, ['Hoàng', 'Huy', 'Đạt']);
  editor.value = ''; assert.equal(Reader.read(doc(editor)).available, true);
  assert.deepEqual(Reader.read(doc(editor)).names, []);
  const rich = new Element(); rich.className = 'ql-editor'; rich.innerText = 'Hoàng\nĐạt';
  assert.deepEqual(Reader.read(doc(rich)).names, ['Hoàng', 'Đạt']);
  const search = new Element('TEXTAREA'); search.id = 'search';
  assert.equal(Reader.read(doc(search)).available, false);
  const other = new Element('TEXTAREA'); editor.id = ''; assert.equal(Reader.read(doc(editor, other)).available, false);
  editor.hidden = true; assert.equal(Reader.read(doc(editor)).available, false);
  rich.inDialog = true; assert.equal(Reader.read(doc(rich)).available, false);
  rich.inDialog = false;
  const nested = new Element(); nested.parentElement = { closest: () => rich };
  assert.equal(Reader.discover(doc(rich, nested)), rich);
});

async function boot(config = { enabled: true, target: 'Hoàng' }, names) {
  const env = environment({ fixedWinnerDemo: config }, names);
  ['wheel-core.js', 'page-reader.js', 'content.js'].forEach(env.load);
  await env.flush();
  return env;
}
async function finishSpin(env) {
  await env.ui.querySelector('.spin').fire('click');
  env.advance(0); env.advance(1200); env.advance(3000); env.advance(4800);
  return env.ui.querySelector('.result strong').textContent;
}

test('actual content lifecycle: target survives Shuffle/Sort and changes to Huy/Đạt', async () => {
  const env = await boot();
  assert.equal((await env.request('FWD_OPEN')).ok, true);
  assert.equal(env.ui.querySelector('dialog').open, true);
  for (const names of ['Hoàng\nHuy\nĐạt', 'Đạt\nHoàng\nHuy', 'Huy\nĐạt\nHoàng']) {
    env.editor.value = names;
    assert.equal(await finishSpin(env), 'Hoàng');
    assert.match(env.ui.querySelector('canvas').getAttribute('aria-label'), /kim chỉ vào Hoàng/);
  }
  for (const target of ['Huy', 'Đạt']) {
    await env.chrome.storage.local.set({ fixedWinnerDemo: { enabled: true, target } });
    assert.equal(await finishSpin(env), target);
  }
});

test('removed target warns and blocks spin; list/target changes cancel an ongoing animation', async () => {
  const env = await boot();
  await env.ui.querySelector('.spin').fire('click'); env.advance(0); env.advance(500);
  env.editor.value = 'Huy\nĐạt';
  const status = await env.request('FWD_STATUS');
  assert.equal(status.targetFound, false);
  assert.equal(env.ui.querySelector('.spin').disabled, true);
  assert.match(env.ui.querySelector('.status').textContent, /Không tìm thấy/);
  assert.equal(env.raf.size, 0);
  assert.match(env.ui.querySelector('.result strong').textContent, /Đã hủy/);
  env.editor.value = 'Hoàng\nHuy\nĐạt'; await env.request('FWD_STATUS');
  await env.ui.querySelector('.spin').fire('click'); env.advance(0);
  await env.chrome.storage.local.set({ fixedWinnerDemo: { enabled: true, target: 'Huy' } });
  assert.equal(env.raf.size, 0);
  assert.equal(await finishSpin(env), 'Huy');
});

test('disable removes UI/watchers and leaves site editor untouched; config survives reload', async () => {
  const env = await boot();
  const text = env.editor.value;
  await env.chrome.storage.local.set({ fixedWinnerDemo: { enabled: false, target: 'Huy' } });
  assert.equal(env.roots.at(-1).isConnected, false);
  assert.equal(env.intervals.size, 0);
  assert.equal(Object.keys(env.docHandlers).length, 0);
  assert.equal(env.editor.value, text);
  assert.equal((await env.request('FWD_OPEN')).ok, false);
  const reloaded = await boot(env.storage.fixedWinnerDemo);
  assert.equal(reloaded.roots.length, 0);
  await reloaded.chrome.storage.local.set({ fixedWinnerDemo: { enabled: true, target: 'Huy' } });
  assert.equal(await finishSpin(reloaded), 'Huy');
});

test('manual fallback persists list; close cancels spin and reopen remains usable', async () => {
  const env = await boot();
  env.editor.hidden = true;
  assert.equal((await env.request('FWD_STATUS')).available, false);
  const select = env.ui.querySelector('select'); select.value = 'manual'; await select.fire('change');
  env.ui.querySelector('#fwd-manual').value = 'Hoàng\nHuy\nĐạt';
  await env.ui.querySelector('.apply').fire('click');
  assert.equal((await env.request('FWD_STATUS')).source, 'manual');
  assert.deepEqual(env.storage.fixedWinnerDemoManualNames, ['Hoàng', 'Huy', 'Đạt']);
  assert.equal(await finishSpin(env), 'Hoàng');
  await env.request('FWD_OPEN');
  await env.ui.querySelector('.spin').fire('click'); env.advance(0);
  await env.ui.querySelector('.close').fire('click');
  assert.equal(env.raf.size, 0);
  assert.equal(env.ui.querySelector('dialog').open, false);
  await env.request('FWD_OPEN'); assert.equal(await finishSpin(env), 'Hoàng');
});

test('popup saves normalized target, warns for missing names and persists toggle', async () => {
  const env = await boot(); env.load('popup.js'); await env.flush();
  env.elements.get('winner').value = '  Hoàng  ';
  await env.elements.get('winner-form').fire('submit'); await env.flush();
  assert.equal(env.storage.fixedWinnerDemo.target, 'Hoàng');
  assert.match(env.elements.get('message').textContent, /Đã lưu/);
  env.elements.get('winner').value = 'Không tồn tại';
  await env.elements.get('winner-form').fire('submit'); await env.flush();
  assert.equal(env.elements.get('message').dataset.kind, 'error');
  assert.match(env.elements.get('message').textContent, /không tồn tại/);
  env.elements.get('enabled').checked = false;
  await env.elements.get('enabled').fire('change'); await env.flush();
  assert.equal(env.storage.fixedWinnerDemo.enabled, false);
  assert.equal(env.elements.get('mode-label').textContent, 'Disabled');
});

test('manifest restricts scope and requests only storage, with all referenced assets present', () => {
  const root = path.join(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://wheelofnames.com/*']);
  for (const file of [...manifest.content_scripts[0].js, manifest.action.default_popup, 'popup.css', 'popup.js']) {
    assert.ok(fs.statSync(path.join(root, file)).size > 0);
  }
});
