import { TUNE } from './constants.js';

export const Storage = {
  get(key, def) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : def;
    } catch { return def; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  },
};

// Note: 'total_pearls' and 'upgrade_levels' keys are kept from v1 so
// existing player progress carries over.

export const UPGRADES = [
  {
    id: 'max_health', name: 'Thick Blubber', icon: 'heart',
    desc: '+1 max health per level',
    baseCost: 15, costGrowth: 12, maxLevel: 5,
  },
  {
    id: 'dash_cooldown', name: 'Quick Tusk', icon: 'bolt',
    desc: 'Dash recharges 0.4s faster',
    baseCost: 20, costGrowth: 15, maxLevel: 5,
  },
  {
    id: 'dash_duration', name: 'Long Charge', icon: 'arrow',
    desc: 'Dash lasts 90ms longer',
    baseCost: 15, costGrowth: 12, maxLevel: 4,
  },
  {
    id: 'magnet', name: 'Pearl Magnet', icon: 'magnet',
    desc: 'Pull in pearls from further away',
    baseCost: 12, costGrowth: 10, maxLevel: 4,
  },
  {
    id: 'pearl_value', name: 'Lucky Shine', icon: 'gem',
    desc: 'Pearls are worth +25% more',
    baseCost: 18, costGrowth: 14, maxLevel: 4,
  },
  {
    id: 'shield', name: 'Bubble Shield', icon: 'shield',
    desc: 'Start each run with a free hit',
    baseCost: 40, costGrowth: 45, maxLevel: 2,
  },
];

export function getLevels() {
  return Storage.get('upgrade_levels', {});
}

export function getLevel(id) {
  return getLevels()[id] || 0;
}

export function upgradeCost(upg, level) {
  return upg.baseCost + level * upg.costGrowth;
}

export function buyUpgrade(id) {
  const upg = UPGRADES.find(u => u.id === id);
  const levels = getLevels();
  const level = levels[id] || 0;
  if (level >= upg.maxLevel) return { ok: false, reason: 'maxed' };
  const cost = upgradeCost(upg, level);
  const pearls = getTotalPearls();
  if (pearls < cost) return { ok: false, reason: 'poor' };
  Storage.set('total_pearls', pearls - cost);
  levels[id] = level + 1;
  Storage.set('upgrade_levels', levels);
  return { ok: true, cost };
}

export function buildStats() {
  const magnetTiers = [0, 70, 110, 150, 190];
  return {
    maxHealth: 3 + getLevel('max_health'),
    dashCooldown: 3000 - 400 * getLevel('dash_cooldown'),
    dashDuration: 420 + 90 * getLevel('dash_duration'),
    magnetRadius: magnetTiers[getLevel('magnet')],
    pearlValue: 1 + 0.25 * getLevel('pearl_value'),
    shield: getLevel('shield'),
    swimForce: TUNE.swimForce,
  };
}

export function getTotalPearls() { return Storage.get('total_pearls', 0); }
export function addTotalPearls(n) { Storage.set('total_pearls', getTotalPearls() + n); }
export function getBestM() { return Storage.get('best_m', 0); }
export function setBestM(m) { Storage.set('best_m', m); }
