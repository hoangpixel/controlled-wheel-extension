/* Reference-contract fixture, not a copy of the live website.
 * Coordinates/lifecycle modeled on static/Wheel.js and Util.getIndexAtPointer
 * in https://github.com/momander/wheel-spinner (Apache-2.0).
 */
class ReferenceWheel {
  constructor(names = ['Hoàng', 'Huy', 'Đạt']) {
    this.angle = 0; this.speed = .005; this.randomStarts = 0;
    this.entries = names.map(text => ({ text }));
    this.wheelConfig = { spinTime: 5 };
    this.state = { tick() {}, click() {}, drawThisFrame: () => true, isSpinning: () => false };
    this.entryPicker = { getDisplayEntries: () => this.entries, getAllEntries: () => this.entries };
    this.nameChangedCallback = () => {}; this.doneSpinningCallback = () => {};
  }
  configure(config) { if (!this.isSpinning()) this.wheelConfig = config; }
  setEntries(entries) { if (!this.isSpinning()) this.entries = entries; }
  refresh() {}
  getIndexAtPointer() { return Math.round(this.angle / (Math.PI * 2 / this.entries.length)) % this.entries.length; }
  getEntryAtPointer() { return this.entries[this.getIndexAtPointer()]; }
  isSpinning() { return this.state.isSpinning(); }
  spinIsDone() { this.doneSpinningCallback(this.getEntryAtPointer()); }
  tick() {
    this.state.tick(this);
    const index = this.getIndexAtPointer();
    if (index !== this.lastIndex) this.nameChangedCallback();
    this.lastIndex = index;
    this.angle += this.speed;
    if (this.angle > Math.PI * 2) this.angle -= Math.PI * 2;
  }
  click(nameChanged, done) {
    this.randomStarts++;
    this.nameChangedCallback = nameChanged; this.doneSpinningCallback = done;
    let ticks = 0;
    this.state = { click() {}, drawThisFrame: () => true, isSpinning: () => true, tick: () => {
      if (++ticks < 3) return;
      this.angle = 0; this.speed = 0;
      this.state = { tick() {}, click() {}, drawThisFrame: () => true, isSpinning: () => false };
      this.spinIsDone();
    } };
  }
}
module.exports = { ReferenceWheel };
