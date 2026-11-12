// Extracted, unchanged physics and engine class from the user-supplied dist-v4402.js.
// Browser renderer and imported utility functions are replaced below for Node tests only.
// Original attachment SHA-256: 528be247194e01da5cf0cdd40323cb5652b8756584bc505772341b91cb559934
const Core = require('../wheel-core.js');
const h = (object, key, value) => Object.defineProperty(object, key, { value, enumerable: true, configurable: true, writable: true });
const i = (entries, angle) => entries.length ? Math.round(Core.wrap(angle) / (Core.TAU / entries.length)) % entries.length : 0;
const a = (...operations) => value => operations.reduce((current, operation) => operation(current), value);
const r = entries => entries.forEach((entry, index) => { entry.id ||= String(index); });
const f = () => ({ entries: [], type: 'color', spinTime: 5, slowSpin: false, maxNames: 1000, allowDuplicates: true });
const m = () => '#BBBBBB';
class de { refresh() {} draw(context, angle, visibleEntries) { context.frames?.push({ angle, entries: visibleEntries }); } }
var g = .005
  , _ = 15e-5
  , v = .001
  , y = .6
  , b = 3;
function x() {
    return {
        angle: 0,
        speed: g,
        allEntries: [],
        maxSlices: 1e3,
        visibleEntries: [],
        indexAtPointer: 0,
        prevIndexAtPointer: -1,
        entryAtPointer: {},
        phase: `InitialDemoPhase`,
        ticksInPhase: 0,
        fps: 60,
        spinTime: 10,
        slowSpin: !1,
        visibleEntriesChanged: !1
    }
}
function te(e, t, n, r) {
    return {
        ...e,
        fps: t,
        spinTime: n,
        slowSpin: r
    }
}
function ne(e, t, n, r) {
    let i = r ? t : z(t)
      , o = JSON.parse(JSON.stringify(i))
      , s = o.slice(0, n)
      , c = {
        ...e,
        maxSlices: n,
        allEntries: o,
        visibleEntries: s
    };
    return a(A, j)(c)
}
function re(e) {
    return [`AcceleratingPhase`, `DeceleratingPhase`].includes(e.phase)
}
function S(e) {
    return {
        ...e,
        visibleEntriesChanged: !1
    }
}
function C(e, t) {
    let n = {
        ...t,
        prevIndexAtPointer: t.indexAtPointer
    };
    return a(S, ie, D(e), A, M, j, k)(n)
}
function w(e) {
    return E[e.phase].onClick(e)
}
function T(e) {
    return {
        ...e,
        angle: 0
    }
}
var E = {
    InitialDemoPhase: {
        onTick: e => ({
            ...e,
            speed: g
        }),
        onClick: e => O(`AcceleratingPhase`)(e)
    },
    AcceleratingPhase: {
        onTick: (e, t) => {
            if (e.ticksInPhase > F(e.fps, e.spinTime)) {
                let n = O(`DeceleratingPhase`)(e)
                  , r = I(e.fps, e.slowSpin) * e.ticksInPhase
                  , i = {
                    ...n,
                    angle: t() * 2 * Math.PI,
                    speed: r
                };
                return P(t)(i)
            }
            let n = e.speed + I(e.fps, e.slowSpin);
            return {
                ...e,
                speed: n
            }
        }
        ,
        onClick: e => e
    },
    DeceleratingPhase: {
        onTick: e => {
            if (e.ticksInPhase > L(e.fps, e.spinTime))
                return O(`StoppedPhase`)(e);
            let t = R(e.fps, e.spinTime, e.slowSpin);
            return {
                ...e,
                speed: e.speed * t
            }
        }
        ,
        onClick: e => e
    },
    StoppedPhase: {
        onTick: e => ({
            ...e,
            speed: 0
        }),
        onClick: e => O(`AcceleratingPhase`)(e)
    }
};
function D(e) {
    return t => E[t.phase].onTick(t, e)
}
function O(e) {
    return t => ({
        ...t,
        phase: e,
        ticksInPhase: 0
    })
}
function ie(e) {
    let t = (e.angle + e.speed) % (2 * Math.PI);
    return {
        ...e,
        angle: t
    }
}
function k(e) {
    return {
        ...e,
        ticksInPhase: e.ticksInPhase + 1
    }
}
function A(e) {
    return {
        ...e,
        indexAtPointer: i(e.visibleEntries, e.angle)
    }
}
function j(e) {
    return {
        ...e,
        entryAtPointer: B(e.visibleEntries, e.angle)
    }
}
function M(e) {
    if (e.allEntries.length <= e.maxSlices)
        return e.visibleEntries.length === e.allEntries.length ? e : {
            ...e,
            visibleEntries: e.allEntries,
            visibleEntriesChanged: !0
        };
    if (e.indexAtPointer === e.prevIndexAtPointer || e.prevIndexAtPointer === -1)
        return e;
    let t = e.visibleEntries
      , n = t.length
      , r = (e.indexAtPointer - e.prevIndexAtPointer + n) % n;
    if (r === 0)
        return e;
    let i = e.prevIndexAtPointer;
    for (let a = 0; a < r; a++)
        i = (i + 1) % n,
        t = N(e, t, i);
    return {
        ...e,
        visibleEntries: t,
        visibleEntriesChanged: !0
    }
}
function N(e, t, n) {
    let r = [...t]
      , i = Math.floor(n + e.maxSlices / 2) % e.maxSlices
      , a = V(r, i - 1)
      , o = H(e.allEntries, a);
    return o === -1 ? (console.error(`Could not find entry in allEntries`, a),
    r) : (r[i] = V(e.allEntries, o + 1),
    r)
}
function P(e) {
    return t => {
        if (t.allEntries.length <= t.maxSlices)
            return t;
        let n = Math.floor(e() * t.allEntries.length)
          , r = [...t.allEntries, ...t.allEntries].slice(n, n + t.maxSlices);
        return {
            ...t,
            visibleEntries: r
        }
    }
}
function F(e, t) {
    return Math.min(e, t * e / b)
}
function I(e, t) {
    return t ? v : y / e
}
function L(e, t) {
    return t * e - F(e, t)
}
function R(e, t, n) {
    let r = g + (F(e, t) + 1) * I(e, n)
      , i = L(e, t);
    return Math.exp(Math.log(_ / r) / i)
}
function z(e) {
    let t = new Set;
    return e.filter( ({text: e, image: n}) => {
        let r = (e || ``) + `||` + (n || ``);
        return !t.has(r) && (t.add(r),
        !0)
    }
    )
}
function B(e, t) {
    return e.length === 0 ? {} : e[i(e, t)]
}
function V(e, t) {
    return e[(t % e.length + e.length) % e.length]
}
function H(e, t) {
    return t.id ? e.findIndex( ({id: e}) => e === t.id) : -1
}
var pe = 60
  , me = 80
  , he = class {
    constructor(e= () => {}
    , t= () => {}
    ) {
        h(this, `wheelConfig`, f()),
        h(this, `wheelState`, x()),
        h(this, `wheelPainter`, void 0),
        h(this, `nameChangedCallback`, void 0),
        h(this, `doneSpinningCallback`, void 0),
        this.nameChangedCallback = e,
        this.doneSpinningCallback = t
    }
    refresh() {
        this.wheelPainter?.refresh()
    }
    configure(e, t=pe) {
        if (!this.isSpinning()) {
            r(e.entries),
            this.wheelConfig = e;
            let n = e.entries.filter( ({enabled: e}) => e !== !1);
            this.wheelState = ne(this.wheelState, n, e.maxNames, e.allowDuplicates),
            this.wheelState = te(this.wheelState, t, this.wheelConfig.spinTime, this.wheelConfig.slowSpin),
            this.refresh()
        }
    }
    isSpinning() {
        return re(this.wheelState)
    }
    tick(e) {
        let t = this.wheelState
          , n = C(e, t);
        n.phase === `StoppedPhase` && t.phase !== `StoppedPhase` && this.doneSpinningCallback(this.getEntryAtAngle(n.angle)),
        n.indexAtPointer !== t.indexAtPointer && this.nameChangedCallback(),
        n.visibleEntriesChanged && this.refresh(),
        this.wheelState = n
    }
    click() {
        this.getDisplayEntries().length > 0 && (this.wheelState = w(this.wheelState))
    }
    resetRotation() {
        this.wheelState = T(this.wheelState)
    }
    getIndexAtPointer(e) {
        return i(this.wheelState.visibleEntries, e)
    }
    getEntryAtAngle(e) {
        return this.wheelState.visibleEntries[this.getIndexAtPointer(e)]
    }
    getEntryAtPointer() {
        return this.wheelState.entryAtPointer
    }
    getDisplayEntries() {
        return this.wheelState.visibleEntries
    }
    getPointerColor() {
        let e = this.wheelConfig
          , t = this.wheelState;
        if (e.pointerChangesColor && e.type === `color` && t.visibleEntries.length <= me) {
            let n = t.entryAtPointer;
            if (n && Object.keys(n).length > 0 && !n.image) {
                let r = t.indexAtPointer;
                return n.color || m(e, r)
            }
        }
        return `#BBBBBB`
    }
    draw(e, t) {
        this.wheelPainter ||= new de,
        this.wheelPainter.draw(e, this.wheelState.angle, this.wheelState.visibleEntries, this.wheelState.allEntries, this.wheelConfig, t, this.getPointerColor())
    }
}
;

module.exports = { Wheel440: he };
