(function (root) {
  'use strict';
  const keys = ['zachagotchi-save-a', 'zachagotchi-save-b'];
  const legacyKey = 'zachagotchi-v1';

  function valid(state) {
    return state && ['food', 'love', 'energy'].every(key => Number.isFinite(state[key]) && state[key] >= 0 && state[key] <= 100)
      && ['born', 'updated'].every(key => Number.isSafeInteger(state[key]) && state[key] >= 0)
      && typeof state.sleeping === 'boolean' && Number.isSafeInteger(state.plays) && state.plays >= 0;
  }

  // Alternate complete snapshots: an interrupted write never replaces the last good slot.
  function create(getStorage) {
    let sequence = 0;
    let currentSlot = -1;
    let previous = '';
    function load() {
      const candidates = [];
      for (let slot = 0; slot < keys.length; slot++) {
        try {
          const record = JSON.parse(getStorage().getItem(keys[slot]));
          if (record?.version === 1 && Number.isSafeInteger(record.sequence) && record.sequence > 0 && valid(record.state)) {
            candidates.push({ ...record, slot });
          }
        } catch { /* Try the other slot when a snapshot is damaged or inaccessible. */ }
      }
      candidates.sort((a, b) => b.sequence - a.sequence);
      if (candidates.length) {
        const latest = candidates[0];
        sequence = latest.sequence;
        currentSlot = latest.slot;
        previous = JSON.stringify(latest.state);
        return latest.state;
      }
      try {
        const legacy = JSON.parse(getStorage().getItem(legacyKey));
        if (valid(legacy)) return legacy; // Keep the original save until migration succeeds.
      } catch { /* A fresh game is usable even with storage disabled. */ }
      return null;
    }
    function save(state) {
      if (!valid(state)) return false;
      const snapshot = JSON.stringify(state);
      if (snapshot === previous) return true;
      const slot = currentSlot === 0 ? 1 : 0;
      const record = JSON.stringify({ version: 1, sequence: sequence + 1, state });
      try {
        const storage = getStorage();
        storage.setItem(keys[slot], record);
        if (storage.getItem(keys[slot]) !== record) return false;
        currentSlot = slot;
        sequence++;
        previous = snapshot;
        return true;
      } catch { return false; }
    }
    return { load, save };
  }
  const api = { create };
  if (typeof module !== 'undefined') module.exports = api;
  else root.ZachStorage = api;
})(globalThis);
