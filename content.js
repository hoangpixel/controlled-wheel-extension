"use strict";
(() => {
  if (globalThis.__fixedWinnerDemoLoaded) return;
  globalThis.__fixedWinnerDemoLoaded = true;
  const KEY = "fixedWinnerDemo", CHANNEL = "fixed-winner-native-v1";
  let config = { enabled: false, target: "" };
  let state = { supported: false, names: [], error: "Đang kết nối vòng quay gốc…" };
  let interval, sequence = 0, generation = 0;
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
      state = message.state;
    }
  });
  async function refresh() {
    const expected = generation;
    try {
      const next = await rpc("CONFIG", { config });
      if (expected !== generation) return;
      state = next;
    } catch (error) {
      if (expected !== generation) return;
      state = { supported: false, names: [], error: error.message };
    }
  }
  async function applyConfig(stored) {
    const next = { enabled: stored?.enabled === true, target: WheelDemoCore.normalizeName(stored?.target) };
    const expected = ++generation;
    config = next;
    clearInterval(interval); interval = null;
    if (config.enabled) {
      await refresh();
      if (expected === generation && config.enabled) {
        clearInterval(interval);
        interval = setInterval(() => { if (!document.hidden) void refresh(); }, 1500);
      }
    } else {
      const restored = await rpc("CONFIG", { config });
      if (expected !== generation) return;
      if (restored.enabled || restored.supported) throw new Error("Chưa xác nhận được việc khôi phục vòng quay gốc. Hãy tải lại trang.");
      state = restored;
    }
  }
  const ready = chrome.storage.local.get(KEY).then(stored => applyConfig(stored[KEY])).catch(error => {
    console.warn("Fixed Winner Demo:", error.message);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[KEY]) void applyConfig(changes[KEY].newValue).catch(error => {
      console.warn("Fixed Winner Demo:", error.message);
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
      const match = WheelDemoCore.resolveTarget(state.names || [], config.target);
      respond({ ok: true, available: state.supported === true, count: state.names?.length || 0, source: "native",
        targetFound: match.index >= 0, targetName: match.name, targetMatch: match.kind,
        detail: state.error || "Chưa kết nối được vòng quay gốc.", supported: state.supported, error: state.error });
    })().catch(error => respond({ ok: false, error: error.message }));
    return true;
  });
  window.addEventListener("pagehide", () => { clearInterval(interval); interval = null; });
  window.addEventListener("pageshow", () => { if (config.enabled) void applyConfig(config); });
})();
