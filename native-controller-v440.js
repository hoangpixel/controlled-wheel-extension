/* Contract verified against the dist-v4402.js supplied by the user. */
(function (root) {
  "use strict";
  const Core = root.WheelDemoCore || (typeof require === "function" ? require("./wheel-core.js") : null);
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
    return { profile: "v440", names, angle, targetIndex: Core.findTarget(names, target),
      pointerIndex: wheel.getIndexAtPointer(angle), pointerName: name(wheel.getEntryAtAngle(angle)) };
  }
  function plan(wheel, target) {
    const state = inspect(wheel, target);
    const entries = wheel.getDisplayEntries();
    if (!entries.length) throw new Error("Danh sách vòng quay gốc đang trống.");
    if (!target) throw new Error("Hãy nhập tên và bấm Save Winner trong popup.");
    if (state.targetIndex < 0) throw new Error(`Không tìm thấy “${target}” trên vòng quay gốc.`);
    if (wheel.wheelConfig.type === "image") throw new Error("Chưa hỗ trợ vòng quay dùng ảnh phủ thay cho các ô tên.");
    if (entries.length !== wheel.wheelState.allEntries.length) throw new Error("Hãy tăng số ô tối đa để hiển thị toàn bộ danh sách trước khi bật điều khiển.");
    if (entries.some(entry => entry.weight != null && entry.weight !== 1)) throw new Error("Chưa hỗ trợ trọng số khác 1.");
    const step = Core.TAU / entries.length, stop = state.targetIndex * step;
    for (const offset of [-.2, 0, .2]) {
      const angle = Core.wrap(stop + step * offset);
      if (wheel.getIndexAtPointer(angle) !== state.targetIndex || name(wheel.getEntryAtAngle(angle)) !== Core.normalizeName(target)) {
        throw new Error("Hệ tọa độ engine không khớp profile bản 440.");
      }
    }
    return { ...state, end: state.angle + 6 * Core.TAU + Core.wrap(stop - state.angle) };
  }
  function attach(wheel, options = {}) {
    if (!compatible(wheel)) throw new Error("Engine không khớp cấu trúc wheelState của bản 440.");
    if (wheel.isSpinning()) throw new Error("Vòng quay đang chạy. Đợi lượt hiện tại kết thúc.");
    let config = { enabled: true, target: "" }, active = null, result = "", error = "", disposed = false;
    let lastSample = -Infinity;
    const now = options.now || (() => performance.now());
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
    function setAngle(angle, phase) {
      const previous = wheel.wheelState;
      const pointerIndex = wheel.getIndexAtPointer(angle);
      const entry = wheel.getEntryAtAngle(angle);
      wheel.wheelState = { ...previous, angle, speed: 0, phase, ticksInPhase: previous.ticksInPhase + 1,
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
      let next;
      try { next = plan(wheel, config.target); }
      catch (failure) {
        error = failure.message; sample(true);
        // SpinningWheel emits spin-started AFTER click() returns.
        microtask(() => options.onCancel?.()); return;
      }
      original.apply(this, arguments);
      active = { start: next.angle, end: next.end, target: config.target, started: now(), fingerprint: fingerprint(),
        duration: options.reducedMotion?.() ? 900 : Math.max(1000, Math.min(20000, (Number(wheel.wheelConfig.spinTime) || 5) * 1000)) };
      result = ""; error = ""; sample(true);
    });
    patch("tick", original => function () {
      if (!active) return original.apply(this, arguments);
      if (fingerprint() !== active.fingerprint) { abort("Đã hủy: danh sách engine thay đổi."); return; }
      const spin = active;
      const progress = Math.max(0, Math.min(1, (now() - active.started) / active.duration));
      const angle = Core.wrap(active.start + (active.end - active.start) * (1 - Math.pow(1 - progress, 4)));
      const update = setAngle(angle, progress >= 1 ? "StoppedPhase" : progress < .2 ? "AcceleratingPhase" : "DeceleratingPhase");
      if (update.changed) wheel.nameChangedCallback();
      if (active !== spin) return;
      if (progress < 1) { sample(); return; }
      if (name(wheel.getEntryAtAngle(angle)) !== active.target || wheel.getEntryAtPointer() !== update.entry) {
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
