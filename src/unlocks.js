import { Storage, getStats } from './storage.js';

// Achievement-gated content. Each entry's check(stats) runs against the
// lifetime stats in storage.js; once satisfied it stays unlocked forever.

export const UNLOCKS = [
  // Classes
  { id: 'class_pearl_diver', kind: 'class', ref: 'pearl_diver',
    name: 'PEARL DIVER class', hint: 'Bank 150 lifetime pearls',
    check: s => (s.banked || 0) >= 150 },
  { id: 'class_phantom', kind: 'class', ref: 'phantom',
    name: 'PHANTOM class', hint: 'Defeat The Angler',
    check: s => (s.boss2 || 0) >= 1 },

  // Relics
  { id: 'relic_storm_caller', kind: 'relic', ref: 'storm_caller',
    name: 'Storm Caller relic', hint: 'Reach a 25 pearl combo',
    check: s => (s.bestCombo || 0) >= 25 },
  { id: 'relic_moon_shell', kind: 'relic', ref: 'moon_shell',
    name: 'Moon Shell relic', hint: 'Bank 300 lifetime pearls',
    check: s => (s.banked || 0) >= 300 },
  { id: 'relic_tusk_amp', kind: 'relic', ref: 'tusk_amp',
    name: 'Tusk Amplifier relic', hint: 'Defeat The Orca',
    check: s => (s.boss1 || 0) >= 1 },
  { id: 'relic_glass_tusk', kind: 'relic', ref: 'glass_tusk',
    name: 'Glass Tusk relic', hint: 'Clear floor 2',
    check: s => (s.boss2 || 0) >= 1 },
  { id: 'relic_pressure_pearl', kind: 'relic', ref: 'pressure_pearl',
    name: 'Pressure Pearl relic', hint: 'Survive 25 hits',
    check: s => (s.hits || 0) >= 25 },
  { id: 'relic_king_tide', kind: 'relic', ref: 'king_tide',
    name: 'King Tide relic', hint: 'Win a full run',
    check: s => (s.wins || 0) >= 1 },
  { id: 'relic_barnacle_crown', kind: 'relic', ref: 'barnacle_crown',
    name: 'Barnacle Crown relic', hint: 'Hold 6 relics in one run',
    check: s => (s.mostRelics || 0) >= 6 },
];

function getUnlockedSet() { return new Set(Storage.get('unlocked_ids', [])); }

// True when the relic is gated and not yet earned.
export function relicLocked(relicId) {
  const u = UNLOCKS.find(u => u.kind === 'relic' && u.ref === relicId);
  return u ? !getUnlockedSet().has(u.id) : false;
}

// Returns the unlock entry if the class is still locked, else null.
export function classLock(classId) {
  const u = UNLOCKS.find(u => u.kind === 'class' && u.ref === classId);
  if (!u || getUnlockedSet().has(u.id)) return null;
  return u;
}

// Re-evaluate every locked achievement; persist and return newly earned ones.
export function checkNewUnlocks() {
  const have = getUnlockedSet();
  const stats = getStats();
  const fresh = [];
  for (const u of UNLOCKS) {
    if (have.has(u.id)) continue;
    if (u.check(stats)) { have.add(u.id); fresh.push(u); }
  }
  if (fresh.length) Storage.set('unlocked_ids', [...have]);
  return fresh;
}
