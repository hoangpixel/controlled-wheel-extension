const { test } = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../wheel-core.js');
const Native = require('../native-controller.js');
const Adapter440 = require('../native-controller-v440.js');
const { ReferenceWheel } = require('./native-fixture.cjs');
const { Wheel440 } = require('./engine-v440.cjs');

test('short names match complete trailing words, preserve accents and report ambiguous people', () => {
  const names = ['Nguyễn Văn An', 'Lê Minh Anh', 'Trần Đức An', 'Phạm Minh Hoàng'];
  assert.equal(Core.resolveTarget(names, ' Hoàng ').name, 'Phạm Minh Hoàng');
  assert.equal(Core.resolveTarget(names, '  MINH   HOÀNG ').name, 'Phạm Minh Hoàng');
  assert.equal(Core.resolveTarget(names, 'nguyễn văn an').index, 0);
  assert.equal(Core.resolveTarget(names, 'Anh').index, 1);
  assert.equal(Core.resolveTarget(names, 'An').kind, 'ambiguous');
  assert.equal(Core.findTarget(names, 'An'), -1);
  assert.equal(Core.resolveTarget(names, 'Văn An').index, 0);
  for (const query of ['Hoang', 'Minh', 'Nguyễn', 'nh', 'Văn']) assert.equal(Core.findTarget(names, query), -1, query);
  assert.equal(Core.resolveTarget(names, '  ').kind, 'empty');
  assert.equal(Core.findTarget(['An', 'Nguyễn Văn An'], 'an'), 0, 'exact entry takes priority');
  assert.equal(Core.findTarget(['Nguyễn Văn An', 'Nguyễn Văn An'], 'Nguyễn Văn An'), 0, 'identical entries retain first-match behavior');
  assert.equal(Core.resolveTarget(['Nguyễn  Văn\tAn'], 'văn an').name, 'Nguyễn  Văn\tAn', 'display text is not rewritten');
});

test('landing positions cover both sides, exclude the center and leave a margin before every boundary', () => {
  for (const count of [1, 2, 3, 7, 32, 100, 1000]) {
    for (let index = 0; index < count; index++) {
      const offsets = [];
      for (const sample of [0, .000001, .25, .499999, .5, .75, .999999999]) {
        const angle = Core.nativeLandingAngle(count, index, sample);
        const step = Core.TAU / count;
        const offset = (Core.wrap(angle - index * step + Math.PI) - Math.PI) / step;
        assert.ok(Math.abs(offset) >= .1 - 1e-9 && Math.abs(offset) <= .4 + 1e-9);
        assert.equal(Math.round(angle / step) % count, index, `count=${count}, index=${index}, sample=${sample}`);
        offsets.push(offset);
      }
      assert.ok(offsets.some(x => x < 0) && offsets.some(x => x > 0));
    }
  }
  for (const bad of [-1, 1, NaN, Infinity]) assert.throws(() => Core.nativeLandingAngle(4, 1, bad), RangeError);
});

for (const profile of ['legacy', 'v440']) {
  test(`${profile}: short-name spins stay inside the resolved full-name slice after every reorder`, () => {
    const names = ['Nguyễn Văn An', 'Lê Minh Huy', 'Phạm Minh Hoàng'];
    const orders = [names, [names[0], names[2], names[1]], [names[1], names[0], names[2]],
      [names[1], names[2], names[0]], [names[2], names[0], names[1]], [names[2], names[1], names[0]]];
    let now = 0, samples = 0, called = 0, result;
    const done = entry => { called++; result = entry; };
    const wheel = profile === 'v440' ? new Wheel440(() => {}, done) : new ReferenceWheel();
    const adapter = profile === 'v440' ? Adapter440 : Native;
    const setEntries = values => profile === 'v440'
      ? wheel.configure({ entries: values.map((text, index) => ({ id: String(index), text })), type: 'color', spinTime: 5, maxNames: 1000, allowDuplicates: true })
      : wheel.setEntries(values.map(text => ({ text })));
    setEntries(names);
    const control = adapter.attach(wheel, { now: () => now, random: () => [0, .25, .5, .999999][samples++ % 4] });
    const spin = () => profile === 'v440' ? wheel.click() : wheel.click(() => {}, done);
    const tick = () => wheel.tick(() => { throw new Error('Native RNG must not be called during controlled spins'); });
    for (const order of orders) {
      setEntries(order);
      for (const [target, full] of [['an', names[0]], ['HUY', names[1]], ['minh hoàng', names[2]]]) {
        control.configure({ enabled: true, target });
        const beforeSamples = samples;
        control.status(); control.validate(); control.status();
        assert.equal(samples, beforeSamples, 'polling/guard cannot change the next landing');
        assert.equal(control.status().targetName, full);
        const landings = new Set();
        for (let repeat = 0; repeat < 4; repeat++) {
          const before = called;
          spin(); now += 5000; tick(); tick();
          assert.equal(called, before + 1);
          assert.equal(result.text, full);
          const entries = profile === 'v440' ? wheel.getDisplayEntries() : wheel.entries;
          assert.equal(result, entries[order.indexOf(full)]);
          assert.equal(wheel.getEntryAtPointer(), result);
          const angle = profile === 'v440' ? wheel.wheelState.angle : wheel.angle;
          const step = Core.TAU / order.length;
          const offset = (Core.wrap(angle - order.indexOf(full) * step + Math.PI) - Math.PI) / step;
          assert.ok(Math.abs(offset) >= .1 - 1e-9 && Math.abs(offset) <= .4 + 1e-9);
          landings.add(angle.toFixed(9));
        }
        assert.equal(landings.size, 4, 'each injected sample must produce its own position');
      }
    }
    setEntries(['Nguyễn Văn An', 'Trần Đức An']);
    control.configure({ enabled: true, target: 'an' });
    assert.match(control.status().error, /khớp 2 mục nhập/);
    const before = called;
    spin(); tick();
    assert.equal(called, before); assert.equal(wheel.isSpinning(), false);
    assert.equal(samples, 72, 'ambiguous target cannot sample or start a spin');
    control.dispose();
  });
}
