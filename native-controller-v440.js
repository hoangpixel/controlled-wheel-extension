/* Contract verified against the dist-v4402.js supplied by the user. */
(function (root) {
  "use strict";
  const Core = root.WheelDemoCore || (typeof require === "function" ? require("./wheel-core.js") : null);
  const Motion = root.FixedWinnerMotion440 || (typeof require === "function" ? require("./native-motion-v440.js") : null);
  const name = entry => Core.normalizeName(entry?.text);
  function compatible(wheel) {
    const state = wheel?.wheelState;
    return Boolean(state && Number.isFinite(state.angle) && Number.isFinite(state.speed) &&
      Array.isArray(state.visibleEntries) && Array.isArray(state.allEntries) &&
      ["click", "tick", "configure", "draw", "resetRotation", "refresh", "isSpinning", "getDisplayEntries", "getIndexAtPointer", "getEntryAtAngle", "getEntryAtPointer"].every(key => typeof wheel[key] === "function") &&
      typeof wheel.doneSpinningCallback === "function" && typeof wheel.nameChangedCallback === "function");
  }
  function inspect(wheel, target) {
    const angle = Core.wrap(wheel.wheelState.angle);
    const names = wheel.getDisplayEntries().map(name);
    const match = Core.resolveTarget(names, target);
    return { profile: "v440", names, angle, targetIndex: match.index, targetName: match.name, targetMatch: match.kind, targetError: match.error,
      pointerIndex: wheel.getIndexAtPointer(angle), pointerName: name(wheel.getEntryAtAngle(angle)) };
  }
  function plan(wheel, target, random) {
    const state = inspect(wheel, target);
    const entries = wheel.getDisplayEntries();
    if (!entries.length) throw new Error("Danh sách vòng quay gốc đang trống.");
    if (state.targetError) throw new Error(state.targetError);
    if (wheel.wheelConfig.type === "image") throw new Error("Chưa hỗ trợ vòng quay dùng ảnh phủ thay cho các ô tên.");
    if (entries.length !== wheel.wheelState.allEntries.length) throw new Error("Hãy tăng số ô tối đa để hiển thị toàn bộ danh sách trước khi bật điều khiển.");
    if (entries.some(entry => entry.weight != null && entry.weight !== 1)) throw new Error("Chưa hỗ trợ trọng số khác 1.");
    const step = Core.TAU / entries.length, center = state.targetIndex * step;
    const verify = angle => {
      if (wheel.getIndexAtPointer(angle) !== state.targetIndex || name(wheel.getEntryAtAngle(angle)) !== state.targetName) {
        throw new Error("Hệ tọa độ engine không khớp profile bản 440.");
      }
    };
    for (const offset of [-.4, 0, .4]) verify(Core.wrap(center + step * offset));
    const stop = Core.nativeLandingAngle(entries.length, state.targetIndex, random?.());
    verify(stop);
    const motion = Motion.create(wheel.wheelState, stop);
    return { ...state, stop, motion, end: state.angle + motion.distance };
  }
  function attach(wheel, options = {}) {
    if (!compatible(wheel)) throw new Error("Engine không khớp cấu trúc wheelState của bản 440.");
    if (wheel.isSpinning()) throw new Error("Vòng quay đang chạy. Đợi lượt hiện tại kết thúc.");
    let config = { enabled: true, target: "" }, active = null, result = "", error = "", disposed = false;
    let lastSample = -Infinity;
    let timing = null, spinCount = 0;
    const now = options.now || (() => performance.now());
    const random = options.random || (() => Math.random());
    const microtask = options.microtask || (fn => queueMicrotask(fn));
    const originals = new Map();
    const fingerprint = () => JSON.stringify([wheel.wheelState.visibleEntries, wheel.wheelState.allEntries]);
    function status() {
      let issue = error;
      if (!active) { try { plan(wheel, config.target); } catch (failure) { issue = failure.message; } }
      return { ...inspect(wheel, config.target), supported: true, ready: !issue, spinning: Boolean(active), result, error: issue };
    }
    function sample(force = false) {
      if (force || now() - lastSample >= 100) { lastSample = now(); options.onStatus?.(status()); }
    }
    function setAngle(angle, phase, speed = 0, ticksInPhase = null) {
      const previous = wheel.wheelState;
      const pointerIndex = wheel.getIndexAtPointer(angle);
      const entry = wheel.getEntryAtAngle(angle);
      wheel.wheelState = { ...previous, angle, speed, phase, ticksInPhase: ticksInPhase ?? previous.ticksInPhase + 1,
        prevIndexAtPointer: previous.indexAtPointer, indexAtPointer: pointerIndex, entryAtPointer: entry, visibleEntriesChanged: false };
      return { entry, changed: pointerIndex !== previous.indexAtPointer };
    }
    function abort(reason) {
      if (active) {
        active = null;
        setAngle(Core.wrap(wheel.wheelState.angle), "StoppedPhase");
        options.onCancel?.();
      }
      result = ""; error = reason; sample(true);
    }
    function restore() {
      for (const [key, saved] of originals) {
        if (wheel[key] !== saved.wrapper) continue;
        if (saved.descriptor) Object.defineProperty(wheel, key, saved.descriptor);
        else delete wheel[key];
      }
    }
    function patch(key, factory) {
      const descriptor = Object.getOwnPropertyDescriptor(wheel, key);
      const wrapper = factory(wheel[key]); originals.set(key, { descriptor, wrapper });
      try { wheel[key] = wrapper; }
      catch { restore(); throw new Error("Không thể cài adapter bản 440; đã hoàn tác các hàm đã đổi."); }
    }
    patch("click", original => function () {
      if (disposed || !config.enabled) return original.apply(this, arguments);
      if (active || wheel.isSpinning()) return;
      const clickedAt = now();
      let next;
      try { next = plan(wheel, config.target, random); }
      catch (failure) {
        error = failure.message; sample(true);
        // SpinningWheel emits spin-started AFTER click() returns.
        microtask(() => options.onCancel?.()); return;
      }
      original.apply(this, arguments);
      const reduced = options.reducedMotion?.() === true;
      const duration = reduced ? 900 : next.motion.durationMs;
      timing = { spin: ++spinCount, firstTickDelayMs: null, maxTickGapMs: 0, maxNameCallbackMs: 0,
        durationMs: duration, nativeTurns: next.motion.nativeDistance / Core.TAU,
        plannedTurns: reduced ? null : next.motion.distance / Core.TAU, speedScale: reduced ? null : next.motion.scale,
        configuredSeconds: wheel.wheelState.spinTime, slowSpin: wheel.wheelState.slowSpin === true };
      active = { start: next.angle, end: reduced ? next.angle + 6 * Core.TAU + Core.wrap(next.stop - next.angle) : next.end,
        motion: reduced ? null : next.motion, targetIndex: next.targetIndex, targetName: next.targetName,
        clickedAt, started: null, lastTickAt: null, timing, fingerprint: fingerprint(),
        duration };
      result = ""; error = ""; sample(true);
    });
    patch("tick", original => function () {
      if (!active) return original.apply(this, arguments);
      if (fingerprint() !== active.fingerprint) { abort("Đã hủy: danh sách engine thay đổi."); return; }
      const spin = active;
      const time = now();
      // Exclude work before the first renderer tick from the motion clock.
      if (spin.started === null) {
        spin.started = time;
        spin.timing.firstTickDelayMs = Math.max(0, time - spin.clickedAt);
      } else spin.timing.maxTickGapMs = Math.max(spin.timing.maxTickGapMs, time - spin.lastTickAt);
      spin.lastTickAt = time;
      const progress = Math.max(0, Math.min(1, (time - spin.started) / spin.duration));
      const trajectory = spin.motion?.sample(time - spin.started);
      const angle = Core.wrap(spin.start + (trajectory ? trajectory.distance : (spin.end - spin.start) * (1 - Math.pow(1 - progress, 4))));
      const phase = trajectory?.phase || (progress >= 1 ? "StoppedPhase" : progress < .2 ? "AcceleratingPhase" : "DeceleratingPhase");
      const update = setAngle(angle, phase, trajectory?.speed || 0, trajectory?.ticksInPhase);
      if (update.changed) {
        const callbackStarted = now();
        wheel.nameChangedCallback();
        spin.timing.maxNameCallbackMs = Math.max(spin.timing.maxNameCallbackMs, now() - callbackStarted);
      }
      if (active !== spin) return;
      if (phase !== "StoppedPhase") { sample(); return; }
      if (wheel.getIndexAtPointer(angle) !== active.targetIndex || name(wheel.getEntryAtAngle(angle)) !== active.targetName || wheel.getEntryAtPointer() !== update.entry) {
        abort("Đã hủy: kết quả thực tế dưới kim không khớp mục tiêu."); return;
      }
      active = null; result = name(update.entry); sample(true);
      // Constructor callback from the actual SpinningWheel: emits spin-stopped to EditWheelPage.
      wheel.doneSpinningCallback(update.entry);
    });
    for (const key of ["configure", "resetRotation"]) {
      patch(key, original => function () {
        if (active) abort("Đã hủy: danh sách hoặc cấu hình thay đổi.");
        result = ""; error = "";
        const value = original.apply(this, arguments); sample(true); return value;
      });
    }
    return {
      status, validate: () => plan(wheel, config.target),
      timing: () => timing ? { ...timing } : null,
      configure(next) {
        const target = Core.normalizeName(next.target);
        if (target !== config.target || next.enabled !== config.enabled) abort("");
        config = { enabled: next.enabled === true, target }; error = ""; return status();
      },
      dispose() { abort(""); disposed = true; restore(); }
    };
  }
  root.FixedWinnerNative440 = Object.freeze({ compatible, inspect, plan, attach });
  if (typeof module !== "undefined" && module.exports) module.exports = root.FixedWinnerNative440;
})(globalThis);
