/* Serializes local first-spin reservations across tabs and service-worker restarts. */
"use strict";
(() => {
  const KEY = "fixedWinnerDemo", SESSION = "fixedWinnerDemoSession";
  const TYPES = new Set(["FWD_SESSION_READ", "FWD_SESSION_UPDATE", "FWD_SESSION_ACQUIRE", "FWD_SESSION_FINISH"]);
  let queue = Promise.resolve();
  const normalize = value => String(value ?? "").normalize("NFC").trim();
  async function read() {
    const stored = await chrome.storage.local.get([KEY, SESSION]);
    const config = { ...stored[KEY], enabled: stored[KEY]?.enabled === true, target: normalize(stored[KEY]?.target) };
    let changed = false;
    if (typeof config.runId !== "string" || !config.runId) { config.runId = crypto.randomUUID(); changed = true; }
    let session = stored[SESSION];
    if (!session || session.runId !== config.runId) {
      session = { runId: config.runId, used: false, lease: null }; changed = true;
    }
    if (changed) await chrome.storage.local.set({ [KEY]: config, [SESSION]: session });
    return { config, session };
  }
  const publicConfig = ({ config, session }) => ({ ...config, consumed: session.used === true });
  function owner(sender) {
    let origin;
    try { origin = new URL(sender.url || sender.tab?.url).origin; } catch { /* Invalid caller. */ }
    if (!Number.isInteger(sender.tab?.id) || sender.frameId !== 0 || origin !== "https://wheelofnames.com" || !sender.documentId) {
      throw new Error("Yêu cầu lượt quay không đến từ trang Wheel of Names hợp lệ.");
    }
    return { tabId: sender.tab.id, documentId: sender.documentId };
  }
  async function handle(message, sender) {
    if (message.type === "FWD_SESSION_UPDATE" && sender.tab) throw new Error("Chỉ popup được thay đổi cấu hình.");
    const current = await read();
    if (message.type === "FWD_SESSION_READ") return { ok: true, config: publicConfig(current) };
    if (message.type === "FWD_SESSION_UPDATE") {
      const patch = message.patch || {};
      const next = { ...current.config };
      if (Object.hasOwn(patch, "target")) next.target = normalize(patch.target);
      if (Object.hasOwn(patch, "enabled")) next.enabled = patch.enabled === true;
      const rearm = next.target !== current.config.target || next.enabled && !current.config.enabled;
      if (rearm) next.runId = crypto.randomUUID();
      const session = rearm ? { runId: next.runId, used: false, lease: null } : next.enabled ? current.session : { ...current.session, lease: null };
      await chrome.storage.local.set({ [KEY]: next, [SESSION]: session });
      return { ok: true, config: publicConfig({ config: next, session }) };
    }
    const caller = owner(sender), { config, session } = current;
    if (!config.enabled || message.runId !== config.runId) throw new Error("Cấu hình đã đổi; hãy thử quay lại.");
    if (message.type === "FWD_SESSION_ACQUIRE") {
      if (session.used) return { ok: true, controlled: false };
      if (session.lease) {
        let active = false;
        try {
          const reply = await chrome.tabs.sendMessage(session.lease.tabId,
            { type: "FWD_LEASE_PING", leaseId: session.lease.id, runId: config.runId }, { documentId: session.lease.documentId });
          active = reply?.active === true;
        } catch { /* The old document was closed/reloaded; its lease is abandoned. */ }
        if (active) throw new Error("Lượt cố định đầu tiên đang chạy ở một tab khác. Hãy đợi lượt đó kết thúc.");
      }
      const lease = { ...caller, id: crypto.randomUUID() };
      await chrome.storage.local.set({ [SESSION]: { ...session, lease } });
      return { ok: true, controlled: true, leaseId: lease.id };
    }
    const lease = session.lease;
    if (!lease || lease.id !== message.leaseId || lease.tabId !== caller.tabId || lease.documentId !== caller.documentId) {
      throw new Error("Lượt quay đã hết hiệu lực; không công bố kết quả cũ.");
    }
    await chrome.storage.local.set({ [SESSION]: { runId: config.runId, used: message.completed === true, lease: null } });
    return { ok: true };
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (!TYPES.has(message?.type)) return false;
    const operation = queue.then(() => handle(message, sender));
    queue = operation.catch(() => {});
    operation.then(respond, error => respond({ ok: false, error: error.message }));
    return true;
  });
})();
