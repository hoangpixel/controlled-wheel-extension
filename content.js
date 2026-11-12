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
  let previousFocus;
  let revision = 0;
  const palette = ["#8074de", "#35a8a0", "#e8b35a", "#d86b85", "#538ed0", "#a27ac6"];
  const styles = `
    :host { all: initial; font-family: system-ui,sans-serif; color-scheme: dark; }
    * { box-sizing: border-box; }
    button,input,textarea,select { font: inherit; }
    button { cursor:pointer; border:0; border-radius:10px; padding:12px 16px; color:#17132e; background:#b0a3ff; font-weight:700; }
    button:hover { filter:brightness(1.1); } button:disabled { opacity:.45; cursor:not-allowed; }
    :focus-visible { outline:3px solid #bdb3ff; outline-offset:3px; }
    .launcher { position:fixed; right:20px; bottom:20px; box-shadow:0 8px 30px #0008; border:1px solid #b4a8ff; background:#211b39; color:#e7e1ff; max-width:calc(100vw - 40px); font-size:13px; }
    dialog { display:none; width:min(920px,calc(100vw - 28px)); max-height:calc(100dvh - 28px); margin:auto; padding:0; border:1px solid #394260; border-radius:22px; background:#0e1423; color:#eef1ff; box-shadow:0 30px 100px #0009; overflow:auto; }
    dialog[open] { display:block; } dialog::backdrop { background:#050811c9; backdrop-filter:blur(5px); }
    header { padding:24px 26px 18px; border-bottom:1px solid #29324a; display:flex; justify-content:space-between; align-items:flex-start; gap:15px; }
    .eyebrow { color:#baaeff; font-size:10px; letter-spacing:2px; font-weight:700; }
    h2 { margin:7px 0; font-size:25px; letter-spacing:-.7px; }
    p { font-size:12px; line-height:1.6; margin:0; color:#aeb9d2; }
    .close { background:#202a40; color:#dde4ff; padding:8px 13px; font-size:20px; }
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
    footer { padding:0 26px 22px; font-size:11px; color:#8996b3; line-height:1.5; }
    @media(max-width:660px) { .layout { grid-template-columns:1fr; padding:18px; gap:18px; } header { padding:18px; } h2 { font-size:22px; } .wheel { max-width:310px; } }
    @media(prefers-reduced-motion:reduce) { dialog::backdrop { backdrop-filter:none; } }
  `;
  function ensureUI() {
    if (host) return;
    host = document.createElement("div");
    host.id = "fixed-winner-demo-host";
    host.style.setProperty("position", "fixed", "important");
    host.style.setProperty("z-index", "2147483647", "important");
    const shadow = host.attachShadow({ mode: "open" });
    // All markup is static; names enter the UI only through textContent/value.
    shadow.innerHTML = `<style>${styles}</style>
      <button class="launcher" type="button">◉ Fixed Winner Demo</button>
      <dialog aria-labelledby="fwd-heading" aria-describedby="fwd-description">
        <header><div><span class="eyebrow">ENABLED · KẾT QUẢ ĐỊNH TRƯỚC</span><h2 id="fwd-heading">Fixed Winner Demo</h2><p id="fwd-description">Vòng quay mô phỏng riêng. Kết quả được chọn trước từ popup extension.</p></div><button class="close" type="button" aria-label="Đóng demo">×</button></header>
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
            <button class="spin" type="button">Spin Demo</button>
          </section>
        </div>
        <footer>Các ô demo có kích thước bằng nhau. Trọng số, hình ảnh và tùy chỉnh của vòng quay gốc không được nhập vào demo.</footer>
      </dialog>`;
    document.documentElement.append(host);
    const get = (selector) => shadow.querySelector(selector);
    ui = { dialog: get("dialog"), launcher: get(".launcher"), canvas: get("canvas"), result: get(".result strong"), target: get(".target-name"), status: get(".status"), spin: get(".spin"), source: get("select"), manual: get(".manual"), input: get("#fwd-manual"), entries: get(".entries"), count: get(".count") };
    ui.input.value = manualNames.join("\n");
    ui.source.value = source;
    ui.manual.hidden = source !== "manual";
    ui.launcher.addEventListener("click", openDemo);
    get(".close").addEventListener("click", closeDemo);
    ui.dialog.addEventListener("cancel", (event) => { event.preventDefault(); closeDemo(); });
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
    ui.spin.textContent = spinning ? "Đang quay…" : "Spin Demo";
    ui.launcher.textContent = error ? "◉ Fixed Winner Demo · Cần kiểm tra" : "◉ Fixed Winner Demo";
    ui.launcher.title = error || `Mục tiêu: ${config.target}`;
    if (spinning) setStatus("Đang quay demo đến tên đã chọn trước…");
    else if (error) setStatus(error, true);
    else setStatus(`Sẵn sàng · ${current.names.length} tên · ${source === "manual" ? "Danh sách thủ công" : "Đồng bộ từ trang"}.`);
  }
  function sync() {
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
    if (!ui.dialog.open) {
      previousFocus = document.activeElement;
      ui.dialog.showModal();
    }
  }
  function closeDemo() {
    const interrupted = spinning;
    cancelSpin();
    if (interrupted) resetResult("Đã hủy lượt quay");
    ui?.dialog.close();
    renderState();
    if (previousFocus?.isConnected) previousFocus.focus();
  }
  function cancelSpin() { cancelAnimationFrame(frame); frame = 0; spinning = false; }
  function destroyUI() {
    closeDemo();
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
    resetResult("Đang quay…");
    renderState();
    function tick(now) {
      if (!spinning || !config.enabled || revision !== spinRevision) return;
      started ??= now;
      const t = Math.min(1, (now - started) / duration);
      angle = start + (end - start) * (1 - Math.pow(1 - t, 4));
      draw();
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
