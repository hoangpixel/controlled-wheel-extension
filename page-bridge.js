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
    const canvases = [...document.querySelectorAll("canvas")].filter(el => el.getClientRects().length)
      .sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight);
    discovery = { visibleCanvasCount: canvases.length, vue2Nodes: 0, vue3Nodes: 0, componentCount: 0, stateKeys: [], candidates: [] };
    const recordCandidate = (value, key) => {
      if (!value || typeof value !== "object") return;
      if (discovery.candidates.length >= 8 || !/wheel|engine/i.test(key) && !("angle" in value)) return;
      const methods = ["click", "tick", "setEntries", "configure", "getIndexAtPointer", "getEntryAtPointer", "isSpinning", "spinIsDone", "refresh"];
      discovery.candidates.push({ key, methods: methods.filter(name => typeof value[name] === "function"), fields: Object.keys(value).slice(0, 25) });
    };
    for (const canvas of canvases) {
      const queue = [];
      for (let el = canvas; el; el = el.parentElement) {
        if (el.__vue__) { queue.push(el.__vue__); discovery.vue2Nodes++; }
        if (el.__vueParentComponent) { queue.push(el.__vueParentComponent); discovery.vue3Nodes++; }
        if (el.__vue_app__?._instance) { queue.push(el.__vue_app__._instance); discovery.vue3Nodes++; }
        if (el._vnode?.component) queue.push(el._vnode.component);
        if (el.__vnode?.component) queue.push(el.__vnode.component);
      }
      const seen = new Set();
      while (queue.length && seen.size < 256) {
        const component = queue.shift();
        if (!component || seen.has(component)) continue;
        seen.add(component);
        discovery.componentCount++;
        const views = [component, component.proxy, component.ctx, component.$data, component._data, component.data, component.setupState, component.exposed].filter(Boolean);
        for (const view of views) {
          const values = ["myWheel", "wheel"].map(key => ({ key, value: view[key] }));
          // Also inspect actual component data, so renamed/nested engine fields are discoverable.
          if ([component.$data, component._data, component.data, component.setupState, component.exposed].includes(view)) {
            const keys = Object.keys(view).slice(0, 80);
            if (discovery.stateKeys.length < 12) discovery.stateKeys.push(keys);
            for (const key of keys) values.push({ key, value: view[key] });
          }
          const visited = new Set();
          while (values.length && visited.size < 160) {
            const { key, value, depth = 0 } = values.shift();
            const candidate = value?.__v_isRef ? value.value : value;
            if (!candidate || typeof candidate !== "object" || visited.has(candidate) || candidate.nodeType || Array.isArray(candidate)) continue;
            visited.add(candidate);
            recordCandidate(candidate, key);
            if (FixedWinnerNative.compatible(candidate)) {
              const instance = component.proxy || component;
              if (instance.$el?.nodeType === 1 && !instance.$el.contains(canvas)) continue;
              return { canvas, wheel: candidate, instance };
            }
            if (depth < 2 && !key.startsWith("$")) {
              for (const name of Object.keys(candidate).slice(0, 40)) {
                const descriptor = Object.getOwnPropertyDescriptor(candidate, name);
                if (descriptor && "value" in descriptor) values.push({ key: `${key}.${name}`, value: descriptor.value, depth: depth + 1 });
              }
            }
          }
        }
        queue.push(...(component.$children || []));
        // Vue 3 components are reached via VNode subtrees rather than $children.
        if (component.subTree) queue.push(component.subTree);
        if (component.component) queue.push(component.component);
        if (Array.isArray(component.children)) queue.push(...component.children.filter(child => child && typeof child === "object"));
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
        send({ type: "REPLY", id: message.id, state: { extensionVersion: "1.2.1", siteVersion: version, connected: Boolean(controller), ...discovery, error: status().error } });
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
