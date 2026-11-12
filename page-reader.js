/* Read-only DOM adapter. Intentionally avoids Vue private state and page scripts. */
(function (root) {
  "use strict";
  const EDITABLE = '[contenteditable]:not([contenteditable="false"])';
  const SELECTOR = `textarea, ${EDITABLE}`;
  function discover(doc) {
    const candidates = [...doc.querySelectorAll(SELECTOR)].filter((el) => {
      if (!el.getClientRects().length || el.closest('[role="dialog"], dialog, [aria-hidden="true"]')) return false;
      if (el.parentElement?.closest(EDITABLE)) return false;
      const hint = [el.id, el.getAttribute("name"), el.getAttribute("aria-label"), el.getAttribute("placeholder")].join(" ");
      return !/search|winner|result|description|title|tìm kiếm|kết quả/i.test(hint);
    });
    const ranked = candidates.map((el) => {
      const hint = [el.id, el.className, el.getAttribute("name"), el.getAttribute("aria-label"), el.getAttribute("placeholder")].join(" ");
      const score = /\b(names?|entries|entry-list|namelist|danh sách|mục nhập)\b/i.test(hint) ? 10 : /ql-editor|ProseMirror/.test(hint) ? 5 : 0;
      return { el, score };
    }).sort((a, b) => b.score - a.score);
    if (!ranked.length) return null;
    // Refuse ambiguous editors instead of accidentally importing another field.
    if (ranked.length > 1 && ranked[0].score === ranked[1].score) return null;
    return ranked[0].el;
  }
  function read(doc) {
    const editor = discover(doc);
    if (!editor) return { available: false, names: [], detail: "Không xác định được ô danh sách. Mở tab Entries trên trang hoặc chọn nhập thủ công." };
    const text = editor.tagName === "TEXTAREA" ? editor.value : editor.innerText;
    return { available: true, names: root.WheelDemoCore.parseNames(text), detail: "Đang đọc ô danh sách hiển thị trên trang." };
  }
  function mountPoint(doc) {
    // Read layout only. Never move, hide, replace, or bind handlers to native controls.
    const wheels = [...doc.querySelectorAll("canvas")].filter((canvas) => {
      if (!canvas.getClientRects().length || canvas.closest('[role="dialog"], dialog, [aria-hidden="true"]')) return false;
      const { width, height } = canvas.getBoundingClientRect();
      return width >= 120 && height >= 120 && width / height > .7 && width / height < 1.4;
    }).sort((a, b) => {
      const area = (el) => { const rect = el.getBoundingClientRect(); return rect.width * rect.height; };
      return area(b) - area(a);
    });
    const canvas = wheels[0];
    if (canvas) {
      let anchor = canvas.closest('#wheelContainer, #wheel-container, .wheel-container, .spinning-wheel, [data-wheel-container]') || canvas.parentElement;
      // Do not lift the demo outside the application's main surface.
      if (!anchor || anchor === doc.body || anchor === doc.documentElement || anchor.contains(discover(doc))) anchor = canvas;
      if (anchor.parentElement) return { parent: anchor.parentElement, before: anchor, placement: "wheel" };
    }
    const parent = doc.querySelector("main, [role=main], #app") || doc.body;
    return { parent, before: parent?.firstChild || null, placement: "page" };
  }
  root.WheelDemoReader = Object.freeze({ discover, read, mountPoint });
  if (typeof module !== "undefined" && module.exports) module.exports = root.WheelDemoReader;
})(globalThis);
