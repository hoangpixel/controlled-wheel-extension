const { test } = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../wheel-core.js');
const Legacy = require('../native-controller.js');
const Adapter440 = require('../native-controller-v440.js');
const { ReferenceWheel } = require('./native-fixture.cjs');
const { Wheel440 } = require('./engine-v440.cjs');

for (const profile of ['legacy', 'v440']) {
  test(`${profile}: delayed first frames preserve the angle and follow the selected trajectory on both spins`, () => {
    for (const wait of [0, 5000]) for (const fps of [30, 60, 144]) {
      for (const duration of [900, 1000, 5000]) for (const coldDelay of [0, 120, 500]) {
        let time = 0, called = 0, winner;
        const done = entry => { called++; winner = entry; };
        const names = ['Nguyễn Văn An', 'Lê Minh Huy', 'Trần Quốc Đạt', 'Phạm Minh Hoàng'];
        const adapter = profile === 'v440' ? Adapter440 : Legacy;
        const wheel = profile === 'v440' ? new Wheel440(() => {}, done) : new ReferenceWheel(names);
        if (profile === 'v440') wheel.configure({ entries: names.map(text => ({ text })), type: 'color',
          spinTime: duration / 1000, maxNames: 1000, allowDuplicates: true });
        else wheel.wheelConfig.spinTime = duration / 1000;
        const control = adapter.attach(wheel, { now: () => time, random: () => .5, reducedMotion: () => duration === 900 });
        control.configure({ enabled: true, target: 'an' });
        time = wait;
        assert.equal(control.status().ready, true);
        const angle = () => profile === 'v440' ? wheel.wheelState.angle : wheel.angle;
        const tick = () => wheel.tick(() => { throw new Error('Native RNG must not run in a controlled spin'); });
        for (const [spin, delay] of [coldDelay, 1000 / fps].entries()) {
          const label = `${profile}, wait=${wait}, fps=${fps}, duration=${duration}, spin=${spin + 1}, delay=${delay}`;
          const start = angle(), planned = adapter.plan(wheel, 'an', () => .5);
          const native = profile === 'v440' && duration !== 900 ? planned.motion : null;
          const runDuration = native ? native.durationMs : duration;
          const end = profile === 'v440' && duration === 900 ? start + 6 * Core.TAU + Core.wrap(planned.stop - start) : planned.end;
          if (profile === 'v440') wheel.click(); else wheel.click(() => {}, done);
          assert.equal(angle(), start, label + ': preserve the click angle');
          time += delay; tick();
          assert.ok(Math.abs(angle() - start) < 1e-10, label + ': first frame cannot include pre-render waiting time');
          const firstFrame = time;
          for (const elapsed of [1000 / fps, runDuration * .05, runDuration * .2, runDuration * .5, runDuration * .8, runDuration]) {
            time = firstFrame + elapsed + (elapsed === runDuration ? 1e-6 : 0); tick();
            const expected = Core.wrap(start + (native ? native.sample(elapsed).distance : (end - start) * (1 - Math.pow(1 - elapsed / duration, 4))));
            assert.ok(Math.abs(angle() - expected) < 1e-9, label + ': follow the planned trajectory after the first frame');
          }
          assert.equal(called, spin + 1, label);
          assert.equal(winner.text, names[0], label);
          assert.equal(wheel.getEntryAtPointer(), winner, label);
          assert.equal(control.status().spinning, false, label);
          tick(); assert.equal(called, spin + 1, label + ': callback only once');
        }
        control.dispose();
      }
    }
  });
}

test('v440 timing separates first-frame waiting, tick gaps and native name-change callback cost', () => {
  let time = 0;
  const wheel = new Wheel440(() => { time += 75; }, () => {});
  wheel.configure({ entries: ['Nguyễn Văn An', 'Lê Minh Huy', 'Trần Quốc Đạt', 'Phạm Minh Hoàng'].map(text => ({ text })),
    type: 'color', spinTime: 5, maxNames: 1000, allowDuplicates: true });
  const control = Adapter440.attach(wheel, { now: () => time, random: () => .5 });
  control.configure({ enabled: true, target: 'an' });
  wheel.click(); time = 120; wheel.tick(() => .5);
  assert.equal(control.timing().firstTickDelayMs, 120);
  time = 370; wheel.tick(() => .5);
  assert.equal(control.timing().maxNameCallbackMs, 75);
  assert.equal(control.timing().maxTickGapMs, 250);
  assert.equal(control.timing().spin, 1);
  assert.doesNotMatch(JSON.stringify(control.timing()), /Nguyễn|Huy|An|Đạt|Hoàng/);
  control.dispose();
});
