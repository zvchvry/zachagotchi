const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const storage = require('../dist/storage.js');

function preview({ data = new Map(), start = Date.now(), failSave = false } = {}) {
  let now = start;
  let timerId = 0;
  const timers = new Map();
  const colors = new Set();
  const counts = { draws: 0, saves: 0 };
  const context = { clearRect() { counts.draws++; }, fillRect() { colors.add(this.fillStyle); } };
  const element = () => ({
    children: [], value:'', textContent: '', attrs: {}, dataset: {}, listeners: {}, hidden: true,
    append(...nodes) { this.children.push(...nodes); }, replaceChildren() { this.children=[]; }, getContext() { return context; },
    style: { setProperty() {} }, classList: { toggle() {}, add() {}, remove() {} }, focus() {},
    getAttribute(key) { return this.attrs[key]; },
    setAttribute(key, value) { this.attrs[key] = String(value); },
    getBoundingClientRect() { return { left:0, top:0, width:96, height:96 }; },
    addEventListener(key, fn) { this.listeners[key] = fn; }
  });
  const elements = Object.fromEntries(['zach','screen','food','love','energy','age','mood','time','speech','effect','pet','game-content','wake-screen','save-warning','edit-avatar','customizer','editor-body','editor-status','editor-cancel','editor-save'].map(id => [id, element()]));
  elements.zach.getContext = () => context;
  const buttons = ['feed','love','play','sleep','coffee'].map(action => Object.assign(element(), { dataset: { action } }));
  const events = {};
  const document = { hidden: false, documentElement: {}, createElement: element, getElementById: id => elements[id], querySelectorAll: () => buttons, addEventListener: (key, fn) => events[key] = fn };
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const scope = vm.createContext({
    Date: Clock, performance: { now: () => now - start },
    document, window: { addEventListener() {} }, ZachStorage: storage,
    localStorage: {
      getItem: key => data.get(key) || null,
      setItem(key, value) { if (failSave) throw Error('Storage unavailable'); counts.saves++; data.set(key, value); }
    },
    getComputedStyle: () => ({ getPropertyValue: key => key === '--lcd-ink' ? '#263829' : '#dce6c0' }),
    setTimeout: (fn, ms) => { timers.set(++timerId, { fn, at: now + ms }); return timerId; },
    clearTimeout: id => timers.delete(id)
  });
  vm.runInContext(fs.readFileSync(require.resolve('../dist/game.js'), 'utf8'), scope);
  for (const file of ['avatar','sound','app','customizer']) vm.runInContext(fs.readFileSync(require.resolve('../dist/'+file+'.js'), 'utf8'), scope);
  vm.runInContext('startGame()',scope);
  function elapse(ms) {
    const end = now + ms;
    for (;;) {
      const next = [...timers].filter(([,t]) => t.at <= end).sort((a,b) => a[1].at - b[1].at)[0];
      if (!next) break;
      timers.delete(next[0]); now = next[1].at; next[1].fn();
    }
    now = end;
  }
  const read = () => JSON.parse(vm.runInContext('JSON.stringify(state)', scope));
  const tap = (detail = 1) => elements['wake-screen'].listeners.click({ detail, clientX: 100, clientY: 100, preventDefault() {}, stopPropagation() {} });
  return { counts, colors, buttons, scope, document, events, elements, data, elapse, read, tap, now: () => now };
}

test('awake and asleep sprites only draw the shared two-color palette', () => {
  const p = preview();
  p.buttons[3].listeners.click();
  assert.deepEqual([...p.colors].sort(), ['#263829', '#dce6c0']);
  assert.equal(p.counts.draws, 2);
  assert.equal(p.buttons[0].disabled, true);
  p.buttons[3].listeners.click();
  assert.equal(p.buttons[0].disabled, false);
});

test('birth saves immediately; idle ticks neither redraw nor write storage', () => {
  const p = preview();
  vm.runInContext('tick(); tick();', p.scope);
  assert.deepEqual(p.counts, { draws: 1, saves: 1 });
  p.buttons[0].listeners.click();
  assert.deepEqual(p.counts, { draws: 1, saves: 2 });
});

test('inactivity blanks at one minute; double-tap wakes without changing pet sleep state', () => {
  const p = preview();
  p.elapse(59999);
  assert.equal(p.elements['wake-screen'].hidden, true);
  p.elapse(1);
  assert.equal(p.elements['wake-screen'].hidden, false);
  assert.equal(p.elements['game-content'].inert, true);
  assert.equal(p.read().sleeping, false);
  p.tap();
  assert.equal(p.elements['wake-screen'].hidden, false);
  p.elapse(150); p.tap();
  assert.equal(p.elements['wake-screen'].hidden, true);
  assert.equal(p.elements['game-content'].inert, false);
  assert.ok(Math.abs(p.read().love - (90 - (60150 / 3600000 * 2))) < 1e-9);
});

test('interaction extends idle timer; slow taps cannot wake', () => {
  const p = preview();
  p.elapse(50000); p.elements.screen.listeners.pointerdown();
  p.elapse(50000);
  assert.equal(p.elements['wake-screen'].hidden, true);
  p.elapse(10000); p.tap(); p.elapse(500); p.tap();
  assert.equal(p.elements['wake-screen'].hidden, false);
  p.elapse(100); p.tap();
  assert.equal(p.elements['wake-screen'].hidden, true);
});

test('screen-off time catches up clock and needs without waking a sleeping Zach', () => {
  const p = preview();
  p.buttons[3].listeners.click();
  p.elements.time.listeners.click();
  const before = p.counts.draws;
  p.elapse(2 * 3600000);
  assert.equal(p.counts.draws, before);
  p.tap(0); // Accessible keyboard wake.
  assert.equal(p.read().sleeping, true);
  assert.equal(p.read().energy, 100);
  assert.equal(p.read().food, 74);
  assert.equal(p.elements.time.textContent, new Date(p.now()).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', hour12:false }));
});

test('abrupt restart restores birth, actions, pet sleep and elapsed time without pagehide', () => {
  const p = preview();
  p.buttons[2].listeners.click();
  p.buttons[3].listeners.click();
  const saved = p.read();
  const restarted = preview({ data:p.data, start:p.now()+3600000 });
  const restored = restarted.read();
  assert.equal(restored.born, saved.born);
  assert.equal(restored.plays, 1);
  assert.equal(restored.sleeping, true);
  assert.equal(restored.energy, saved.energy + 18);
  assert.equal(restored.food, saved.food - 3);
});

test('failed saves display a warning and prevent automatic blanking', () => {
  const p = preview({ failSave:true });
  assert.equal(p.elements['save-warning'].hidden, false);
  p.elapse(60000);
  assert.equal(p.elements['wake-screen'].hidden, true);
});

test('customization saves appearance and sound independently of care progress',()=>{
 const p=preview();const before=p.read();
 p.elements['edit-avatar'].listeners.click();
 vm.runInContext("draft.name='alex';draft.hair=3;draft.beard=1;draft.head=2;draft.shirt=2;draft.pants=3;draft.sound=false",p.scope);
 p.elements['editor-save'].listeners.click();
 assert.deepEqual(p.read(),before);
 assert.equal(p.elements['edit-avatar'].textContent,'alex [edit]');
 const restored=preview({data:p.data});
 assert.equal(vm.runInContext('profile.hair',restored.scope),3);
 assert.equal(vm.runInContext('profile.sound',restored.scope),false);
 assert.equal(restored.read().born,before.born);
});
test('tapping the top of the head toggles a saved hat; body taps stay love',()=>{
 const p=preview();
 p.elements.pet.listeners.click({clientX:48,clientY:24});
 assert.equal(vm.runInContext('profile.hat',p.scope),true);
 assert.equal(p.read().love,90);
 const restored=preview({data:p.data});assert.equal(vm.runInContext('profile.hat',restored.scope),true);
 p.elements.pet.listeners.click({clientX:48,clientY:72});
 assert.ok(p.read().love>90);
});
test('coffee button restores energy and survives normal action flow',()=>{
 const p=preview();p.buttons[4].listeners.click();assert.equal(p.read().energy,95);assert.match(p.elements.speech.textContent,/coffee/i);
});
test('cancel discards the draft; invalid names and failed writes stay in the editor',()=>{
 const p=preview();p.elements['edit-avatar'].listeners.click();
 vm.runInContext("draft.name='new';draft.hair=4",p.scope);p.elements['editor-cancel'].listeners.click();
 assert.equal(vm.runInContext('profile.name',p.scope),'zach');
 p.elements['edit-avatar'].listeners.click();vm.runInContext("draft.name='   '",p.scope);p.elements['editor-save'].listeners.click();
 assert.equal(p.elements.customizer.hidden,false);assert.match(p.elements['editor-status'].textContent,/name/);
 const f=preview({failSave:true});f.elements['edit-avatar'].listeners.click();f.elements['editor-save'].listeners.click();
 assert.equal(f.elements.customizer.hidden,false);assert.match(f.elements['editor-status'].textContent,/Could not save/);
});
test('editor prevents care actions and screen timeout without pausing elapsed care',()=>{
 const p=preview();p.elements['edit-avatar'].listeners.click();const before=p.read();
 p.buttons[2].listeners.click();assert.equal(p.read().plays,before.plays);
 p.elapse(120000);assert.equal(p.elements['wake-screen'].hidden,true);
 assert.ok(p.read().food<before.food);p.elements['editor-cancel'].listeners.click();
 p.elapse(60000);assert.equal(p.elements['wake-screen'].hidden,false);
});
