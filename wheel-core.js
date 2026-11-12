/* Shared pure logic. No browser APIs, randomness overrides, or site internals. */
(function (root) {
  "use strict";
  const TAU = Math.PI * 2;
  const POINTER = -Math.PI / 2;
  const normalizeName = (value) => String(value ?? "").normalize("NFC").trim();
  const parseNames = (text) => String(text ?? "").split(/\r?\n/).map(normalizeName).filter(Boolean);
  const wrap = (angle) => ((angle % TAU) + TAU) % TAU;
  const matchKey = value => normalizeName(value).replace(/\s+/gu, " ").toLocaleLowerCase("vi");
  function resolveTarget(names, target) {
    const key = matchKey(target);
    const missing = { index: -1, name: "", kind: "missing", count: 0 };
    if (!key) return { ...missing, kind: "empty", error: "Hãy nhập tên và bấm Save Winner trong popup." };
    // A complete entry takes priority, preserving the first identical entry rule.
    const exact = names.findIndex(name => matchKey(name) === key);
    if (exact >= 0) return { index: exact, name: normalizeName(names[exact]), kind: "exact", count: 1, error: "" };
    const matches = names.map((name, index) => ({ name, index })).filter(item => matchKey(item.name).endsWith(` ${key}`));
    if (matches.length === 1) return { index: matches[0].index, name: normalizeName(matches[0].name), kind: "suffix", count: 1, error: "" };
    if (matches.length > 1) return { ...missing, kind: "ambiguous", count: matches.length,
      error: `Tên “${normalizeName(target)}” khớp ${matches.length} mục nhập. Hãy nhập thêm tên đệm hoặc đầy đủ họ tên để chọn đúng người.` };
    return { ...missing, error: `Không tìm thấy “${normalizeName(target)}” trên vòng quay gốc.` };
  }
  const findTarget = (names, target) => resolveTarget(names, target).index;
  function nativeLandingAngle(count, index, sample) {
    if (!Number.isInteger(count) || count < 1 || !Number.isInteger(index) || index < 0 || index >= count) {
      throw new RangeError("Invalid wheel segment");
    }
    // Omit the sample for read-only validation. Only an actual spin samples RNG.
    let offset = 0;
    if (sample !== undefined) {
      if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new RangeError("Invalid landing sample");
      // Uniform over two bands: [-40%, -10%) and [10%, 40%) of a slice width.
      // Exclude the center and leave at least 10% of a slice before either edge.
      offset = sample < .5 ? -.4 + sample * .6 : .1 + (sample - .5) * .6;
    }
    return wrap((index + offset) * TAU / count);
  }
  function landingAngle(count, index, start = 0) {
    if (!Number.isInteger(count) || count < 1 || !Number.isInteger(index) || index < 0 || index >= count) {
      throw new RangeError("Invalid wheel segment");
    }
    const end = wrap(POINTER - (index + 0.5) * TAU / count);
    return start + 6 * TAU + wrap(end - wrap(start));
  }
  function indexAtPointer(count, angle) {
    if (!Number.isInteger(count) || count < 1) return -1;
    return Math.min(count - 1, Math.floor(wrap(POINTER - angle) / TAU * count));
  }
  function inspect(names, target, angle) {
    const targetIndex = findTarget(names, target);
    const pointerIndex = indexAtPointer(names.length, angle);
    return { target: normalizeName(target), targetIndex, pointerIndex, pointerName: names[pointerIndex] ?? "", angle: wrap(angle), degrees: wrap(angle) * 180 / Math.PI };
  }
  const api = Object.freeze({ TAU, POINTER, normalizeName, parseNames, wrap, resolveTarget, findTarget, nativeLandingAngle, landingAngle, indexAtPointer, inspect });
  root.WheelDemoCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
