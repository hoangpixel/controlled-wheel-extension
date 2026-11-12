/* Runs in MAIN world. Exposes only a narrow, same-page, non-secret protocol. */
(() => {
  "use strict";
  const CHANNEL = "fixed-winner-native-v1";
  let config = { enabled: false, target: "", runId: "", consumed: false };
  let binding = null, controller = null, timer = null;
  let lastError = "", lastState = null;
  let discovery = {};
  let hosts = [], pendingInput = null;
  let sessionSequence = 0, pageActive = true;
  const sessionRequests = new Map();
  const send = (payload) => window.postMessage({ channel: CHANNEL, direction: "from-page", ...payload }, location.origin);
  function session(operation, data) {
    if (!pageActive) return Promise.reject(new Error("Trang đang đóng; đã hủy lượt quay."));
    return new Promise((resolve, reject) => {
      const id = ++sessionSequence;
      const timeout = setTimeout(() => { sessionRequests.delete(id); reject(new Error("Không nhận được phản hồi lưu trạng thái lượt quay.")); }, 10000);
      sessionRequests.set(id, { resolve, reject, timeout });
      send({ type: "SESSION_REQUEST", id, operation, data });
    });
  }
  const moduleLink = FixedWinnerModuleLink.create({ origin: location.origin,
    resources: () => performance.getEntriesByType("resource"),
    compatible: wheel => FixedWinnerNative440.compatible(wheel),
    onCapture: () => { if (config.enabled) { connect(); send({ type: "STATUS", state: status() }); } },
    onChange: () => {
      if (["module_error", "draw_timeout", "module_not_observed", "missing_busy_store"].includes(moduleLink.status().phase)) pendingInput = null;
      if (config.enabled) send({ type: "STATUS", state: status() });
    }
  });
  function findBinding() {
    const result = FixedWinnerDiscovery.find(document, FixedWinnerNative);
    discovery = result.report;
    hosts = result.hosts;
    return result.binding || moduleLink.get(hosts);
  }
  function releaseBusy() {
    if (binding?.releaseBusy) { binding.releaseBusy(); return; }
    const instance = binding?.instance;
    if (instance?.$store?.commit) instance.$store.commit("setWheelBusy", false);
    if (instance && "displayOverlayText" in instance) instance.displayOverlayText = true;
  }
  function disconnect() {
    controller?.dispose(); controller = null; binding = null;
  }
  function status() {
    const state = controller?.status() || lastState;
    return { enabled: config.enabled, target: config.target, runId: config.runId,
      mode: config.consumed ? "random" : "first-fixed", firstSpinDone: config.consumed, supported: Boolean(controller), names: [], ...state,
      error: config.consumed ? "" : lastError || state?.error || (!controller && config.enabled ? moduleLink.status().error || "Không kết nối được engine gốc. Phiên bản website này chưa được hỗ trợ; kết quả cố định chưa được áp dụng." : "") };
  }
  function broadcast(state) {
    lastState = state;
    send({ type: "STATUS", state: status() });
  }
  function resumeInput() {
    if (!controller || !pendingInput) return;
    const request = pendingInput; pendingInput = null;
    if (request.runId !== config.runId || request.component !== binding?.component || request.canvas !== binding?.canvas) return;
    try { controller.validate(); lastError = ""; request.component.exposed.spin(); }
    catch (error) { lastError = error.message; }
  }
  function connect() {
    if (!config.enabled) return;
    const found = findBinding();
    if (controller && binding?.wheel === found?.wheel) return;
    disconnect(); lastState = null;
    if (!found) { moduleLink.ensure(hosts); return; }
    binding = found;
    try {
      controller = FixedWinnerFirstSpin.attach(found.wheel, FixedWinnerNative, { onStatus: broadcast, onCancel: releaseBusy,
        acquire: data => session("acquire", data), finish: (data, completed) => session("finish", { ...data, completed }),
        reducedMotion: () => matchMedia("(prefers-reduced-motion: reduce)").matches });
      controller.configure(config); lastError = "";
      resumeInput();
    } catch (error) { lastError = error.message; controller = null; }
  }
  // Validate before the site's handler starts. The click wrapper also protects keyboard/API spins.
  function guard(event) {
    if (!config.enabled || config.consumed) return;
    const keySpin = ["keydown", "keyup"].includes(event.type) && (event.ctrlKey || event.metaKey) && event.key === "Enter";
    if (["keydown", "keyup"].includes(event.type) && !keySpin) return;
    const target = event.target;
    const inWheel = canvas => {
      const scope = canvas?.parentElement;
      return canvas === target || Boolean(scope && scope !== document.body && scope !== document.documentElement && scope.contains(target));
    };
    const canvasClick = target?.tagName === "CANVAS" || inWheel(binding?.canvas) || hosts.some(host => inWheel(host.canvas));
    const button = target?.closest?.("button, [role=button]");
    const spinButton = button && /^(spin|spin wheel|quay|bắt đầu quay)$/i.test(button.textContent.trim());
    if (!keySpin && !spinButton && target?.closest?.('a, input, textarea, select, summary, [contenteditable]')) return;
    if (!keySpin && !canvasClick && !spinButton) return;
    try {
      connect();
      if (!controller) {
        const host = keySpin || spinButton ? hosts[0] : hosts.find(item => inWheel(item.canvas));
        if (host && ["loading_module", "waiting_draw"].includes(moduleLink.status().phase)) {
          event.preventDefault(); event.stopImmediatePropagation();
          pendingInput ||= { runId: config.runId, component: host.component, canvas: host.canvas };
          lastError = "Đang kết nối; lượt quay đầu sẽ bắt đầu khi sẵn sàng.";
        }
        return;
      }
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
    if (message.type === "SESSION_REPLY" && sessionRequests.has(message.id)) {
      const request = sessionRequests.get(message.id); sessionRequests.delete(message.id); clearTimeout(request.timeout);
      if (message.result?.ok) request.resolve(message.result); else request.reject(new Error(message.result?.error || "Không lưu được lượt quay."));
      return;
    }
    if (!["CONFIG", "STATUS", "DIAGNOSTICS"].includes(message.type)) return;
    try {
      if (message.type === "DIAGNOSTICS") {
        findBinding();
        const version = document.body?.innerText?.match(/(?:version|phiên bản)\s*[:#]?\s*(\d{2,6})/i)?.[1] || "unknown";
        send({ type: "REPLY", id: message.id, state: { extensionVersion: "1.5.0", siteVersion: version, connected: Boolean(controller),
          mode: status().mode, firstSpinDone: status().firstSpinDone, ...discovery,
          moduleLink: moduleLink.status(), motion: controller?.timing?.() || null, error: status().error } });
        return;
      }
      if (message.type === "CONFIG") {
        const next = message.config || {};
        const normalized = { enabled: next.enabled === true, target: WheelDemoCore.normalizeName(next.target), runId: next.runId || "", consumed: next.consumed === true };
        if (!normalized.enabled || normalized.runId !== config.runId || normalized.target !== config.target) pendingInput = null;
        config = normalized;
        lastError = "";
        if (config.enabled) {
          connect(); controller?.configure(config);
          if (!timer) timer = setInterval(() => { connect(); send({ type: "STATUS", state: status() }); }, 1000);
        } else {
          clearInterval(timer); timer = null; disconnect(); moduleLink.cancel(); lastState = null;
        }
      } else connect();
      send({ type: "REPLY", id: message.id, state: status() });
    } catch (error) { lastError = error.message; send({ type: "REPLY", id: message.id, state: status() }); }
  });
  document.addEventListener("click", guard, true);
  document.addEventListener("keyup", guard, true);
  window.addEventListener("keydown", guard, true);
  window.addEventListener("pagehide", () => {
    pageActive = false; pendingInput = null;
    for (const request of sessionRequests.values()) { clearTimeout(request.timeout); request.reject(new Error("Trang đã đóng.")); }
    sessionRequests.clear(); clearInterval(timer); timer = null; disconnect(); moduleLink.cancel(); lastState = null;
  });
  window.addEventListener("pageshow", () => {
    pageActive = true;
    if (config.enabled) { connect(); if (!timer) timer = setInterval(() => { connect(); send({ type: "STATUS", state: status() }); }, 1000); }
  });
})();
