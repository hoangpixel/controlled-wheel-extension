/* Adapter for the Wheel contract in momander/wheel-spinner. No global RNG hooks. */
(function (root) {
  "use strict";
  const Core = root.WheelDemoCore || (typeof require === "function" ? require("./wheel-core.js") : null);
  const text = (entry) => Core.normalizeName(typeof entry === "string" ? entry : entry?.text);
  function compatible(wheel) {
    if (root.FixedWinnerNative440?.compatible(wheel)) return true;
    return wheel && Number.isFinite(wheel.angle) && Number.isFinite(wheel.speed) &&
      ["click", "tick", "setEntries", "configure", "getIndexAtPointer", "getEntryAtPointer", "isSpinning", "spinIsDone", "refresh"].every(key => typeof wheel[key] === "function") &&
      typeof wheel.entryPicker?.getDisplayEntries === "function" && typeof wheel.entryPicker?.getAllEntries === "function" &&
      ["tick", "click", "drawThisFrame", "isSpinning"].every(key => typeof wheel.state?.[key] === "function");
  }
  function inspect(wheel, target) {
    if (root.FixedWinnerNative440?.compatible(wheel)) return root.FixedWinnerNative440.inspect(wheel, target);
    const entries = wheel.entryPicker.getDisplayEntries();
    const names = entries.map(text);
    return { names, targetIndex: Core.findTarget(names, target), angle: Core.wrap(wheel.angle), pointerIndex: wheel.getIndexAtPointer(), pointerName: text(wheel.getEntryAtPointer()) };
  }
  function plan(wheel, target) {
    if (root.FixedWinnerNative440?.compatible(wheel)) return root.FixedWinnerNative440.plan(wheel, target);
    const state = inspect(wheel, target);
    const entries = wheel.entryPicker.getDisplayEntries();
    if (!entries.length) throw new Error("Danh sách vòng quay gốc đang trống.");
    if (!target) throw new Error("Hãy nhập tên và bấm Save Winner trong popup.");
    if (wheel.wheelConfig?.type === "image") throw new Error("Chưa hỗ trợ vòng quay dùng ảnh phủ thay cho các ô tên.");
    if (state.targetIndex < 0) throw new Error(`Không tìm thấy “${target}” trên vòng quay gốc.`);
    if (entries.length !== wheel.entryPicker.getAllEntries().length) throw new Error("Chưa hỗ trợ vòng quay chỉ hiển thị một phần danh sách. Hãy tăng số ô tối đa để hiển thị tất cả tên.");
    if (entries.some(entry => typeof entry === "object" && entry.weight != null && entry.weight !== 1)) throw new Error("Chưa hỗ trợ trọng số khác 1 trên vòng quay gốc.");
    // Native wheel: pointer on the right; first slice is centered at angle 0.
    // Validate the native getter instead of reusing the separate demo's top pointer.
    const step = Core.TAU / entries.length;
    const stop = state.targetIndex * step;
    const originalAngle = wheel.angle;
    try {
      for (const offset of [-.2, 0, .2]) {
        wheel.angle = Core.wrap(stop + step * offset);
        if (wheel.getIndexAtPointer() !== state.targetIndex || text(wheel.getEntryAtPointer()) !== Core.normalizeName(target)) {
          throw new Error("Hệ tọa độ của vòng quay gốc không tương thích với adapter này.");
        }
      }
    } finally { wheel.angle = originalAngle; }
    return { ...state, end: wheel.angle + 6 * Core.TAU + Core.wrap(stop - Core.wrap(wheel.angle)) };
  }
  function attach(wheel, options = {}) {
    if (root.FixedWinnerNative440?.compatible(wheel)) return root.FixedWinnerNative440.attach(wheel, options);
    if (!compatible(wheel)) throw new Error("Không nhận diện được engine vòng quay tương thích.");
    if (wheel.isSpinning()) throw new Error("Vòng quay đang chạy. Đợi lượt hiện tại kết thúc rồi thử lại.");
    let config = { enabled: true, target: "" }, active = null, disposed = false;
    let result = "", error = "", lastSample = -Infinity;
    const originals = new Map();
    const clock = options.now || (() => performance.now());
    const fingerprint = () => JSON.stringify(wheel.entryPicker.getDisplayEntries());
    const sample = (force = false) => {
      const now = clock();
      if (force || now - lastSample >= 100) { lastSample = now; options.onStatus?.(status()); }
    };
    function status() {
      let issue = error;
      if (!active) { try { plan(wheel, config.target); } catch (failure) { issue = failure.message; } }
      return { ...inspect(wheel, config.target), supported: true, ready: !issue, spinning: Boolean(active), result, error: issue };
    }
    function abort(reason) {
      if (active) {
        wheel.state = active.previousState;
        wheel.speed = 0;
        active = null;
        options.onCancel?.();
      }
      result = "";
      error = reason;
      sample(true);
    }
    function patch(key, factory) {
      const original = wheel[key];
      const descriptor = Object.getOwnPropertyDescriptor(wheel, key);
      const wrapper = factory(original);
      originals.set(key, { descriptor, wrapper });
      try { wheel[key] = wrapper; }
      catch {
        restore();
        throw new Error("Engine gốc không cho phép cài adapter; đã khôi phục các hàm đã thay đổi.");
      }
    }
    function restore() {
      for (const [key, saved] of originals) {
        if (wheel[key] !== saved.wrapper) continue;
        if (saved.descriptor) Object.defineProperty(wheel, key, saved.descriptor);
        else delete wheel[key];
      }
    }
    patch("click", original => function (nameChanged, done) {
      if (disposed || !config.enabled) return original.apply(this, arguments);
      if (active) return;
      let next;
      try { next = plan(wheel, config.target); }
      catch (failure) { abort(failure.message); options.onCancel?.(); return; }
      if (wheel.isSpinning()) { error = "Vòng quay đang chạy."; sample(true); return; }
      const previousState = wheel.state;
      const started = clock();
      const duration = options.reducedMotion?.() ? 900 : Math.max(1000, Math.min(20000, (Number(wheel.wheelConfig?.spinTime) || 5) * 1000));
      active = { previousState, started, duration, start: wheel.angle, end: next.end, fingerprint: fingerprint(), target: config.target };
      result = ""; error = "";
      wheel.speed = 0;
      wheel.nameChangedCallback = nameChanged;
      wheel.doneSpinningCallback = done;
      wheel.state = {
        isSpinning: () => Boolean(active), drawThisFrame: () => true, click() {},
        tick() {
          if (!active) return;
          if (fingerprint() !== active.fingerprint) { abort("Đã hủy: danh sách gốc thay đổi."); return; }
          const progress = Math.min(1, (clock() - active.started) / active.duration);
          wheel.speed = 0;
          wheel.angle = Core.wrap(active.start + (active.end - active.start) * (1 - Math.pow(1 - progress, 4)));
          sample();
          if (progress >= 1) active.finished = true;
        }
      };
      active.controlledState = wheel.state;
      wheel.refresh();
      sample(true);
    });
    patch("tick", original => function () {
      const value = original.apply(this, arguments);
      // Check after the complete native tick, including advance/entryPicker updates.
      if (!active) return value;
      if (wheel.state !== active.controlledState || fingerprint() !== active.fingerprint) {
        abort("Đã hủy: engine gốc thay đổi trạng thái hoặc danh sách ngoài hợp đồng."); return value;
      }
      if (!active.finished) return value;
      if (text(wheel.getEntryAtPointer()) !== active.target) {
        abort("Đã hủy: ô thực tế dưới kim không khớp mục tiêu."); return value;
      }
      const idle = active.previousState;
      active = null; wheel.state = idle; wheel.speed = 0;
      result = text(wheel.getEntryAtPointer());
      sample(true);
      // Calls the site's real result callback with its actual entry object.
      wheel.spinIsDone();
      return value;
    });
    for (const key of ["setEntries", "configure"]) {
      patch(key, original => function () {
        if (active) abort("Đã hủy: danh sách hoặc cấu hình vòng quay gốc thay đổi.");
        result = "";
        const value = original.apply(this, arguments);
        error = "";
        sample(true);
        return value;
      });
    }
    return {
      status,
      validate() { return plan(wheel, config.target); },
      configure(next) {
        const target = Core.normalizeName(next.target);
        if (target !== config.target || next.enabled !== config.enabled) {
          abort(active ? "Đã hủy: mục tiêu hoặc trạng thái thay đổi." : "");
        }
        config = { enabled: next.enabled === true, target };
        error = "";
        return status();
      },
      dispose() {
        abort(""); disposed = true;
        restore();
      }
    };
  }
  const api = Object.freeze({ compatible, inspect, plan, attach });
  root.FixedWinnerNative = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
