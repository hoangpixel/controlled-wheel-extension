/* Shared pure logic. No browser APIs, randomness overrides, or site internals. */
(function (root) {
  "use strict";
  const TAU = Math.PI * 2;
  const POINTER = -Math.PI / 2;
  const normalizeName = (value) => String(value ?? "").normalize("NFC").trim();
  const parseNames = (text) => String(text ?? "").split(/\r?\n/).map(normalizeName).filter(Boolean);
  const wrap = (angle) => ((angle % TAU) + TAU) % TAU;
  const findTarget = (names, target) => names.findIndex((name) => normalizeName(name) === normalizeName(target));
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
  const api = Object.freeze({ TAU, POINTER, normalizeName, parseNames, wrap, findTarget, landingAngle, indexAtPointer, inspect });
  root.WheelDemoCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
