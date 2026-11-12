"use strict";
(() => {
  if (globalThis.__fixedWinnerDemoLoaded) return;
  globalThis.__fixedWinnerDemoLoaded = true;
  const Core = WheelDemoCore;
  const KEY = "fixedWinnerDemo";
  let config = { enabled: false, target: "" };
  let source = "page";
  let manualNames = [];
  let current = { available: false, names: [], detail: "Đang đọc danh sách…" };
  let host, ui, observer, poll, debounce;
  let angle = 0, frame = 0, spinning = false, wheelImage;
  let placement = "page";
  let lastDebugFrame = -Infinity;
  let revision = 0;
  const palette = ["#8074de", "#35a8a0", "#e8b35a", "#d86b85", "#538ed0", "#a27ac6"];
  const styles = `
    :host { all: initial; display:block; container-type:inline-size; font-family: system-ui,sans-serif; color-scheme: dark; color:#eef1ff; }
    * { box-sizing: border-box; }
    button,input,textarea,select { font: inherit; }
    button { cursor:pointer; border:0; border-radius:10px; padding:12px 16px; color:#17132e; background:#b0a3ff; font-weight:700; }
    button:hover { filter:brightness(1.1); } button:disabled { opacity:.45; cursor:not-allowed; }
    :focus-visible { outline:3px solid #bdb3ff; outline-offset:3px; }
    .demo { width:100%; margin:0; border:1px solid #62618b; border-radius:18px; background:#0e1423; color:#eef1ff; overflow:hidden; }
    header { padding:24px 26px 18px; border-bottom:1px solid #29324a; display:flex; justify-content:space-between; align-items:flex-start; gap:15px; }
    .eyebrow { display:block; color:#ffe0a3; font-size:12px; letter-spacing:.5px; font-weight:800; }
    h2 { margin:7px 0; font-size:25px; letter-spacing:-.7px; }
    p { font-size:12px; line-height:1.6; margin:0; color:#aeb9d2; }
    .disable { background:#202a40; color:#dde4ff; padding:10px 13px; font-size:12px; flex-shrink:0; }
    .layout { display:grid; grid-template-columns:minmax(0,1.3fr) minmax(240px,1fr); gap:24px; padding:24px 26px; }
    .wheel-area { min-width:0; text-align:center; align-self:center; }
    .wheel { position:relative; margin:8px auto 16px; max-width:440px; }
    canvas { display:block; width:100%; height:auto; aspect-ratio:1; }
    .pointer { position:absolute; top:-3px; left:50%; transform:translateX(-50%); width:0; height:0; border-left:13px solid transparent; border-right:13px solid transparent; border-top:32px solid #fff0bf; filter:drop-shadow(0 3px 2px #0008); }
    .result { min-height:64px; padding:10px; border:1px solid #34445c; background:#182338; border-radius:12px; overflow-wrap:anywhere; }
    .result small { color:#93a4c5; font-size:10px; letter-spacing:1.5px; display:block; }
    .result strong { display:block; font-size:22px; margin-top:3px; }
    .panel { display:flex; flex-direction:column; gap:14px; min-width:0; }
    .target { padding:15px; background:#1c2337; border:1px solid #343d59; border-radius:12px; }
    .target small { display:block; font-size:10px; letter-spacing:1px; color:#a8b3cc; }
    .target strong { display:block; font-size:22px; margin:6px 0; overflow-wrap:anywhere; }
    label { display:block; font-size:12px; font-weight:600; margin-bottom:6px; }
    select,textarea { width:100%; border:1px solid #3b4663; background:#141d30; color:#e5eaff; border-radius:9px; padding:10px; font-size:12px; }
    textarea { min-height:120px; resize:vertical; line-height:1.65; }
    .manual[hidden] { display:none; }
    .secondary { background:#26334d; color:#e4eaff; font-size:12px; }
    .manual button { margin-top:8px; width:100%; }
    .status { font-size:12px; line-height:1.6; min-height:38px; color:#98dfce; overflow-wrap:anywhere; }
    .status[data-error=true] { color:#ffc190; }
    .spin { width:100%; margin-top:auto; font-size:15px; }
    details { font-size:12px; color:#b4bfd6; } summary { cursor:pointer; margin-bottom:7px; }
    .debug { border-top:1px solid #34405c; padding-top:12px; }
    .debug dl { display:grid; grid-template-columns:1fr 1fr; gap:6px 12px; font:11px/1.6 ui-monospace,monospace; margin:0; }
    .debug dt { color:#93a4c5; } .debug dd { margin:0; overflow-wrap:anywhere; color:#e2e8ff; }
    footer { padding:0 26px 22px; font-size:11px; color:#8996b3; line-height:1.5; }
    @media(max-width:660px) { .layout { grid-template-columns:1fr; padding:18px; gap:18px; } header { padding:18px; } h2 { font-size:22px; } .wheel { max-width:310px; } }
    @container(max-width:660px) { .layout { grid-template-columns:1fr; padding:18px; gap:18px; } header { padding:18px; } h2 { font-size:22px; } .wheel { max-width:310px; } }
  `;
  function ensureUI() {
    if (host) { mountUI(); return; }
    host = document.createElement("div");
    host.id = "fixed-winner-demo-host";
    host.style.setProperty("display", "block", "important");
    host.style.setProperty("position", "relative", "important");
    host.style.setProperty("width", "100%", "important");
    host.style.setProperty("min-width", "0", "important");
    host.style.setProperty("grid-column", "1 / -1", "important");
    host.style.setProperty("flex-basis", "100%", "important");
    host.style.setProperty("margin", "16px 0", "important");
    const shadow = host.attachShadow({ mode: "open" });
    // All markup is static; names enter the UI only through textContent/value.
    shadow.innerHTML = `<style>${styles}</style>
      <section class="demo" aria-labelledby="fwd-heading" aria-describedby="fwd-description">
        <header><div><span class="eyebrow">CONTROLLED DEMO – Kết quả định trước</span><h2 id="fwd-heading">Fixed Winner Demo</h2><p id="fwd-description">Canvas demo tích hợp trong trang. Chọn tên từ popup extension; dùng nút Spin bên dưới để quay demo.</p></div><button class="disable" type="button">Tắt demo</button></header>
        <div class="layout">
          <section class="wheel-area" aria-label="Vòng quay demo">
            <div class="wheel"><canvas width="900" height="900" aria-label="Vòng quay demo; kim chỉ ở phía trên" role="img"></canvas><div class="pointer" aria-hidden="true"></div></div>
            <div class="result" role="status" aria-live="polite"><small>KẾT QUẢ DEMO</small><strong>Chưa quay</strong></div>
          </section>
          <section class="panel">
            <div class="target"><small>TÊN ĐÃ CHỌN TRƯỚC</small><strong class="target-name"></strong><p>Đổi tên bằng Save Winner trong popup.</p></div>
            <div><label for="fwd-source">Nguồn danh sách</label><select id="fwd-source"><option value="page">Đồng bộ từ trang</option><option value="manual">Nhập thủ công cho demo</option></select></div>
            <div class="manual" hidden><label for="fwd-manual">Mỗi dòng một tên</label><textarea id="fwd-manual" spellcheck="false" placeholder="Hoàng&#10;Huy&#10;Đạt"></textarea><button class="apply secondary" type="button">Áp dụng danh sách demo</button></div>
            <details><summary class="count">Danh sách hiện tại</summary><textarea class="entries" readonly aria-label="Danh sách tên đang dùng"></textarea></details>
            <p class="status" role="status" aria-live="polite"></p>
            <button class="spin" type="button">Spin</button>
            <details class="debug" open><summary>Debug · chỉ số bắt đầu từ 0</summary><dl>
              <dt>Tên mục tiêu</dt><dd class="debug-target"></dd>
              <dt>Chỉ số mục tiêu</dt><dd class="debug-index"></dd>
              <dt>Góc hiện tại</dt><dd class="debug-angle"></dd>
              <dt>Ô dưới kim</dt><dd class="debug-pointer"></dd>
              <dt>Kết quả hoàn tất</dt><dd class="debug-result"></dd>
              <dt>Vị trí tích hợp</dt><dd class="debug-placement"></dd>
            </dl></details>
          </section>
        </div>
        <footer>CONTROLLED DEMO – Kết quả định trước. Các ô demo bằng nhau. Vòng quay và nút Spin gốc của website vẫn hoạt động độc lập ở khu vực gốc.</footer>
      </section>`;
    mountUI();
    const get = (selector) => shadow.querySelector(selector);
    ui = { section: get(".demo"), disable: get(".disable"), canvas: get("canvas"), result: get(".result strong"), target: get(".target-name"), status: get(".status"), spin: get(".spin"), source: get("select"), manual: get(".manual"), input: get("#fwd-manual"), entries: get(".entries"), count: get(".count"), debugTarget: get(".debug-target"), debugIndex: get(".debug-index"), debugAngle: get(".debug-angle"), debugPointer: get(".debug-pointer"), debugResult: get(".debug-result"), debugPlacement: get(".debug-placement") };
    ui.input.value = manualNames.join("\n");
    ui.source.value = source;
    ui.manual.hidden = source !== "manual";
    ui.disable.addEventListener("click", disableDemo);
    ui.source.addEventListener("change", () => {
      source = ui.source.value;
      ui.manual.hidden = source !== "manual";
      sync();
    });
    get(".apply").addEventListener("click", async () => {
      manualNames = Core.parseNames(ui.input.value);
      sync();
      try { await chrome.storage.local.set({ fixedWinnerDemoManualNames: manualNames }); }
      catch { setStatus("Đã áp dụng trong tab này nhưng không lưu được danh sách thủ công.", true); }
    });
    ui.spin.addEventListener("click", spin);
    renderState();
    paintBase();
  }
  function mountUI() {
    if (!host) return;
    const point = WheelDemoReader.mountPoint(document);
    if (!point.parent) return;
    placement = point.placement;
    // SPA rerenders may detach the host. Reattach the same UI without touching native nodes.
    if (host.parentElement !== point.parent || (point.before && point.before !== host && host.nextSibling !== point.before)) {
      point.parent.insertBefore(host, point.before);
    }
  }
  async function disableDemo() {
    ui.disable.disabled = true;
    try {
      const stored = (await chrome.storage.local.get(KEY))[KEY] || {};
      const next = { ...stored, enabled: false };
      await chrome.storage.local.set({ [KEY]: next });
      applyConfig(next);
    } catch {
      if (ui) ui.disable.disabled = false;
      setStatus("Không lưu được trạng thái tắt. Hãy thử lại từ popup.", true);
    }
  }
  function renderDebug() {
    if (!ui) return;
    const state = Core.inspect(current.names, config.target, angle);
    ui.debugTarget.textContent = state.target || "Chưa chọn";
    ui.debugIndex.textContent = String(state.targetIndex);
    ui.debugAngle.textContent = `${state.angle.toFixed(6)} rad / ${state.degrees.toFixed(3)}°`;
    ui.debugPointer.textContent = state.pointerIndex < 0 ? "Danh sách trống" : `[${state.pointerIndex}] ${state.pointerName}`;
    ui.debugResult.textContent = ui.result.textContent;
    ui.debugPlacement.textContent = placement === "wheel" ? "Cạnh khu vực vòng quay gốc" : "Đầu nội dung trang (không xác định được canvas gốc)";
  }
  function setStatus(text, error = false) {
    if (!ui) return;
    ui.status.textContent = text;
    ui.status.dataset.error = String(error);
  }
  function resetResult(text = "Chưa quay") {
    if (!ui) return;
    ui.result.textContent = text;
    ui.canvas.setAttribute("aria-label", "Vòng quay demo; kim chỉ ở phía trên");
  }
  function problem() {
    if (!current.available) return current.detail;
    if (!current.names.length) return "Danh sách đang trống. Hãy thêm tên trước khi quay.";
    if (!config.target) return "Chưa chọn mục tiêu. Mở popup, nhập tên và bấm Save Winner.";
    if (Core.findTarget(current.names, config.target) < 0) return `Không tìm thấy “${config.target}” trong danh sách hiện tại.`;
    return "";
  }
  function renderState() {
    if (!ui) return;
    const error = problem();
    ui.target.textContent = config.target || "Chưa chọn";
    ui.entries.value = current.names.join("\n");
    ui.count.textContent = `Danh sách hiện tại · ${current.names.length} tên`;
    ui.spin.disabled = spinning || Boolean(error);
    ui.spin.textContent = spinning ? "Đang quay…" : "Spin";
    renderDebug();
    if (spinning) setStatus("Đang quay demo đến tên đã chọn trước…");
    else if (error) setStatus(error, true);
    else setStatus(`Sẵn sàng · ${current.names.length} tên · ${source === "manual" ? "Danh sách thủ công" : "Đồng bộ từ trang"}.`);
  }
  function sync() {
    if (config.enabled) mountUI();
    const next = source === "manual" ? { available: true, names: [...manualNames], detail: "Danh sách demo nhập thủ công." } : WheelDemoReader.read(document);
    const changed = current.available !== next.available || JSON.stringify(current.names) !== JSON.stringify(next.names);
    current = next;
    if (changed) {
      revision++;
      const interrupted = spinning;
      cancelSpin();
      if (ui) {
        resetResult(interrupted ? "Đã hủy · danh sách thay đổi" : "Chưa quay");
        angle = 0;
        paintBase();
      }
    }
    renderState();
    return current;
  }
  function scheduleSync() {
    if (debounce) return;
    debounce = setTimeout(() => { debounce = null; sync(); }, 160);
  }
  function startWatching() {
    stopWatching();
    observer = new MutationObserver((records) => {
      if (records.some((record) => record.target !== host && !host?.contains(record.target))) scheduleSync();
    });
    // Shadow-root UI mutations are outside this observation, avoiding feedback loops.
    observer.observe(document.body || document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["contenteditable", "hidden", "aria-hidden"] });
    document.addEventListener("input", scheduleSync, true);
    document.addEventListener("change", scheduleSync, true);
    // Vue/programmatic textarea.value updates need polling: they emit no DOM mutation.
    poll = setInterval(() => { if (!document.hidden) sync(); }, 1200);
  }
  function stopWatching() {
    observer?.disconnect(); observer = null;
    clearInterval(poll); clearTimeout(debounce); debounce = null;
    document.removeEventListener("input", scheduleSync, true);
    document.removeEventListener("change", scheduleSync, true);
  }
  function openDemo() {
    if (!config.enabled) return;
    ensureUI(); sync();
    host.scrollIntoView({ behavior: "auto", block: "start" });
    ui.spin.focus({ preventScroll: true });
  }
  function cancelSpin() { cancelAnimationFrame(frame); frame = 0; spinning = false; }
  function destroyUI() {
    cancelSpin();
    host?.remove(); host = null; ui = null; wheelImage = null;
  }
  function paintBase() {
    if (!ui) return;
    wheelImage = document.createElement("canvas");
    wheelImage.width = wheelImage.height = 900;
    const ctx = wheelImage.getContext("2d");
    const names = current.names;
    const n = names.length;
    ctx.translate(450, 450);
    if (!n) {
      ctx.beginPath(); ctx.arc(0, 0, 422, 0, Core.TAU); ctx.fillStyle = "#222e45"; ctx.fill();
    }
    for (let i = 0; i < n; i++) {
      const arc = Core.TAU / n;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 422, i * arc, (i + 1) * arc); ctx.closePath();
      ctx.fillStyle = palette[i % palette.length]; ctx.fill();
      ctx.strokeStyle = "#0e142344"; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.rotate((i + .5) * arc);
      // Each label is clipped inside its own slice; full names remain in the list.
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 414, -arc / 2, arc / 2); ctx.closePath(); ctx.clip();
      ctx.fillStyle = "#101522";
      ctx.font = `600 ${Math.max(6, Math.min(28, 1450 / n))}px system-ui`;
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillText(names[i], 394, 0, 280);
      ctx.restore();
    }
    draw();
  }
  function draw() {
    if (!ui || !wheelImage) return;
    const ctx = ui.canvas.getContext("2d");
    ctx.clearRect(0, 0, 900, 900);
    ctx.save(); ctx.translate(450, 450); ctx.rotate(angle); ctx.drawImage(wheelImage, -450, -450); ctx.restore();
    ctx.beginPath(); ctx.arc(450, 450, 427, 0, Core.TAU); ctx.strokeStyle = "#c3b8ff"; ctx.lineWidth = 7; ctx.stroke();
    ctx.beginPath(); ctx.arc(450, 450, 64, 0, Core.TAU); ctx.fillStyle = "#11192c"; ctx.fill();
    ctx.strokeStyle = "#e3dbff"; ctx.lineWidth = 4; ctx.stroke();
    ctx.font = "700 22px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#e3dbff"; ctx.fillText("DEMO", 450, 450);
  }
  function spin() {
    if (!config.enabled || spinning) return;
    sync(); // Re-read immediately: never spin using a stale sorted/shuffled list.
    if (problem()) return;
    const names = [...current.names];
    const target = config.target;
    const spinRevision = revision;
    const index = Core.findTarget(names, target);
    const start = Core.wrap(angle);
    const end = Core.landingAngle(names.length, index, start);
    const duration = matchMedia("(prefers-reduced-motion: reduce)").matches ? 900 : 4800;
    let started;
    spinning = true;
    lastDebugFrame = -Infinity;
    resetResult("Đang quay…");
    renderState();
    function tick(now) {
      if (!spinning || !config.enabled || revision !== spinRevision) return;
      started ??= now;
      const t = Math.min(1, (now - started) / duration);
      angle = start + (end - start) * (1 - Math.pow(1 - t, 4));
      draw();
      if (now - lastDebugFrame >= 100 || t === 1) { renderDebug(); lastDebugFrame = now; }
      if (t < 1) { frame = requestAnimationFrame(tick); return; }
      // Verify again in case changes happened while the tab was suspended.
      sync();
      if (!spinning || revision !== spinRevision || config.target !== target) return;
      angle = Core.wrap(end);
      draw();
      spinning = false;
      const winner = names[Core.indexAtPointer(names.length, angle)];
      ui.result.textContent = winner;
      ui.canvas.setAttribute("aria-label", `Fixed Winner Demo: kim chỉ vào ${winner}`);
      renderState();
      setStatus(`Kết quả demo đã định trước: ${winner}. Kim chỉ đúng ô này.`);
    }
    frame = requestAnimationFrame(tick);
  }
  function applyConfig(stored) {
    const next = { enabled: stored?.enabled === true, target: Core.normalizeName(stored?.target) };
    const changed = next.target !== config.target;
    const wasEnabled = config.enabled;
    config = next;
    if (changed) {
      revision++;
      cancelSpin();
      resetResult();
    }
    if (!next.enabled) { stopWatching(); destroyUI(); return; }
    ensureUI();
    sync();
    if (!wasEnabled) startWatching();
  }
  const ready = chrome.storage.local.get([KEY, "fixedWinnerDemoManualNames"]).then((stored) => {
    manualNames = Array.isArray(stored.fixedWinnerDemoManualNames) ? stored.fixedWinnerDemoManualNames.map(Core.normalizeName).filter(Boolean) : [];
    applyConfig(stored[KEY]);
  }).catch((error) => console.warn("Fixed Winner Demo: không đọc được cấu hình.", error));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.fixedWinnerDemoManualNames) {
      const value = changes.fixedWinnerDemoManualNames.newValue;
      manualNames = Array.isArray(value) ? value.map(Core.normalizeName).filter(Boolean) : [];
      if (ui) ui.input.value = manualNames.join("\n");
      if (source === "manual") sync();
    }
    if (changes[KEY]) applyConfig(changes[KEY].newValue);
  });
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (!["FWD_STATUS", "FWD_OPEN"].includes(message?.type)) return false;
    (async () => {
      await ready;
      // Synchronize storage before replying to a popup that just saved settings.
      applyConfig((await chrome.storage.local.get(KEY))[KEY]);
      sync();
      if (message.type === "FWD_OPEN") {
        if (!config.enabled) { respond({ ok: false, error: "Hãy bật Fixed Winner Demo." }); return; }
        openDemo();
      }
      respond({ ok: true, available: current.available, count: current.names.length, source, targetFound: Core.findTarget(current.names, config.target) >= 0, detail: current.detail });
    })().catch((error) => respond({ ok: false, error: error.message }));
    return true;
  });
  window.addEventListener("pagehide", () => { stopWatching(); cancelSpin(); });
  window.addEventListener("pageshow", () => { if (config.enabled) { startWatching(); sync(); } });
})();
