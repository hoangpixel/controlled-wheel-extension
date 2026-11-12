/* Access the site's already-initialized v440 ES module, then capture its real draw receiver.
 * Controller logic is packaged locally. No eval, new Function, RNG hooks or replacement canvas.
 */
(function (root) {
  "use strict";
  function create(options) {
    const { origin, resources, compatible, onCapture = () => {}, onChange = () => {} } = options;
    const loadModule = options.loadModule || (url => import(url));
    const schedule = options.microtask || (fn => queueMicrotask(fn));
    let hosts = [], generation = 0, restoreDraw = null, timeout = null;
    let state = { phase: "idle", error: "" };
    let audioWarmup = { phase: "idle" };
    const captured = new Map(), namespaces = new Map();
    const raw = value => value?.__v_raw || value;
    const publish = next => { state = next; onChange(); };
    function moduleURL() {
      const observed = new Set();
      for (const entry of resources()) {
        try {
          const url = new URL(entry.name);
          if (url.origin === origin && !url.search && !url.hash) observed.add(url.href);
        } catch { /* Not a resource URL. */ }
      }
      for (const url of observed) {
        if (!new URL(url).pathname.endsWith("/ConfettiLauncher-v440.js")) continue;
        const engine = new URL("./dist-v4402.js", url).href;
        if (observed.has(engine)) return engine;
      }
      return null;
    }
    function cancellation(host, engine) {
      const provides = host.component.appContext?.provides;
      if (!provides) return null;
      for (const key of Reflect.ownKeys(provides)) {
        const pinia = provides[key];
        if (typeof pinia?._s?.values !== "function") continue;
        for (const store of pinia._s.values()) {
          if (!Array.isArray(store.wheelConfigs) || typeof store.setWheelBusy !== "function") continue;
          const index = store.wheelConfigs.findIndex(config => raw(config) === raw(engine.wheelConfig));
          if (index < 0) continue;
          return () => {
            const current = store.wheelConfigs.findIndex(config => raw(config) === raw(engine.wheelConfig));
            if (current >= 0) store.setWheelBusy(current, false);
          };
        }
      }
      return null;
    }
    function get(currentHosts = hosts) {
      for (const host of currentHosts) {
        const engine = captured.get(host.canvas);
        if (!engine || !compatible(engine)) continue;
        if (raw(engine.wheelConfig) !== raw(host.component.props.wheelConfig)) {
          captured.delete(host.canvas); state = { phase: "idle", error: "" }; continue;
        }
        const releaseBusy = cancellation(host, engine);
        if (!releaseBusy) {
          state = { phase: "missing_busy_store", error: "Đã tìm thấy engine 440 nhưng chưa nối được trạng thái bận của website." };
          continue;
        }
        state = { phase: "captured", error: "" };
        return { ...host, wheel: engine, releaseBusy, profile: "v440-module" };
      }
      return null;
    }
    function clearHook() {
      clearTimeout(timeout); timeout = null;
      if (restoreDraw) { const restore = restoreDraw; restoreDraw = null; restore(); }
    }
    async function preloadAudio(engineURL, token) {
      // The page imports this utility itself. Its l export only preloads Howls
      // (no autoplay); warming it here avoids their first allocation inside tick.
      const url = new URL("./WheelConfigUtil-v440.js", engineURL).href;
      if (!resources().some(entry => entry.name === url)) { audioWarmup = { phase: "not_observed" }; return; }
      try {
        if (!namespaces.has(url)) namespaces.set(url, Promise.resolve().then(() => loadModule(url)));
        const namespace = await namespaces.get(url);
        if (token !== generation) return;
        if (typeof namespace.l !== "function") { audioWarmup = { phase: "unsupported" }; return; }
        const config = hosts[0]?.component?.props?.wheelConfig;
        if (!config) return;
        const now = options.now || (() => performance.now());
        const started = now();
        namespace.l(config.duringSpinSound, config.afterSpinSound);
        audioWarmup = { phase: "preload_requested", durationMs: Math.max(0, now() - started) };
      } catch (error) {
        if (token === generation) audioWarmup = { phase: "error", error: error.message };
      }
    }
    function ensure(nextHosts) {
      hosts = nextHosts;
      if (!hosts.length || get(hosts) || ["loading_module", "waiting_draw"].includes(state.phase)) return;
      if (state.phase === "missing_busy_store") return;
      const url = moduleURL();
      if (!url) { publish({ phase: "module_not_observed", error: "Không thấy module engine 440 trong tài nguyên trang đã tải. Hãy tải lại website." }); return; }
      const token = ++generation;
      publish({ phase: "loading_module", error: "Đang kết nối module engine 440 đã được website khởi tạo…" });
      // A mounted SpinningWheel and an observed exact module URL are both required.
      // This requests the namespace of that same module from the page's module map.
      if (!namespaces.has(url)) namespaces.set(url, Promise.resolve().then(() => loadModule(url)));
      namespaces.get(url).then(async namespace => {
        if (token !== generation) return;
        const Engine = namespace.t;
        const prototype = Engine?.prototype;
        if (!prototype || !["draw", "tick", "click", "configure", "getEntryAtAngle", "getDisplayEntries"].every(key => typeof prototype[key] === "function")) {
          throw new Error("Export của module không khớp class engine bản 440 đã kiểm tra.");
        }
        await preloadAudio(url, token);
        if (token !== generation) return;
        const descriptor = Object.getOwnPropertyDescriptor(prototype, "draw");
        const original = prototype.draw;
        function draw(context) {
          const value = original.apply(this, arguments);
          if (token !== generation || !compatible(this)) return value;
          const host = hosts.find(item => item.canvas === context?.canvas && raw(item.component.props.wheelConfig) === raw(this.wheelConfig));
          if (host) {
            captured.set(host.canvas, this);
            clearHook();
            publish({ phase: "captured", error: "" });
            schedule(() => { if (token === generation) onCapture(); });
          }
          return value;
        }
        restoreDraw = () => {
          if (prototype.draw !== draw) return;
          if (descriptor) Object.defineProperty(prototype, "draw", descriptor);
          else delete prototype.draw;
        };
        try { prototype.draw = draw; }
        catch { clearHook(); throw new Error("Module gốc không cho phép nhận diện instance qua draw()."); }
        publish({ phase: "waiting_draw", error: "Đang đợi khung hình từ Canvas gốc…" });
        timeout = setTimeout(() => {
          if (token !== generation) return;
          clearHook(); publish({ phase: "draw_timeout", error: "Chưa nhận được khung hình từ engine 440. Giữ tab website ở phía trước rồi thử lại." });
        }, options.captureTimeout ?? 4000);
      }).catch(error => {
        if (token !== generation) return;
        clearHook(); publish({ phase: "module_error", error: `Không truy cập được module gốc: ${error.message}` });
      });
    }
    return {
      ensure, get, status: () => ({ ...state, audioWarmup: { ...audioWarmup } }),
      cancel() { generation++; clearHook(); captured.clear(); hosts = []; state = { phase: "idle", error: "" }; audioWarmup = { phase: "idle" }; }
    };
  }
  root.FixedWinnerModuleLink = Object.freeze({ create });
  if (typeof module !== "undefined" && module.exports) module.exports = root.FixedWinnerModuleLink;
})(globalThis);
