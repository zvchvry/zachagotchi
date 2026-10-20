const { test } = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../dist/storage.js');
const { initial } = require('../dist/game.js');
function memory() {
  const data = new Map();
  return { data, getItem: key => data.get(key) || null, setItem: (key,value) => data.set(key,value) };
}
test('a fresh instance restores the latest complete snapshot', () => {
  const disk = memory();
  const store = create(() => disk);
  const state = initial();
  assert.equal(store.save(state), true);
  state.plays = 9;
  assert.equal(store.save(state), true);
  assert.deepEqual(create(() => disk).load(), state);
});
test('damaged latest slot falls back to previous snapshot and can save again', () => {
  const disk = memory(); const store = create(() => disk); const old = initial();
  store.save(old); store.save({ ...old, plays:1 });
  disk.data.set('zachagotchi-save-b', '{incomplete');
  const recovered = create(() => disk);
  assert.deepEqual(recovered.load(), old);
  assert.equal(recovered.save({ ...old, plays:2 }), true);
  assert.equal(create(() => disk).load().plays, 2);
});
test('a rejected write leaves the last good snapshot intact', () => {
  const disk = memory(); const store = create(() => disk); const old = initial();
  store.save(old);
  disk.setItem = () => { throw Error('Power interrupted'); };
  assert.equal(store.save({ ...old, plays:2 }), false);
  assert.deepEqual(create(() => disk).load(), old);
});
test('legacy progress migrates without deleting the original', () => {
  const disk = memory(); const old = initial();
  disk.data.set('zachagotchi-v1', JSON.stringify(old));
  const store = create(() => disk);
  assert.deepEqual(store.load(), old);
  assert.equal(store.save(old), true);
  assert.ok(disk.data.has('zachagotchi-v1'));
  assert.deepEqual(create(() => disk).load(), old);
});
test('invalid state is rejected and failed readback is reported', () => {
  const disk = memory(); const store = create(() => disk);
  assert.equal(store.save({ ...initial(), food:NaN }), false);
  disk.setItem = () => {};
  assert.equal(store.save(initial()), false);
});
