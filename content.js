"use strict";
(() => {
  if (globalThis.__fixedWinnerDemoLoaded) return;
  globalThis.__fixedWinnerDemoLoaded = true;
  const KEY = "fixedWinnerDemo", CHANNEL = "fixed-winner-native-v1";
  let config = { enabled: false, target: "" };
  let state = { supported: false, names: [], error: "Đang kết nối vòng quay gốc…" };
  let host, ui, interval, sequence = 0, generation = 0;
  const pending = new Map();
  function rpc(type, data = {}) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error("Không nhận được phản hồi từ bộ kết nối. Reload extension và tải lại website.")); }, 2500);
      pending.set(id, { resolve, timeout });
      window.postMessage({ channel: CHANNEL, direction: "to-page", type, id, ...data }, location.origin);
    });
  }
  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const message = event.data;
    if (message?.channel !== CHANNEL || message.direction !== "from-page") return;
    if (message.type === "REPLY" && pending.has(message.id)) {
      const item = pending.get(message.id); clearTimeout(item.timeout); pending.delete(message.id); item.resolve(message.state);
    } else if (message.type === "STATUS" && config.enabled && message.state?.enabled && message.state.target === config.target) {
      state = message.state; render();
    }
  });
  function mount() {
    if (!host) return;
    // Outside the app's Vue-managed layout: do not resize the wheel or reveal footer content.
    if (host.parentElement !== document.body) document.body.append(host);
  }
  function ensureUI() {
    if (host) { mount(); return; }
    host = document.createElement("div"); host.id = "fixed-winner-demo-host";
    for (const [key, value] of Object.entries({ display: "block", position: "fixed", left: "12px", bottom: "12px", "z-index": "2147483647", "max-width": "calc(100vw - 24px)" })) host.style.setProperty(key, value, "important");
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>
      :host { all:initial; display:block; color-scheme:dark; font:600 11px/1.5 system-ui,sans-serif; }
      .badge { display:block; box-sizing:border-box; padding:7px 10px; border:1px solid #b7a273; border-radius:8px; background:#151c2d; color:#ffe3a4; box-shadow:0 3px 14px #0004; }
    </style><span class="badge" role="status">CONTROLLED DEMO – Chưa áp dụng</span>`;
    const get = selector => shadow.querySelector(selector);
    ui = { badge: get(".badge") };
    mount();
  }
  function render() {
    if (!config.enabled) return;
    ensureUI();
    ui.badge.textContent = state.supported && !state.error ? "CONTROLLED DEMO – Kết quả định trước" : "CONTROLLED DEMO – Chưa áp dụng";
  }
  async function refresh() {
    const expected = generation;
    try {
      const next = await rpc("CONFIG", { config });
      if (expected !== generation) return;
      state = next; render();
    } catch (error) {
      if (expected !== generation) return;
      state = { supported: false, names: [], error: error.message }; render();
    }
  }
  async function applyConfig(stored) {
    const next = { enabled: stored?.enabled === true, target: WheelDemoCore.normalizeName(stored?.target) };
    const expected = ++generation;
    config = next;
    clearInterval(interval); interval = null;
    if (config.enabled) {
      ensureUI(); render();
      await refresh();
      if (expected === generation && config.enabled) {
        clearInterval(interval);
        interval = setInterval(() => { if (!document.hidden) void refresh(); }, 1500);
      }
    } else {
      // Keep the disclosure visible until the page engine confirms restoration.
      const restored = await rpc("CONFIG", { config });
      if (expected !== generation) return;
      if (restored.enabled || restored.supported) throw new Error("Chưa xác nhận được việc khôi phục vòng quay gốc. Hãy tải lại trang.");
      state = restored;
      host?.remove(); host = null; ui = null;
    }
  }
  const ready = chrome.storage.local.get(KEY).then(stored => applyConfig(stored[KEY])).catch(error => {
    console.warn("Fixed Winner Demo:", error.message);
    if (ui) ui.badge.textContent = "CONTROLLED DEMO – Lỗi kết nối";
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[KEY]) void applyConfig(changes[KEY].newValue).catch(error => {
      console.warn("Fixed Winner Demo:", error.message);
      if (ui) ui.badge.textContent = "CONTROLLED DEMO – Lỗi kết nối";
    });
  });
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (!["FWD_STATUS", "FWD_OPEN", "FWD_DIAGNOSTICS"].includes(message?.type)) return false;
    (async () => {
      await ready;
      await applyConfig((await chrome.storage.local.get(KEY))[KEY]);
      if (message.type === "FWD_DIAGNOSTICS") {
        const report = await rpc("DIAGNOSTICS");
        respond({ ok: true, diagnostics: report }); return;
      }
      if (message.type === "FWD_OPEN") {
        if (!config.enabled) { respond({ ok: false, error: "Hãy bật điều khiển vòng quay gốc." }); return; }
        const point = WheelDemoReader.mountPoint(document);
        (point.before || point.parent)?.scrollIntoView({ block: "start", behavior: "auto" });
      }
      respond({ ok: true, available: state.supported === true, count: state.names?.length || 0, source: "native", targetFound: WheelDemoCore.findTarget(state.names || [], config.target) >= 0, detail: state.error || "Chưa kết nối được vòng quay gốc.", supported: state.supported, error: state.error });
    })().catch(error => respond({ ok: false, error: error.message }));
    return true;
  });
  window.addEventListener("pagehide", () => { clearInterval(interval); interval = null; });
  window.addEventListener("pageshow", () => { if (config.enabled) void applyConfig(config); });
})();
