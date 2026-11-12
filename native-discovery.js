/* Structural discovery only. VNodes and component instances have separate budgets. */
(function (root) {
  "use strict";
  function find(doc, adapter) {
    const canvases = [...doc.querySelectorAll("canvas")].filter(el => el.getClientRects().length)
      .sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight);
    const report = { visibleCanvasCount: canvases.length, vue2Nodes: 0, vue3Nodes: 0,
      componentCount: 0, vnodeCount: 0, scanTruncated: false, rootSources: [], stateKeys: [], componentSummaries: [], candidates: [] };
    const sources = new Set();
    const object = value => value && typeof value === "object";
    const element = value => value?.nodeType === 1 || typeof value?.tagName === "string";
    const inBranch = (value, canvas) => !element(value) || value === canvas || value.contains(canvas);
    function candidateSummary(value, key) {
      if (report.candidates.length >= 12 || !/wheel|engine/i.test(key) && !("angle" in value)) return;
      const methods = ["click", "tick", "setEntries", "configure", "getIndexAtPointer", "getEntryAtPointer", "isSpinning", "spinIsDone", "refresh"];
      report.candidates.push({ key, methods: methods.filter(name => typeof value[name] === "function"), fields: Object.keys(value).slice(0, 25) });
    }
    for (const canvas of canvases) {
      const queue = [], seenComponents = new Set(), seenVNodes = new Set();
      function seed(kind, value, source) {
        if (!object(value)) return;
        sources.add(source); queue.push({ kind, value });
      }
      for (let el = canvas; el; el = el.parentElement) {
        if (el.__vue__) { report.vue2Nodes++; seed("component", el.__vue__, "__vue__"); }
        if (el.__vueParentComponent) { report.vue3Nodes++; seed("component", el.__vueParentComponent, "__vueParentComponent"); }
        if (el.__vue_app__?._instance) { report.vue3Nodes++; seed("component", el.__vue_app__._instance, "__vue_app__._instance"); }
        if (el._vnode) { report.vue3Nodes++; seed("vnode", el._vnode, "_vnode"); }
        if (el.__vnode) { report.vue3Nodes++; seed("vnode", el.__vnode, "__vnode"); }
      }
      while (queue.length) {
        const { kind, value } = queue.shift();
        if (!object(value)) continue;
        if (kind === "vnode") {
          if (seenVNodes.has(value) || !inBranch(value.el, canvas)) continue;
          if (seenVNodes.size >= 4096) { report.scanTruncated = true; continue; }
          seenVNodes.add(value); report.vnodeCount++;
          if (value.component) queue.unshift({ kind: "component", value: value.component });
          else if (value.componentInstance) queue.unshift({ kind: "component", value: value.componentInstance });
          if (Array.isArray(value.children)) {
            for (const child of value.children) if (object(child) && inBranch(child.el, canvas)) queue.push({ kind: "vnode", value: child });
          }
          if (value.suspense?.activeBranch) queue.unshift({ kind: "vnode", value: value.suspense.activeBranch });
          continue;
        }
        if (seenComponents.has(value)) continue;
        const instance = value.proxy || value;
        if (!inBranch(instance.$el || value.vnode?.el, canvas)) continue;
        if (seenComponents.size >= 256) { report.scanTruncated = true; continue; }
        seenComponents.add(value); report.componentCount++;
        const dataViews = [...new Set([instance.$data, instance._data, value.data, value.setupState, value.exposed, value.ctx].filter(object))];
        if (report.componentSummaries.length < 16) {
          report.componentSummaries.push({ name: value.type?.name || value.type?.__name || instance.$options?.name || "anonymous",
            dataKeys: Object.keys(value.data || instance.$data || {}).slice(0, 40),
            setupKeys: Object.keys(value.setupState || {}).slice(0, 40),
            contextKeys: Object.keys(value.ctx || {}).filter(key => key !== "_").slice(0, 40),
            hasSetupFunction: typeof value.type?.setup === "function" });
        }
        const values = [];
        for (const view of [instance, value, ...dataViews]) {
          for (const key of ["myWheel", "wheel"]) values.push({ key, value: view[key], depth: 0 });
        }
        for (const view of dataViews) {
          const keys = Object.keys(view).filter(key => key !== "_" && !key.startsWith("$") && !key.startsWith("__")).slice(0, 80);
          if (keys.length && report.stateKeys.length < 12) report.stateKeys.push(keys);
          for (const key of keys) values.push({ key, value: view[key], depth: 0 });
        }
        const visited = new Set();
        while (values.length && visited.size < 200) {
          const item = values.shift();
          const candidate = item.value?.__v_isRef ? item.value.value : item.value;
          if (!object(candidate) || visited.has(candidate) || candidate.nodeType || Array.isArray(candidate)) continue;
          visited.add(candidate);
          candidateSummary(candidate, item.key);
          if (adapter.compatible(candidate)) {
            report.rootSources = [...sources];
            report.reason = "compatible_engine_found";
            return { binding: { canvas, wheel: candidate, instance }, report };
          }
          if (item.depth < 2) {
            for (const key of Object.keys(candidate).filter(key => key !== "_" && !key.startsWith("$") && !key.startsWith("__")).slice(0, 40)) {
              const descriptor = Object.getOwnPropertyDescriptor(candidate, key);
              if (descriptor && "value" in descriptor) values.push({ key: `${item.key}.${key}`, value: descriptor.value, depth: item.depth + 1 });
            }
          }
        }
        for (const child of instance.$children || []) queue.unshift({ kind: "component", value: child });
        if (value.subTree) queue.unshift({ kind: "vnode", value: value.subTree });
        if (instance._vnode) queue.unshift({ kind: "vnode", value: instance._vnode });
      }
    }
    report.rootSources = [...sources];
    report.reason = !canvases.length ? "no_visible_canvas" : report.scanTruncated ? "scan_limit_reached" : !report.componentCount ? "no_accessible_component" : !report.candidates.length ? "no_engine_in_accessible_state" : "engine_contract_mismatch";
    return { binding: null, report };
  }
  root.FixedWinnerDiscovery = Object.freeze({ find });
  if (typeof module !== "undefined" && module.exports) module.exports = root.FixedWinnerDiscovery;
})(globalThis);
