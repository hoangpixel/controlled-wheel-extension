/* Async local reservation around the native adapter; all later spins use native RNG. */
(function (root) {
  "use strict";
  function attach(wheel, adapter, options) {
    const clickDescriptor = Object.getOwnPropertyDescriptor(wheel, "click");
    const originalDone = wheel.doneSpinningCallback, doneDescriptor = Object.getOwnPropertyDescriptor(wheel, "doneSpinningCallback");
    let config = { enabled: false, target: "", runId: "", consumed: false };
    let phase = "ready", issue = "", lease = null, generation = 0, disposed = false, legacyDone = null;
    const is440 = adapter.inspect(wheel, "").profile === "v440";
    let base;
    const emit = () => { if (base && !disposed) options.onStatus?.(status()); };
    const release = held => held ? options.finish(held, false).catch(() => {}) : Promise.resolve();
    function cancel() {
      generation++;
      const held = lease; lease = null;
      phase = config.consumed ? "random" : "ready";
      void release(held);
    }
    base = adapter.attach(wheel, { ...options, onStatus: emit, onCancel() {
      cancel(); options.onCancel?.(); emit();
    } });
    base.configure({ enabled: false, target: "" });
    const baseClick = wheel.click;
    function status() {
      const random = phase === "random";
      const state = random ? { ...adapter.inspect(wheel, config.target), result: "", error: "" } : base.status();
      return { ...state, supported: true, mode: random ? "random" : "first-fixed", firstSpinDone: random,
        spinning: ["acquiring", "committing"].includes(phase) || wheel.isSpinning(),
        ready: random || !(issue || state.error), error: random ? "" : issue || state.error };
    }
    function complete(context, done, args) {
      if (phase !== "controlled") return done.apply(context, args);
      const token = generation, held = lease;
      phase = "committing"; emit();
      void options.finish(held, true).then(() => {
        if (disposed || token !== generation) return;
        lease = null; config.consumed = true; phase = "random"; issue = "";
        base.configure({ enabled: false, target: config.target }); emit();
        done.apply(context, args);
      }).catch(error => {
        if (disposed || token !== generation) return;
        cancel(); issue = error.message;
        base.configure({ enabled: false, target: config.target }); options.onCancel?.(); emit();
      });
    }
    const doneWrapper = function () { return complete(this, originalDone, [...arguments]); };
    const clickWrapper = function () {
      const context = this, args = [...arguments];
      if (disposed || !config.enabled || phase === "random") return baseClick.apply(context, args);
      if (phase !== "ready" || wheel.isSpinning()) return;
      try { base.validate(); }
      catch (error) { issue = error.message; queueMicrotask(() => options.onCancel?.()); emit(); return; }
      const token = generation, requested = { runId: config.runId, target: config.target };
      phase = "acquiring"; issue = ""; emit();
      void options.acquire(requested).then(async grant => {
        const held = grant.controlled ? { runId: requested.runId, leaseId: grant.leaseId } : null;
        if (disposed || token !== generation) { await release(held); return; }
        if (!grant.controlled) { config.consumed = true; phase = "random"; emit(); return baseClick.apply(context, args); }
        lease = held; phase = "controlled";
        base.configure({ enabled: true, target: config.target });
        if (!is440) {
          const done = args[1];
          legacyDone = function () { return complete(this, done, [...arguments]); };
          args[1] = legacyDone;
        }
        baseClick.apply(context, args); emit();
      }).catch(error => {
        if (disposed || token !== generation) return;
        cancel(); issue = error.message; base.configure({ enabled: false, target: config.target }); options.onCancel?.(); emit();
      });
    };
    try {
      if (is440) wheel.doneSpinningCallback = doneWrapper;
      wheel.click = clickWrapper;
    } catch (error) {
      disposed = true; base.dispose();
      if (wheel.doneSpinningCallback === doneWrapper) {
        if (doneDescriptor) Object.defineProperty(wheel, "doneSpinningCallback", doneDescriptor); else delete wheel.doneSpinningCallback;
      }
      throw new Error(`Không cài được chế độ lượt đầu; đã hoàn tác: ${error.message}`);
    }
    return {
      status, timing: () => base.timing?.() || null,
      validate() { return phase === "random" ? status() : base.validate(); },
      configure(next) {
        const changed = next.runId !== config.runId || next.target !== config.target || next.enabled !== config.enabled;
        if (changed) { cancel(); base.configure({ enabled: false, target: next.target }); }
        config = { ...next };
        if (changed || !["acquiring", "controlled", "committing"].includes(phase)) phase = config.consumed ? "random" : "ready";
        issue = "";
        base.configure({ enabled: phase === "controlled", target: config.target });
        return status();
      },
      dispose() {
        cancel(); disposed = true; base.dispose();
        if (wheel.click === clickWrapper) {
          if (clickDescriptor) Object.defineProperty(wheel, "click", clickDescriptor); else delete wheel.click;
        }
        if (wheel.doneSpinningCallback === doneWrapper || wheel.doneSpinningCallback === legacyDone) {
          if (doneDescriptor) Object.defineProperty(wheel, "doneSpinningCallback", doneDescriptor); else delete wheel.doneSpinningCallback;
        }
      }
    };
  }
  root.FixedWinnerFirstSpin = Object.freeze({ attach });
  if (typeof module !== "undefined" && module.exports) module.exports = root.FixedWinnerFirstSpin;
})(globalThis);
