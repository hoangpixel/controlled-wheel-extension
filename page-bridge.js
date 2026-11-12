/* Runs in MAIN world. Exposes only a narrow, same-page, non-secret protocol. */
(() => {
  "use strict";
  const CHANNEL = "fixed-winner-native-v1";
  let config = { enabled: false, target: "" };
  let binding = null, controller = null, timer = null;
  let lastError = "", lastState = null;
  let discovery = {};
  const send = (payload) => window.postMessage({ channel: CHANNEL, direction: "from-page", ...payload }, location.origin);
  function findBinding() {
    const result = FixedWinnerDiscovery.find(document, FixedWinnerNative);
    discovery = result.report;
    return result.binding;
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
    const scope = binding?.canvas?.parentElement;
    const canvasClick = target?.tagName === "CANVAS" || Boolean(scope && scope !== document.body && scope !== document.documentElement && scope.contains(target));
    const button = target?.closest?.("button, [role=button]");
    const spinButton = button && /^(spin|spin wheel|quay|bắt đầu quay)$/i.test(button.textContent.trim());
    if (!keySpin && !spinButton && target?.closest?.('a, input, textarea, select, summary, [contenteditable]')) return;
    if (!keySpin && !canvasClick && !spinButton) return;
    try {
      connect();
      if (!controller) return; // Unsupported pages remain usable; popup reports that control is not applied.
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
    if (!["CONFIG", "STATUS", "DIAGNOSTICS"].includes(message.type)) return;
    try {
      if (message.type === "DIAGNOSTICS") {
        findBinding();
        const version = document.body?.innerText?.match(/(?:version|phiên bản)\s*[:#]?\s*(\d{2,6})/i)?.[1] || "unknown";
        send({ type: "REPLY", id: message.id, state: { extensionVersion: "1.2.2", siteVersion: version, connected: Boolean(controller), ...discovery, error: status().error } });
        return;
      }
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
