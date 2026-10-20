'use strict';

const IDLE_MS = 60000;
const DOUBLE_TAP_MS = 400;
const saves = ZachStorage.create(() => localStorage);
const $ = id => document.getElementById(id);
const ui = Object.fromEntries(['zach', 'screen', 'food', 'love', 'energy', 'age', 'mood', 'time', 'speech', 'effect', 'pet', 'game-content', 'wake-screen', 'save-warning'].map(id => [id, $(id)]));
const buttons = [...document.querySelectorAll('[data-action]')];
const sleepButton = buttons.find(button => button.dataset.action === 'sleep');
const ctx = ui.zach.getContext('2d');
const palette = getComputedStyle(document.documentElement);
const ink = palette.getPropertyValue('--lcd-ink').trim();
const paper = palette.getPropertyValue('--lcd-paper').trim();
let state = ZachGame.advance(saves.load() || ZachGame.initial(), Date.now());
let displayAsleep = false;
let idleTimer;
let idleDeadline = performance.now() + IDLE_MS;
let firstTap = null;
let drawnSleeping;
let effectTimer;
let tickTimer;

// 32 × 32 source pixels, displayed at exactly 3×. No shaded or colored pixels.
function draw() {
  if (drawnSleeping === state.sleeping) return;
  drawnSleeping = state.sleeping;
  ZachAvatar.draw(ctx, profile, state.sleeping, ink, paper);
}

function text(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

function render() {
  text($('edit-avatar'), profile.name+' [edit]');
  ui.pet.setAttribute('aria-label','Pet '+profile.name);
  ui.pet.setAttribute('title', profile.hat ? 'Tap the top of the head to remove the hat' : 'Tap the top of the head to add a hat');
  for (const key of ['food', 'love', 'energy']) {
    const value = Math.round(state[key]);
    if (ui[key].getAttribute('aria-valuenow') !== String(value)) {
      ui[key].style.setProperty('--value', value + '%');
      ui[key].setAttribute('aria-valuenow', value);
    }
  }
  text(ui.age, 'DAY ' + (Math.floor(Math.max(0, Date.now() - state.born) / 86400000) + 1) + ' ♡');
  ui.screen.classList.toggle('sleeping', state.sleeping);
  text(ui.mood, state.sleeping ? '☾ dreaming of you' : state.food < 35 ? '♥ a little hungry' : state.energy < 30 ? '♥ ready for a nap' : '♥ feeling loved');
  text(ui.time, new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
  if (drawnSleeping !== state.sleeping) {
    sleepButton.innerHTML = state.sleeping ? '<span>☀︎</span>WAKE' : '<span>☾</span>SLEEP';
    for (const button of buttons) if (button !== sleepButton) button.disabled = state.sleeping;
  }
  draw();
}

function save() {
  const saved = saves.save(state);
  ui['save-warning'].hidden = saved;
  return saved;
}

const messages = {
  feed: ['a snack? you know me so well!', 'full tummy, happy me ♡'],
  love: ['you’re my favorite person ♡', 'more head pats, please ♡', 'little guy. BIG love for you.'],
  play: ['you caught my heart! ♡', 'best playdate ever!'],
  coffee: ['a tiny coffee for a tiny guy ☕', 'warm coffee, warm heart ♡']
};
function action(type) {
  if (displayAsleep || editing) return;
  resetIdle();
  if (state.sleeping && type !== 'sleep') {
    text(ui.speech, 'shh… dreaming of you ♡');
    return;
  }
  state = ZachGame.act(state, type);
  sound.play(type==='sleep'?(state.sleeping?'sleep':'wake'):type,profile.sound);
  const choices = type === 'sleep'
    ? [state.sleeping ? 'goodnight, my favorite person ♡' : 'hey you. missed your face ♡']
    : messages[type];
  text(ui.speech, choices[Math.floor(Math.random() * choices.length)]);
  text(ui.effect, type === 'feed' ? '▦' : type === 'coffee' ? '☕' : type === 'sleep' ? (state.sleeping ? 'z z' : '☀︎') : '♥');
  clearTimeout(effectTimer);
  effectTimer = setTimeout(() => text(ui.effect, ''), 1800);
  render();
  save();
}

// Reconstruct elapsed care time on wake; no rendering or polling while the screen is off.
function tick() {
  clearTimeout(tickTimer);
  if (document.hidden || displayAsleep) return;
  state = ZachGame.advance(state, Date.now());
  render();
  tickTimer = setTimeout(tick, 60000 - Date.now() % 60000);
}
function resetIdle() {
  if (displayAsleep) return;
  clearTimeout(idleTimer);
  idleDeadline = performance.now() + IDLE_MS;
  idleTimer = setTimeout(sleepDisplay, IDLE_MS);
}
function sleepDisplay() {
  if (displayAsleep) return;
  if (editing) { resetIdle(); return; }
  sound.stop();
  state = ZachGame.advance(state, Date.now());
  if (!save()) { resetIdle(); return; } // Keep a failed-save warning visible.
  displayAsleep = true;
  firstTap = null;
  clearTimeout(idleTimer);
  clearTimeout(tickTimer);
  clearTimeout(effectTimer);
  text(ui.effect, '');
  ui.screen.classList.add('display-asleep');
  ui['game-content'].inert = true;
  ui['wake-screen'].hidden = false;
  if (!document.hidden) ui['wake-screen'].focus({ preventScroll: true });
}
function wakeDisplay() {
  displayAsleep = false;
  firstTap = null;
  ui['wake-screen'].hidden = true;
  ui['game-content'].inert = false;
  ui.screen.classList.remove('display-asleep');
  tick();
  resetIdle();
  ui.time.focus({ preventScroll: true });
}
ui['wake-screen'].addEventListener('click', event => {
  event.preventDefault();
  event.stopPropagation();
  if (!displayAsleep) return;
  // Native keyboard activation is a single Enter/Space; touch and mouse require two taps.
  if (event.detail === 0) { wakeDisplay(); return; }
  const now = performance.now();
  if (firstTap && now - firstTap.time <= DOUBLE_TAP_MS
      && Math.hypot(event.clientX - firstTap.x, event.clientY - firstTap.y) <= 40) {
    wakeDisplay();
  } else firstTap = { time: now, x: event.clientX, y: event.clientY };
});
ui.screen.addEventListener('pointerdown', resetIdle);
ui.screen.addEventListener('keydown', resetIdle);
ui.time.addEventListener('click', sleepDisplay);
for (const button of buttons) button.addEventListener('click', () => action(button.dataset.action));
function toggleHat() {
  if (displayAsleep || editing) return;
  resetIdle();
  const next = {...profile, hat: profile.hat !== true};
  if (!avatarStore.save(next)) { ui['save-warning'].hidden = false; return; }
  profile = next;
  drawnSleeping = undefined;
  sound.play('tap', profile.sound);
  text(ui.speech, profile.hat ? 'hat on. very dashing ♡' : 'hat off. still handsome ♡');
  text(ui.effect, profile.hat ? '^' : '♥');
  clearTimeout(effectTimer);
  effectTimer = setTimeout(() => text(ui.effect, ''), 1800);
  render();
}
function petTap(event={}) {
  const rect = ui.zach.getBoundingClientRect?.();
  if (rect && Number.isFinite(event.clientX) && Number.isFinite(event.clientY) && rect.width && rect.height) {
    const x = (event.clientX - rect.left) * 32 / rect.width;
    const y = (event.clientY - rect.top) * 32 / rect.height;
    if (x >= 7 && x <= 25 && y <= 10) { toggleHat(); return; }
  }
  action('love');
}
ui.pet.addEventListener('click', petTap);
document.addEventListener('visibilitychange', () => {
  clearTimeout(tickTimer);
  clearTimeout(idleTimer);
  ui.screen.classList.toggle('paused', document.hidden);
  if (document.hidden) { sound.stop(); save(); }
  else if (!displayAsleep) {
    if (performance.now() >= idleDeadline) sleepDisplay();
    else {
      idleTimer = setTimeout(sleepDisplay, idleDeadline - performance.now());
      tick();
    }
  }
});
window.addEventListener('pagehide', save);
function startGame() {
  render();
  save(); // Persist birth before the first interaction.
  if (!document.hidden) { tick(); resetIdle(); }
}
