const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
let documentSequence = 0;

class Element {
  constructor(tag = 'DIV') {
    this.tagName = tag; this.value = ''; this.textContent = ''; this.innerText = '';
    this.id = ''; this.className = ''; this.dataset = {}; this.attrs = {};
    this.handlers = {}; this.isConnected = true; this.open = false;
    this.children = []; this.parentElement = null;
    this.styleValues = {};
    this.style = { setProperty: (key, value) => { this.styleValues[key] = value; } };
  }
  getAttribute(name) { return this.attrs[name] ?? null; }
  setAttribute(name, value) { this.attrs[name] = value; }
  getClientRects() { return this.hidden ? [] : [{}]; }
  closest(selector) {
    if (selector.includes('dialog')) return this.inDialog ? {} : null;
    if (selector.includes('contenteditable')) return this.attrs.contenteditable === 'true' ? this : this.parentElement?.closest(selector) || null;
    if (selector.includes('wheel-container')) return this.id === 'wheel-container' ? this : this.parentElement?.closest(selector) || null;
    return null;
  }
  addEventListener(type, handler) { (this.handlers[type] ||= []).push(handler); }
  removeEventListener() {}
  async fire(type) { for (const handler of this.handlers[type] || []) await handler({ preventDefault() {} }); }
  append(child) { this.insertBefore(child, null); }
  insertBefore(child, before) {
    if (child === before) return child;
    if (child.parentElement) child.parentElement.children.splice(child.parentElement.children.indexOf(child), 1);
    const index = before ? this.children.indexOf(before) : this.children.length;
    if (index < 0) throw new Error('Reference node is not a child');
    this.children.splice(index, 0, child); child.parentElement = this; child.isConnected = true;
    child.onInsert?.(); return child;
  }
  get firstChild() { return this.children[0] || null; }
  get nextSibling() { return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1] || null; }
  contains(child) { return child === this || this.children.some(el => el.contains(child)); }
  remove() {
    if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
    this.parentElement = null; this.isConnected = false;
  }
  getBoundingClientRect() { return { width: this.tagName === 'CANVAS' ? 500 : 0, height: this.tagName === 'CANVAS' ? 500 : 0 }; }
  get clientWidth() { return this.getBoundingClientRect().width; }
  get clientHeight() { return this.getBoundingClientRect().height; }
  scrollIntoView() { this.scrolled = true; }
  focus() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
  getContext() { return new Proxy({ canvas: this, frames: [] }, { get: (target, prop) => prop in target ? target[prop] : prop === 'measureText' ? () => ({ width: 10 }) : () => {}, set: (target, prop, value) => { target[prop] = value; return true; } }); }
  attachShadow() {
    const nodes = new Map();
    this.shadowRoot = { markup: '', set innerHTML(value) { this.markup = value; }, querySelector(selector) {
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
  const body = new Element('BODY'), main = new Element('MAIN'), documentElement = new Element('HTML');
  const wheelContainer = new Element(), nativeCanvas = new Element('CANVAS'), nativeSpin = new Element('BUTTON');
  wheelContainer.id = 'wheel-container';
  documentElement.append(body); body.append(main); main.append(wheelContainer); main.append(editor);
  wheelContainer.append(nativeCanvas); wheelContainer.append(nativeSpin);
  const doc = {
    hidden: false, activeElement: new Element(),
    documentElement, body,
    createElement(tag) { const el = new Element(tag.toUpperCase()); el.onInsert = () => { if (el.id === 'fixed-winner-demo-host' && !roots.includes(el)) roots.push(el); }; return el; },
    querySelectorAll(selector) { return selector === 'canvas' ? (nativeCanvas.isConnected ? [nativeCanvas] : []) : [editor]; },
    querySelector() { return main.isConnected ? main : null; },
    getElementById(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); },
    addEventListener(name, fn) { docHandlers[name] = fn; },
    removeEventListener(name) { delete docHandlers[name]; }
  };
  const storage = structuredClone(stored);
  const listeners = [];
  let receiver, sessionReceiver;
  const documentId = 'test-document-' + ++documentSequence;
  const raf = new Map(); let frameId = 0;
  const intervals = new Map(); let intervalId = 0;
  let now = 0;
  const resourceEntries = [];
  const windowHandlers = {};
  const location = { origin: 'https://wheelofnames.com' };
  const browserWindow = {
    addEventListener(type, fn) { (windowHandlers[type] ||= []).push(fn); },
    postMessage(data) { const payload = structuredClone(data); setImmediate(() => { for (const fn of windowHandlers.message || []) fn({ source: browserWindow, origin: location.origin, data: payload }); }); },
    close() {}
  };
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
    runtime: { onMessage: { addListener(fn) { receiver = fn; } },
      async sendMessage(message) {
        return new Promise(resolve => sessionReceiver(message, message.type === 'FWD_SESSION_UPDATE' ? {} : {
          tab: { id: 1, url: 'https://wheelofnames.com/' }, url: 'https://wheelofnames.com/', frameId: 0, documentId
        }, resolve));
      } },
    tabs: { async query() { return [{ id: 1 }]; }, async sendMessage(_id, msg) { return request(msg); } }
  };
  const workerChrome = { storage: chrome.storage, runtime: { onMessage: { addListener(fn) { sessionReceiver = fn; } } },
    tabs: { async sendMessage(tabId, msg, options) {
      if (tabId !== 1 || options.documentId !== documentId) throw new Error('Document no longer exists');
      return request(msg);
    } } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'session-worker.js'), 'utf8'), { chrome: workerChrome, crypto: webcrypto, URL });
  const shared = {
    console, document: doc, chrome, setTimeout, clearTimeout, queueMicrotask, URL,
    setInterval(fn) { intervals.set(++intervalId, fn); return intervalId; },
    clearInterval(id) { intervals.delete(id); },
    requestAnimationFrame(fn) { raf.set(++frameId, fn); return frameId; },
    cancelAnimationFrame(id) { raf.delete(id); },
    MutationObserver: class { observe() {} disconnect() {} },
    matchMedia: () => ({ matches: false }),
    window: browserWindow, location, performance: { now: () => now, getEntriesByType: () => resourceEntries }
  };
  const context = vm.createContext(shared);
  const pageContext = vm.createContext({ ...shared, chrome: undefined });
  function load(file, world = 'isolated') { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), world === 'page' ? pageContext : context, { filename: file }); }
  function mockModuleLoader(loader) {
    pageContext.__moduleLoaderForTests = loader;
    vm.runInContext('var originalModuleAPI = FixedWinnerModuleLink; globalThis.FixedWinnerModuleLink = { create(options) { return originalModuleAPI.create({ ...options, loadModule: __moduleLoaderForTests }); } };', pageContext);
  }
  function request(message) { return new Promise(resolve => receiver(typeof message === 'string' ? { type: message } : message, {}, resolve)); }
  async function flush() { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); }
  function advance(time) {
    now = time;
    const callbacks = [...raf.values()]; raf.clear(); callbacks.forEach(fn => fn(time));
  }
  return { load, request, flush, advance, mockModuleLoader, resourceEntries, chrome, storage, doc, editor, roots, elements, raf, intervals, docHandlers, main, wheelContainer, nativeCanvas, nativeSpin, windowHandlers,
    get ui() { return roots.at(-1)?.shadowRoot; } };
}
module.exports = { Element, environment };
