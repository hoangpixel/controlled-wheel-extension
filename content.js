"use strict";
(() => {
  if (globalThis.__fixedWinnerDemoLoaded) return;
  globalThis.__fixedWinnerDemoLoaded = true;
  const KEY = "fixedWinnerDemo", SESSION = "fixedWinnerDemoSession", CHANNEL = "fixed-winner-native-v1";
  let config = { enabled: false, target: "" };
  let state = { supported: false, names: [], error: "Đang kết nối vòng quay gốc…" };
  let interval, sequence = 0, generation = 0;
  const pending = new Map();
  const leases = new Map(), acquiring = new Map();
  let unloaded = false;
  async function session(type, data = {}) {
    const result = await chrome.runtime.sendMessage({ type: `FWD_SESSION_${type}`, ...data });
    if (!result?.ok) throw new Error(result?.error || "Không kết nối được bộ lưu trạng thái lượt quay. Hãy reload extension.");
    return result;
  }
  const readConfig = async () => (await session("READ")).config;
  async function handleSession(message) {
    let result;
    try {
      if (message.operation === "acquire") {
        if (unloaded || !config.enabled || message.data?.runId !== config.runId) throw new Error("Cấu hình đã thay đổi.");
        acquiring.set(message.id, message.data.runId);
        const grant = await session("ACQUIRE", { runId: message.data.runId });
        if (grant.controlled) leases.set(grant.leaseId, message.data.runId);
        acquiring.delete(message.id);
        if (unloaded || message.data.runId !== config.runId || !config.enabled) {
          if (grant.controlled) {
            await session("FINISH", { runId: message.data.runId, leaseId: grant.leaseId, completed: false }).catch(() => {});
            leases.delete(grant.leaseId);
          }
          throw new Error("Đã hủy lượt chờ do cấu hình hoặc trang thay đổi.");
        }
        result = grant;
      } else if (message.operation === "finish") {
        const { runId, leaseId, completed } = message.data || {};
        if (!leaseId || leases.get(leaseId) !== runId) throw new Error("Lượt quay không còn hiệu lực.");
        try { result = await session("FINISH", { runId, leaseId, completed: completed === true }); }
        finally { leases.delete(leaseId); }
      } else throw new Error("Yêu cầu lượt quay không hợp lệ.");
    } catch (error) { acquiring.delete(message.id); result = { ok: false, error: error.message }; }
    window.postMessage({ channel: CHANNEL, direction: "to-page", type: "SESSION_REPLY", id: message.id, result }, location.origin);
  }
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
    if (message.type === "SESSION_REQUEST") { void handleSession(message); return; }
    if (message.type === "REPLY" && pending.has(message.id)) {
      const item = pending.get(message.id); clearTimeout(item.timeout); pending.delete(message.id); item.resolve(message.state);
    } else if (message.type === "STATUS" && config.enabled && message.state?.enabled && message.state.target === config.target && message.state.runId === config.runId) {
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
    const next = { enabled: stored?.enabled === true, target: WheelDemoCore.normalizeName(stored?.target),
      runId: stored?.runId || "", consumed: stored?.consumed === true };
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
  const ready = readConfig().then(applyConfig).catch(error => {
    console.warn("Fixed Winner Demo:", error.message);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes[KEY] || changes[SESSION])) void readConfig().then(applyConfig).catch(error => {
      console.warn("Fixed Winner Demo:", error.message);
    });
  });
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type === "FWD_LEASE_PING") {
      respond({ active: leases.has(message.leaseId) || [...acquiring.values()].includes(message.runId) }); return false;
    }
    if (!["FWD_STATUS", "FWD_OPEN", "FWD_DIAGNOSTICS"].includes(message?.type)) return false;
    (async () => {
      await ready;
      await applyConfig(await readConfig());
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
      respond({ ok: true, available: config.consumed || state.supported === true, count: state.names?.length || 0, source: "native",
        firstSpinDone: config.consumed || state.firstSpinDone === true, mode: config.consumed ? "random" : state.mode,
        targetFound: match.index >= 0, targetName: match.name, targetMatch: match.kind,
        detail: state.error || "Chưa kết nối được vòng quay gốc.", supported: state.supported, error: state.error });
    })().catch(error => respond({ ok: false, error: error.message }));
    return true;
  });
  window.addEventListener("pagehide", () => {
    unloaded = true; clearInterval(interval); interval = null;
    for (const [leaseId, runId] of leases) void session("FINISH", { runId, leaseId, completed: false }).catch(() => {});
    leases.clear(); acquiring.clear();
  });
  window.addEventListener("pageshow", () => { unloaded = false; if (config.enabled) void readConfig().then(applyConfig); });
})();
