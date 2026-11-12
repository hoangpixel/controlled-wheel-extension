"use strict";
(() => {
  const $ = (id) => document.getElementById(id);
  let config = { enabled: false, target: "" };
  let busy = false;
  let statusPoll = null, polling = false, connectionWarning = false;
  function message(text, kind = "info") { $("message").textContent = text; $("message").dataset.kind = kind; }
  function render() {
    $("enabled").checked = config.enabled;
    $("mode-label").textContent = config.enabled ? "Enabled · Kết quả định trước" : "Disabled";
    $("current").textContent = config.target || "Chưa chọn";
    $("enabled").disabled = busy;
    $("winner").disabled = busy;
    $("save").disabled = busy;
    if (config.enabled && !statusPoll) {
      statusPoll = setInterval(async () => {
        if (busy || polling) return;
        polling = true;
        try {
          const warning = await check();
          if (warning) { connectionWarning = true; message(warning.text, warning.kind); }
          else if (connectionWarning) { connectionWarning = false; message("Đã kết nối vòng quay gốc.", "success"); }
        } finally { polling = false; }
      }, 1000);
    } else if (!config.enabled && statusPoll) { clearInterval(statusPoll); statusPoll = null; }
  }
  async function send(type) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("Không tìm thấy tab đang mở.");
    return chrome.tabs.sendMessage(tab.id, { type });
  }
  async function check() {
    try {
      const status = await send("FWD_STATUS");
      if (!status?.ok) throw new Error("Không thể kết nối demo.");
      $("open-demo").disabled = !config.enabled;
      $("matched-name").textContent = config.enabled && status.targetName ? `Khớp Entries: ${status.targetName}` : "";
      if (!config.enabled) {
        $("list-status").textContent = "Đã tắt · Vòng quay gốc hoạt động bình thường";
        return null;
      }
      $("list-status").textContent = `${status.count} tên · ${status.supported ? "Đã kết nối vòng quay gốc" : "Chưa kết nối vòng quay gốc"}`;
      if (!status.available) return { text: status.detail, kind: "error" };
      if (status.error) return { text: status.error, kind: "error" };
      if (config.target && !status.targetFound) return { text: `Tên “${config.target}” không tồn tại trong danh sách hiện tại.`, kind: "error" };
      return null;
    } catch {
      $("open-demo").disabled = true;
      $("matched-name").textContent = "";
      $("list-status").textContent = "Chưa kết nối Wheel of Names";
      return { text: "Mở https://wheelofnames.com/ và tải lại trang nếu vừa cài hoặc cập nhật extension.", kind: "error" };
    }
  }
  async function update(patch, success) {
    busy = true; render();
    try {
      // Read before merging to preserve changes from another popup/window.
      const stored = (await chrome.storage.local.get("fixedWinnerDemo")).fixedWinnerDemo || {};
      const next = { ...config, ...stored, ...patch };
      await chrome.storage.local.set({ fixedWinnerDemo: next });
      config = next;
      render();
      const warning = await check();
      connectionWarning = Boolean(warning);
      message(warning ? `${success} ${warning.text}` : success, warning?.kind || "success");
    } catch (error) { message(`Không lưu được cấu hình: ${error.message}`, "error"); }
    finally { busy = false; render(); }
  }
  $("winner-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const target = WheelDemoCore.normalizeName($("winner").value);
    if (!target) { message("Hãy nhập tên mục tiêu.", "error"); return; }
    $("winner").value = target;
    void update({ target }, "Đã lưu tên mục tiêu.");
  });
  $("enabled").addEventListener("change", () => { void update({ enabled: $("enabled").checked }, "Đã lưu chế độ demo."); });
  $("open-demo").addEventListener("click", async () => {
    try {
      const result = await send("FWD_OPEN");
      if (!result?.ok) throw new Error(result?.error || "Hãy bật chế độ demo.");
      window.close();
    } catch (error) { message(error.message, "error"); }
  });
  $("read-diagnostics").addEventListener("click", async () => {
    $("read-diagnostics").disabled = true;
    try {
      const result = await send("FWD_DIAGNOSTICS");
      if (!result?.ok) throw new Error(result?.error || "Không đọc được chẩn đoán.");
      $("diagnostics-output").value = JSON.stringify(result.diagnostics, null, 2);
    } catch (error) { $("diagnostics-output").value = error.message; }
    finally { $("read-diagnostics").disabled = false; }
  });
  async function init() {
    busy = true;
    try {
      const stored = (await chrome.storage.local.get("fixedWinnerDemo")).fixedWinnerDemo;
      config = { enabled: stored?.enabled === true, target: WheelDemoCore.normalizeName(stored?.target) };
      $("winner").value = config.target;
      const warning = await check();
      connectionWarning = Boolean(warning);
      if (warning) message(warning.text, warning.kind);
    } catch (error) { message(`Không đọc được cấu hình: ${error.message}`, "error"); }
    finally { busy = false; render(); }
  }
  void init();
})();
