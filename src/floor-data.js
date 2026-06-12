// Static floor definitions.
// Layers listed bottom→top (start→boss).
// connections[layerIdx] = [[fromIdx, toIdx], ...] edges between that layer and the next.
//
// Room types:
//   combat   — obstacle gauntlet (flavour randomised per pattern: pillars/ice/mines/lasers)
//   elite    — harder combat guarding a guaranteed relic
//   treasure — calm floating pearl room, relic at the end
//   shop     — spend run pearls on relics / heals / shields
//   rest     — choose: heal, +1 max HP, or dash tune-up
//   event    — risk/reward encounter
//   boss     — floor boss, relic + descend on kill

export const ROOM_ICONS = {
  combat:   { label: 'COMBAT',   emoji: '◈', color: '#7ab8d4' },
  elite:    { label: 'ELITE',    emoji: '!', color: '#ff9540' },
  treasure: { label: 'TREASURE', emoji: '◆', color: '#ffd866' },
  shop:     { label: 'SHOP',     emoji: '$', color: '#3df2a6' },
  rest:     { label: 'REST',     emoji: '+', color: '#ff7ab0' },
  event:    { label: '???',      emoji: '?', color: '#c084fc' },
  boss:     { label: 'BOSS',     emoji: '☯', color: '#ff3b60' },
};

export const FLOORS = [
  {
    floorNum: 1,
    name: 'SUNLIT REEF',
    biomeIdx: 0,
    bossName: 'The Orca',
    baseSpeed: 4.6,
    baseDifficulty: 0.25,
    layers: [
      [ { type: 'combat', lengthM: 80 } ],
      [ { type: 'combat', lengthM: 85 }, { type: 'treasure', lengthM: 50 } ],
      [ { type: 'shop' }, { type: 'combat', lengthM: 85 }, { type: 'combat', lengthM: 80 } ],
      [ { type: 'rest' }, { type: 'elite', lengthM: 105 } ],
      [ { type: 'boss' } ],
    ],
    connections: [
      [ [0,0],[0,1] ],
      [ [0,0],[0,1],[1,1],[1,2] ],
      [ [0,0],[1,0],[1,1],[2,1] ],
      [ [0,0],[1,0] ],
    ],
  },
  {
    floorNum: 2,
    name: 'THE ABYSS',
    biomeIdx: 1,
    bossName: 'The Angler',
    baseSpeed: 4.9,
    baseDifficulty: 0.36,
    layers: [
      [ { type: 'combat', lengthM: 85 } ],
      [ { type: 'combat', lengthM: 90 }, { type: 'elite', lengthM: 110 }, { type: 'combat', lengthM: 85 } ],
      [ { type: 'treasure', lengthM: 50 }, { type: 'combat', lengthM: 90 }, { type: 'event' } ],
      [ { type: 'combat', lengthM: 85 }, { type: 'shop' }, { type: 'combat', lengthM: 90 } ],
      [ { type: 'rest' }, { type: 'combat', lengthM: 95 } ],
      [ { type: 'boss' } ],
    ],
    connections: [
      [ [0,0],[0,1],[0,2] ],
      [ [0,0],[1,0],[1,1],[1,2],[2,2] ],
      [ [0,0],[0,1],[1,1],[2,1],[2,2] ],
      [ [0,0],[1,0],[1,1],[2,1] ],
      [ [0,0],[1,0] ],
    ],
  },
  {
    floorNum: 3,
    name: 'VOLCANIC RIFT',
    biomeIdx: 2,
    bossName: 'The Kraken',
    baseSpeed: 6.2,
    baseDifficulty: 0.62,
    layers: [
      [ { type: 'combat', lengthM: 90 } ],
      [ { type: 'combat', lengthM: 95 }, { type: 'combat', lengthM: 90 }, { type: 'elite', lengthM: 115 } ],
      [ { type: 'event' }, { type: 'combat', lengthM: 95 }, { type: 'treasure', lengthM: 50 } ],
      [ { type: 'combat', lengthM: 90 }, { type: 'shop' }, { type: 'combat', lengthM: 95 } ],
      [ { type: 'elite', lengthM: 115 }, { type: 'combat', lengthM: 95 } ],
      [ { type: 'rest' }, { type: 'combat', lengthM: 100 } ],
      [ { type: 'boss' } ],
    ],
    connections: [
      [ [0,0],[0,1],[0,2] ],
      [ [0,0],[1,0],[1,1],[1,2],[2,2] ],
      [ [0,0],[0,1],[1,1],[2,1],[2,2] ],
      [ [0,0],[1,0],[1,1],[2,1] ],
      [ [0,0],[0,1],[1,1] ],
      [ [0,0],[1,0] ],
    ],
  },
];

// Generate a fresh run's map for one floor.
export function buildFloorMap(floorDef) {
  return {
    floor: floorDef,
    currentLayer: 0,
    currentIdx: 0,
    visited: new Set(['0,0']),
  };
}

export function availableNext(map) {
  const conns = map.floor.connections[map.currentLayer];
  if (!conns) return [];
  return conns
    .filter(([fi]) => fi === map.currentIdx)
    .map(([, ti]) => ({ layer: map.currentLayer + 1, idx: ti }));
}

export function advanceMap(map, toLayer, toIdx) {
  map.currentLayer = toLayer;
  map.currentIdx = toIdx;
  map.visited.add(`${toLayer},${toIdx}`);
}
