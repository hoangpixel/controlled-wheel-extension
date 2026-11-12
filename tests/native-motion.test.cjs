const { test } = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../wheel-core.js');
const Motion = require('../native-motion-v440.js');
const Adapter = require('../native-controller-v440.js');
const { Wheel440 } = require('./engine-v440.cjs');

const config = (spinTime, slowSpin) => ({ entries: ['Nguyễn Văn An', 'Lê Minh Huy', 'Trần Quốc Đạt', 'Phạm Minh Hoàng'].map(text => ({ text })),
  type: 'color', spinTime, slowSpin, maxNames: 1000, allowDuplicates: true });

test('analytic v440 trajectory matches original phase lengths and per-tick speed at every tick', () => {
  for (const spinTime of [.9, 1, 5, 10, 30]) for (const slowSpin of [false, true]) for (const stopped of [false, true]) {
    let done = false;
    const wheel = new Wheel440(() => {}, () => { done = true; });
    wheel.configure(config(spinTime, slowSpin));
    if (stopped) wheel.wheelState = { ...wheel.wheelState, phase: 'StoppedPhase', speed: 0 };
    const initial = { ...wheel.wheelState };
    for (const stop of [0, .2, 3, 6.2]) {
      const candidate = Motion.create(initial, stop);
      assert.ok(candidate.distance > 0);
      const angularError = initial.angle + candidate.distance - stop;
      assert.ok(Math.abs(Math.atan2(Math.sin(angularError), Math.cos(angularError))) < 1e-9);
      if (candidate.nativeDistance >= Math.PI) assert.ok(Math.abs(candidate.adjustment) <= Math.PI + 1e-9);
    }
    const motion = Motion.create(initial, .2);
    wheel.click();
    let traveled = 0;
    for (let tick = 1; tick <= motion.totalTicks; tick++) {
      const speed = wheel.wheelState.speed;
      traveled += speed;
      wheel.tick(() => .75);
      const sample = motion.sample(tick * Motion.TICK_MS);
      assert.equal(sample.phase, wheel.wheelState.phase, `T=${spinTime}, slow=${slowSpin}, tick=${tick}`);
      assert.equal(sample.ticksInPhase, wheel.wheelState.ticksInPhase);
      assert.ok(Math.abs(sample.distance / motion.scale - traveled) < 1e-8);
      if (tick < motion.totalTicks) {
        const nextSpeed = motion.sample(tick * Motion.TICK_MS + 1e-5).speed / motion.scale;
        assert.ok(Math.abs(nextSpeed - wheel.wheelState.speed) < 1e-9);
        assert.equal(done, false);
      }
    }
    assert.equal(done, true);
    assert.ok(Math.abs(motion.adjustment) <= Math.PI + 1e-9);
    assert.ok(Math.abs(Core.wrap(initial.angle + motion.distance) - .2) < 1e-9);
  }
});

test('native controller retains complete native durations, slow-spin mode and actual winners through 30-second spins', () => {
  for (const spinTime of [1, 5, 10, 30]) for (const slowSpin of [false, true]) {
    let time = 0, calls = 0, winner;
    const wheel = new Wheel440(() => {}, entry => { calls++; winner = entry; });
    wheel.configure(config(spinTime, slowSpin));
    const control = Adapter.attach(wheel, { now: () => time, random: () => .75 });
    control.configure({ enabled: true, target: 'huy' });
    for (let repeat = 0; repeat < 2; repeat++) {
      const plan = Adapter.plan(wheel, 'huy', () => .75);
      wheel.click(); time += 120;
      wheel.tick(() => { throw new Error('Unexpected native RNG'); });
      const epoch = time;
      for (let tick = 1; tick <= plan.motion.totalTicks; tick++) {
        time = epoch + tick * Motion.TICK_MS;
        wheel.tick(() => { throw new Error('Unexpected native RNG'); });
        const expected = plan.motion.sample(tick * Motion.TICK_MS);
        assert.ok(Math.abs(wheel.wheelState.angle - Core.wrap(plan.angle + expected.distance)) < 1e-8);
        assert.equal(wheel.wheelState.phase, expected.phase);
        assert.equal(calls, repeat + (tick === plan.motion.totalTicks ? 1 : 0));
      }
      assert.equal(winner, wheel.getDisplayEntries()[1]);
      assert.equal(wheel.getEntryAtPointer(), winner);
      assert.equal(control.timing().durationMs, plan.motion.durationMs);
      if (spinTime === 30) assert.ok(control.timing().durationMs > 30000);
    }
    control.dispose();
  }
});
