// Static floor definitions.
// Layers listed bottom→top (start→boss).
// connections[layerIdx] = [[fromIdx, toIdx], ...] edges between that layer and the next.

export const ROOM_ICONS = {
  corridor:     { label: 'PASSAGE',  emoji: '◈', color: '#7ab8d4' },
  ice_gauntlet: { label: 'GAUNTLET', emoji: '❋', color: '#bfe8ff' },
  hazard:       { label: 'HAZARD',   emoji: '☠', color: '#ff5252' },
  treasure:     { label: 'TREASURE', emoji: '◆', color: '#ffd866' },
  boss:         { label: 'BOSS',     emoji: '☯', color: '#ff3b60' },
};

export const FLOORS = [
  {
    floorNum: 1,
    name: 'SUNLIT REEF',
    biomeIdx: 0,
    bossName: 'The Orca',
    baseSpeed: 4.6,
    baseDifficulty: 0.22,
    layers: [
      [ { type: 'corridor',     lengthM: 90 } ],
      [ { type: 'ice_gauntlet', lengthM: 80 }, { type: 'hazard',   lengthM: 70 } ],
      [ { type: 'corridor',     lengthM: 85 }, { type: 'treasure',  lengthM: 50 }, { type: 'ice_gauntlet', lengthM: 80 } ],
      [ { type: 'ice_gauntlet', lengthM: 80 }, { type: 'hazard',   lengthM: 70 } ],
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
    baseSpeed: 5.8,
    baseDifficulty: 0.52,
    layers: [
      [ { type: 'corridor',     lengthM: 80 } ],
      [ { type: 'hazard',       lengthM: 70 }, { type: 'ice_gauntlet', lengthM: 75 }, { type: 'corridor', lengthM: 80 } ],
      [ { type: 'hazard',       lengthM: 65 }, { type: 'treasure',     lengthM: 50 }, { type: 'ice_gauntlet', lengthM: 75 } ],
      [ { type: 'ice_gauntlet', lengthM: 75 }, { type: 'hazard',       lengthM: 65 }, { type: 'corridor',     lengthM: 80 } ],
      [ { type: 'boss' } ],
    ],
    connections: [
      [ [0,0],[0,1],[0,2] ],
      [ [0,0],[0,1],[1,1],[1,2],[2,2] ],
      [ [0,0],[1,0],[1,1],[2,1],[2,2] ],
      [ [0,0],[1,0],[2,0] ],
    ],
  },
  {
    floorNum: 3,
    name: 'VOLCANIC RIFT',
    biomeIdx: 2,
    bossName: 'The Kraken',
    baseSpeed: 7.5,
    baseDifficulty: 0.82,
    layers: [
      [ { type: 'corridor',     lengthM: 70 } ],
      [ { type: 'ice_gauntlet', lengthM: 70 }, { type: 'hazard',       lengthM: 60 }, { type: 'corridor',     lengthM: 70 } ],
      [ { type: 'hazard',       lengthM: 55 }, { type: 'treasure',     lengthM: 45 }, { type: 'hazard',       lengthM: 55 } ],
      [ { type: 'hazard',       lengthM: 55 }, { type: 'ice_gauntlet', lengthM: 65 }, { type: 'hazard',       lengthM: 55 } ],
      [ { type: 'hazard',       lengthM: 55 }, { type: 'ice_gauntlet', lengthM: 65 } ],
      [ { type: 'boss' } ],
    ],
    connections: [
      [ [0,0],[0,1],[0,2] ],
      [ [0,0],[0,1],[1,1],[1,2],[2,2] ],
      [ [0,0],[1,0],[1,1],[2,1],[2,2] ],
      [ [0,0],[1,0],[1,1],[2,1] ],
      [ [0,0],[1,0] ],
    ],
  },
];

// Generate a fresh run's map for one floor: a concrete list of reachable
// (layer, idx) nodes and the connections between them.
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
