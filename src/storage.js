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
    baseCost: 22, costGrowth: 16, maxLevel: 6,
  },
  {
    id: 'dash_cooldown', name: 'Quick Tusk', icon: 'bolt',
    desc: 'Dash recharges faster each level',
    baseCost: 28, costGrowth: 20, maxLevel: 7,
  },
  {
    id: 'dash_duration', name: 'Long Charge', icon: 'arrow',
    desc: 'Dash lasts longer each level',
    baseCost: 20, costGrowth: 16, maxLevel: 6,
  },
  {
    id: 'magnet', name: 'Pearl Magnet', icon: 'magnet',
    desc: 'Pull in pearls from further away',
    baseCost: 15, costGrowth: 12, maxLevel: 6,
  },
  {
    id: 'pearl_value', name: 'Lucky Shine', icon: 'gem',
    desc: 'Pearls are worth +20% more per level',
    baseCost: 24, costGrowth: 18, maxLevel: 6,
  },
  {
    id: 'shield', name: 'Bubble Shield', icon: 'shield',
    desc: 'Start each run with a free hit',
    baseCost: 60, costGrowth: 65, maxLevel: 2,
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
  // Tiers match old level 4 max (190) so existing saves don't degrade.
  const magnetTiers = [0, 65, 110, 152, 190, 224, 255];
  return {
    maxHealth: 3 + getLevel('max_health'),
    dashCooldown: 3000 - 280 * getLevel('dash_cooldown'),
    dashDuration: 420 + 80 * getLevel('dash_duration'),
    magnetRadius: magnetTiers[Math.min(getLevel('magnet'), magnetTiers.length - 1)],
    pearlValue: 1 + 0.20 * getLevel('pearl_value'),
    shield: getLevel('shield'),
    swimForce: TUNE.swimForce,
  };
}

export function getTotalPearls() { return Storage.get('total_pearls', 0); }
export function addTotalPearls(n) { Storage.set('total_pearls', getTotalPearls() + n); }
export function getBestM() { return Storage.get('best_m', 0); }
export function setBestM(m) { Storage.set('best_m', m); }
