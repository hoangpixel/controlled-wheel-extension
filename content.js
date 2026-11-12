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
    const point = WheelDemoReader.mountPoint(document);
    if (point.parent && (host.parentElement !== point.parent || (point.before && point.before !== host && host.nextSibling !== point.before))) {
      point.parent.insertBefore(host, point.before);
    }
  }
  function ensureUI() {
    if (host) { mount(); return; }
    host = document.createElement("div"); host.id = "fixed-winner-demo-host";
    for (const [key, value] of Object.entries({ display: "block", position: "relative", width: "100%", "min-width": "0", "grid-column": "1 / -1", "flex-basis": "100%", margin: "12px 0" })) host.style.setProperty(key, value, "important");
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>
      :host { all:initial; display:block; color-scheme:dark; font:13px/1.6 system-ui,sans-serif; color:#edf1ff; }
      * { box-sizing:border-box; } .panel { border:2px solid #cbb77a; border-radius:14px; background:#121a2a; padding:18px; }
      header { display:flex; align-items:start; justify-content:space-between; gap:16px; flex-wrap:wrap; }
      .badge { display:block; color:#ffe3a4; font-weight:800; font-size:14px; } p { margin:6px 0; }
      .target { font-size:20px; overflow-wrap:anywhere; } .status { color:#9de4c7; overflow-wrap:anywhere; } .status[data-error=true] { color:#ffb7a8; }
      button { font:600 12px system-ui; border:1px solid #55627e; background:#293753; color:white; border-radius:8px; padding:10px 14px; cursor:pointer; }
      button:disabled { opacity:.5; } :focus-visible { outline:3px solid #c4b7ff; outline-offset:3px; }
      details { margin-top:12px; color:#bac6de; } summary { cursor:pointer; } .debug { white-space:pre-wrap; overflow-wrap:anywhere; font:12px/1.7 ui-monospace,monospace; }
      textarea { width:100%; min-height:100px; background:#0c1321; color:#e2eaff; border:1px solid #455371; border-radius:8px; padding:9px; font:12px/1.6 system-ui; }
    </style><section class="panel" aria-label="Điều khiển vòng quay gốc">
      <header><div><span class="badge">CONTROLLED DEMO – Kết quả định trước</span><p>Áp dụng trên Canvas và thao tác quay gốc của website.</p></div><button class="disable" type="button">Tắt điều khiển</button></header>
      <p>Tên đã chọn: <strong class="target"></strong></p>
      <p class="status" role="status" aria-live="polite"></p>
      <p>Khi trạng thái báo đã kết nối, bấm trực tiếp vòng quay hoặc nút quay gốc. Không có vòng quay Canvas thứ hai.</p>
      <details open><summary>Debug vòng quay gốc · chỉ số từ 0</summary><pre class="debug"></pre></details>
      <details><summary class="count">Danh sách thực tế của engine</summary><textarea class="entries" readonly aria-label="Danh sách tên trên vòng quay gốc"></textarea></details>
    </section>`;
    const get = selector => shadow.querySelector(selector);
    ui = { target: get(".target"), status: get(".status"), debug: get(".debug"), entries: get(".entries"), count: get(".count"), disable: get(".disable") };
    ui.disable.addEventListener("click", async () => {
      ui.disable.disabled = true;
      try {
        const stored = (await chrome.storage.local.get(KEY))[KEY] || {};
        const next = { ...stored, enabled: false };
        await chrome.storage.local.set({ [KEY]: next });
        // onChanged applies the latest stored value, avoiding a stale second update.
      } catch (error) { if (ui) { ui.disable.disabled = false; ui.status.textContent = error.message; ui.status.dataset.error = "true"; } }
    });
    mount();
  }
  function render() {
    if (!config.enabled) return;
    ensureUI();
    const names = Array.isArray(state.names) ? state.names : [];
    const index = WheelDemoCore.findTarget(names, config.target);
    const error = state.error || (!state.supported ? "Chưa kết nối được vòng quay gốc; chưa áp dụng kết quả cố định." : index < 0 ? `Không tìm thấy “${config.target}” trên vòng quay gốc.` : "");
    ui.target.textContent = config.target || "Chưa chọn";
    ui.status.dataset.error = String(Boolean(error));
    ui.status.textContent = error || (state.spinning ? "Đang điều khiển vòng quay gốc đến tên đã chọn…" : `Đã kết nối vòng quay gốc · ${names.length} tên · Bấm quay trực tiếp trên website.`);
    ui.entries.value = names.join("\n"); ui.count.textContent = `Danh sách thực tế của engine · ${names.length} tên`;
    const angle = Number.isFinite(state.angle) ? state.angle : 0;
    ui.debug.textContent = `Engine: ${state.supported ? "Đã kết nối" : "Không tương thích / chưa kết nối"}\nTên mục tiêu: ${config.target || "Chưa chọn"}\nChỉ số mục tiêu: ${index}\nGóc: ${angle.toFixed(6)} rad / ${(angle * 180 / Math.PI).toFixed(3)}°\nÔ dưới kim: [${state.pointerIndex ?? -1}] ${state.pointerName || "—"}\nKết quả thực tế: ${state.result || "Chưa có"}`;
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
    if (ui) { ui.status.textContent = error.message; ui.status.dataset.error = "true"; }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[KEY]) void applyConfig(changes[KEY].newValue).catch(error => {
      if (ui) { ui.status.textContent = error.message; ui.status.dataset.error = "true"; }
    });
  });
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (!["FWD_STATUS", "FWD_OPEN"].includes(message?.type)) return false;
    (async () => {
      await ready;
      await applyConfig((await chrome.storage.local.get(KEY))[KEY]);
      if (message.type === "FWD_OPEN") {
        if (!config.enabled) { respond({ ok: false, error: "Hãy bật điều khiển vòng quay gốc." }); return; }
        host.scrollIntoView({ block: "start", behavior: "auto" });
      }
      respond({ ok: true, available: state.supported === true, count: state.names?.length || 0, source: "native", targetFound: WheelDemoCore.findTarget(state.names || [], config.target) >= 0, detail: state.error || "Chưa kết nối được vòng quay gốc.", supported: state.supported, error: state.error });
    })().catch(error => respond({ ok: false, error: error.message }));
    return true;
  });
  window.addEventListener("pagehide", () => { clearInterval(interval); interval = null; });
  window.addEventListener("pageshow", () => { if (config.enabled) void applyConfig(config); });
})();
