const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  constructor(tag = 'DIV') {
    this.tagName = tag; this.value = ''; this.textContent = ''; this.innerText = '';
    this.id = ''; this.className = ''; this.dataset = {}; this.attrs = {};
    this.handlers = {}; this.isConnected = true; this.open = false;
    this.style = { setProperty() {} };
  }
  getAttribute(name) { return this.attrs[name] ?? null; }
  setAttribute(name, value) { this.attrs[name] = value; }
  getClientRects() { return this.hidden ? [] : [{}]; }
  closest(selector) {
    if (selector.includes('dialog')) return this.inDialog ? {} : null;
    return this.tagName === 'TEXTAREA' ? null : this;
  }
  addEventListener(type, handler) { (this.handlers[type] ||= []).push(handler); }
  removeEventListener() {}
  async fire(type) { for (const handler of this.handlers[type] || []) await handler({ preventDefault() {} }); }
  append(child) { child.parent = this; }
  contains(child) { return child === this; }
  remove() { this.isConnected = false; }
  focus() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
  getContext() { return new Proxy({}, { get: (_, prop) => prop === 'measureText' ? () => ({ width: 10 }) : () => {}, set: () => true }); }
  attachShadow() {
    const nodes = new Map();
    this.shadowRoot = { set innerHTML(_value) {}, querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, new Element(selector === 'canvas' ? 'CANVAS' : 'DIV'));
      return nodes.get(selector);
    } };
    return this.shadowRoot;
  }
}

function environment(stored = {}, names = 'Hoàng\nHuy\nĐạt') {
  const editor = new Element('TEXTAREA'); editor.id = 'entries'; editor.value = names;
  const elements = new Map();
  const roots = [];
  const docHandlers = {};
  const doc = {
    hidden: false, activeElement: new Element(),
    documentElement: { append(el) { roots.push(el); } }, body: {},
    createElement(tag) { return new Element(tag.toUpperCase()); },
    querySelectorAll() { return [editor]; },
    getElementById(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); },
    addEventListener(name, fn) { docHandlers[name] = fn; },
    removeEventListener(name) { delete docHandlers[name]; }
  };
  const storage = structuredClone(stored);
  const listeners = [];
  let receiver;
  const raf = new Map(); let frameId = 0;
  const intervals = new Map(); let intervalId = 0;
  const chrome = {
    storage: {
      local: {
        async get(keys) { return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(k => [k, storage[k]])); },
        async set(patch) {
          const changes = {};
          for (const [key, value] of Object.entries(patch)) {
            const oldValue = storage[key]; storage[key] = structuredClone(value);
            changes[key] = { oldValue, newValue: storage[key] };
          }
          for (const fn of listeners) fn(changes, 'local');
        }
      },
      onChanged: { addListener(fn) { listeners.push(fn); } }
    },
    runtime: { onMessage: { addListener(fn) { receiver = fn; } } },
    tabs: { async query() { return [{ id: 1 }]; }, async sendMessage(_id, msg) { return request(msg.type); } }
  };
  const context = vm.createContext({
    console, document: doc, chrome, setTimeout, clearTimeout,
    setInterval(fn) { intervals.set(++intervalId, fn); return intervalId; },
    clearInterval(id) { intervals.delete(id); },
    requestAnimationFrame(fn) { raf.set(++frameId, fn); return frameId; },
    cancelAnimationFrame(id) { raf.delete(id); },
    MutationObserver: class { observe() {} disconnect() {} },
    matchMedia: () => ({ matches: false }),
    window: { addEventListener() {}, close() {} }
  });
  function load(file) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file }); }
  function request(type) { return new Promise(resolve => receiver({ type }, {}, resolve)); }
  async function flush() { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); }
  function advance(time) {
    const callbacks = [...raf.values()]; raf.clear(); callbacks.forEach(fn => fn(time));
  }
  return { load, request, flush, advance, chrome, storage, doc, editor, roots, elements, raf, intervals, docHandlers,
    get ui() { return roots.at(-1)?.shadowRoot; } };
}
module.exports = { Element, environment };
