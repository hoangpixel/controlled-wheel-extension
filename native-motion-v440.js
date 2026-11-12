/* Continuous angle trajectory derived from the supplied v440 fixed-tick physics.
 * Uses its acceleration, decay and phase lengths, without its RNG angle reset.
 */
(function (root) {
  "use strict";
  const Core = root.WheelDemoCore || (typeof require === "function" ? require("./wheel-core.js") : null);
  const TICK_MS = 1000 / 60; // SpinningWheel's scheduler in ConfettiLauncher-v440.js.
  function create(state, stop) {
    const { fps, spinTime, speed: initialSpeed } = state;
    if (!Number.isFinite(fps) || fps <= 0 || !Number.isFinite(spinTime) || spinTime <= 0 ||
        !Number.isFinite(initialSpeed) || initialSpeed < 0 || !Number.isFinite(stop)) {
      throw new Error("Thông số physics của engine 440 không hợp lệ.");
    }
    const acceleration = state.slowSpin ? .001 : .6 / fps;
    const accelerationThreshold = Math.min(fps, spinTime * fps / 3);
    const decelerationThreshold = spinTime * fps - accelerationThreshold;
    const accelerationTicks = Math.floor(accelerationThreshold) + 2;
    const decelerationTicks = Math.floor(decelerationThreshold) + 1;
    const totalTicks = accelerationTicks + decelerationTicks;
    const durationMs = totalTicks * TICK_MS;
    if (!Number.isSafeInteger(totalTicks) || !Number.isFinite(durationMs)) throw new Error("Thời lượng physics không hợp lệ.");
    // The native transition uses ticksInPhase, while its decay reference uses
    // accelerationThreshold + 1. Preserve that distinction and its extra ticks.
    const transitionSpeed = acceleration * (accelerationTicks - 1);
    const referenceSpeed = .005 + (accelerationThreshold + 1) * acceleration;
    const decayLog = Math.log(.00015 / referenceSpeed) / decelerationThreshold;
    const accelerationDistance = accelerationTicks * initialSpeed + acceleration * accelerationTicks * (accelerationTicks - 1) / 2;
    const decayDistance = ticks => transitionSpeed * (-Math.expm1(decayLog * ticks)) / (-Math.expm1(decayLog));
    const nativeDistance = accelerationDistance + decayDistance(decelerationTicks);
    if (!Number.isFinite(nativeDistance) || nativeDistance <= 0) throw new Error("Không lập được quỹ đạo physics 440.");
    const adjustment = Core.wrap(stop - state.angle - nativeDistance + Math.PI) - Math.PI;
    let distance = nativeDistance + adjustment;
    if (distance <= 1e-9) distance += Core.TAU;
    const scale = distance / nativeDistance;
    function sample(elapsedMs) {
      const rawTicks = Math.max(0, Math.min(totalTicks, elapsedMs / TICK_MS));
      const nearestTick = Math.round(rawTicks);
      const ticks = Math.abs(rawTicks - nearestTick) < 1e-9 ? nearestTick : rawTicks;
      if (ticks >= totalTicks) return { distance, speed: 0, phase: "StoppedPhase", ticksInPhase: 1 };
      const whole = Math.floor(ticks), fraction = ticks - whole;
      let traveled, speed;
      if (whole < accelerationTicks) {
        traveled = whole * initialSpeed + acceleration * whole * (whole - 1) / 2;
        speed = initialSpeed + whole * acceleration;
      } else {
        const decelerationTick = whole - accelerationTicks;
        traveled = accelerationDistance + decayDistance(decelerationTick);
        speed = transitionSpeed * Math.exp(decayLog * decelerationTick);
      }
      return { distance: (traveled + fraction * speed) * scale, speed: speed * scale,
        phase: ticks < accelerationTicks ? "AcceleratingPhase" : "DeceleratingPhase",
        ticksInPhase: ticks < accelerationTicks ? whole : whole - accelerationTicks + 1 };
    }
    return Object.freeze({ sample, durationMs, totalTicks, accelerationTicks, decelerationTicks,
      nativeDistance, distance, scale, adjustment: distance - nativeDistance });
  }
  root.FixedWinnerMotion440 = Object.freeze({ create, TICK_MS });
  if (typeof module !== "undefined" && module.exports) module.exports = root.FixedWinnerMotion440;
})(globalThis);
