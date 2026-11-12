/* Runs in MAIN world. Exposes only a narrow, same-page, non-secret protocol. */
(() => {
  "use strict";
  const CHANNEL = "fixed-winner-native-v1";
  let config = { enabled: false, target: "" };
  let binding = null, controller = null, timer = null;
  let lastError = "", lastState = null;
  const send = (payload) => window.postMessage({ channel: CHANNEL, direction: "from-page", ...payload }, location.origin);
  function findBinding() {
    const canvases = [...document.querySelectorAll("canvas")].filter(el => el.getClientRects().length)
      .sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight);
    for (const canvas of canvases) {
      const queue = [];
      for (let el = canvas; el; el = el.parentElement) {
        if (el.__vue__) queue.push(el.__vue__);
        if (el.__vueParentComponent) queue.push(el.__vueParentComponent);
      }
      const seen = new Set();
      while (queue.length && seen.size < 256) {
        const component = queue.shift();
        if (!component || seen.has(component)) continue;
        seen.add(component);
        const views = [component, component.proxy, component.ctx, component.$data, component.data, component.setupState].filter(Boolean);
        for (const view of views) {
          for (const key of ["myWheel", "wheel"]) {
            const candidate = view[key]?.value || view[key];
            if (FixedWinnerNative.compatible(candidate)) {
              const instance = component.proxy || component;
              if (instance.$el && !instance.$el.contains(canvas)) continue;
              return { canvas, wheel: candidate, instance };
            }
          }
        }
        queue.push(...(component.$children || []));
      }
    }
    return null;
  }
  function releaseBusy() {
    const instance = binding?.instance;
    if (instance?.$store?.commit) instance.$store.commit("setWheelBusy", false);
    if (instance && "displayOverlayText" in instance) instance.displayOverlayText = true;
  }
  function disconnect() {
    controller?.dispose(); controller = null; binding = null;
  }
  function status() {
    const state = controller?.status() || lastState;
    return { enabled: config.enabled, target: config.target, supported: Boolean(controller), names: [], ...state,
      error: lastError || state?.error || (!controller && config.enabled ? "Không kết nối được engine gốc. Phiên bản website này chưa được hỗ trợ; kết quả cố định chưa được áp dụng." : "") };
  }
  function broadcast(state) {
    lastState = state;
    send({ type: "STATUS", state: status() });
  }
  function connect() {
    if (!config.enabled) return;
    const found = findBinding();
    if (controller && binding?.wheel === found?.wheel) return;
    disconnect(); lastState = null;
    if (!found) return;
    binding = found;
    try {
      controller = FixedWinnerNative.attach(found.wheel, { onStatus: broadcast, onCancel: releaseBusy,
        reducedMotion: () => matchMedia("(prefers-reduced-motion: reduce)").matches });
      controller.configure(config); lastError = "";
    } catch (error) { lastError = error.message; controller = null; }
  }
  // Validate before the site's handler starts. The click wrapper also protects keyboard/API spins.
  function guard(event) {
    if (!config.enabled) return;
    const keySpin = event.type === "keyup" && event.ctrlKey && event.key === "Enter";
    if (event.type === "keyup" && !keySpin) return;
    const target = event.target;
    const canvasClick = target?.tagName === "CANVAS" || Boolean(binding?.instance?.$el?.contains(target));
    const button = target?.closest?.("button, [role=button]");
    const spinButton = button && /^(spin|spin wheel|quay|bắt đầu quay)$/i.test(button.textContent.trim());
    if (!keySpin && !canvasClick && !spinButton) return;
    try {
      connect();
      if (!controller) throw new Error(status().error);
      if (controller.status().spinning) return;
      controller.validate();
      lastError = "";
    } catch (error) {
      event.preventDefault(); event.stopImmediatePropagation();
      lastError = error.message; send({ type: "STATUS", state: status() });
    }
  }
  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const message = event.data;
    if (message?.channel !== CHANNEL || message.direction !== "to-page") return;
    if (!["CONFIG", "STATUS"].includes(message.type)) return;
    try {
      if (message.type === "CONFIG") {
        const next = message.config || {};
        config = { enabled: next.enabled === true, target: WheelDemoCore.normalizeName(next.target) };
        lastError = "";
        if (config.enabled) {
          connect(); controller?.configure(config);
          if (!timer) timer = setInterval(() => { connect(); send({ type: "STATUS", state: status() }); }, 1000);
        } else {
          clearInterval(timer); timer = null; disconnect(); lastState = null;
        }
      } else connect();
      send({ type: "REPLY", id: message.id, state: status() });
    } catch (error) { lastError = error.message; send({ type: "REPLY", id: message.id, state: status() }); }
  });
  document.addEventListener("click", guard, true);
  document.addEventListener("keyup", guard, true);
  window.addEventListener("pagehide", () => { clearInterval(timer); timer = null; disconnect(); lastState = null; });
  window.addEventListener("pageshow", () => {
    if (config.enabled) { connect(); if (!timer) timer = setInterval(() => { connect(); send({ type: "STATUS", state: status() }); }, 1000); }
  });
})();
