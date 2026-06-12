// Floor configs + procedural map generation.
// Maps are generated fresh by buildFloorMap() every time a floor starts,
// so no two runs (or loops) share a layout.
//
// Room types:
//   combat   — obstacle gauntlet (flavour randomised per pattern: pillars/ice/mines/lasers)
//   elite    — harder combat guarding a guaranteed relic
//   treasure — calm floating pearl room
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

// midLayers = randomised layers between the entry combat and the pre-boss
// rest layer. Total layers = midLayers + 3.
export const FLOORS = [
  {
    floorNum: 1, name: 'SUNLIT REEF', biomeIdx: 0, bossName: 'The Orca',
    baseSpeed: 4.6, baseDifficulty: 0.25, midLayers: 2, elites: 1, lenBase: 80,
  },
  {
    floorNum: 2, name: 'THE ABYSS', biomeIdx: 1, bossName: 'The Angler',
    baseSpeed: 4.9, baseDifficulty: 0.36, midLayers: 3, elites: 1, lenBase: 85,
  },
  {
    floorNum: 3, name: 'VOLCANIC RIFT', biomeIdx: 2, bossName: 'The Kraken',
    baseSpeed: 6.2, baseDifficulty: 0.62, midLayers: 4, elites: 2, lenBase: 90,
  },
];

// Monotonic (non-crossing) random edges between a layer of n nodes and the
// next layer of m nodes. Every node gets at least one edge in and out.
function connectLayers(n, m) {
  const edges = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    edges.push([i, j]);
    while (j < m - 1) {
      // Targets left can never exceed from-nodes left, or some would orphan.
      const mustAdvance = (m - 1 - j) > (n - 1 - i);
      if (mustAdvance || Math.random() < 0.42) {
        j++;
        edges.push([i, j]);
      } else break;
    }
    if (i < n - 1 && j < m - 1 && Math.random() < 0.5) j++;
  }
  return edges;
}

function makeRoom(type, cfg) {
  if (type === 'combat')   return { type, lengthM: cfg.lenBase + Math.floor(Math.random() * 16) };
  if (type === 'elite')    return { type, lengthM: cfg.lenBase + 22 + Math.floor(Math.random() * 10) };
  if (type === 'treasure') return { type, lengthM: 50 };
  return { type };
}

function genLayout(cfg) {
  const layers = [];
  layers.push([{ type: 'combat', lengthM: cfg.lenBase }]);

  // Middle layers: 2–3 nodes each.
  const counts = [];
  for (let i = 0; i < cfg.midLayers; i++) counts.push(2 + (Math.random() < 0.55 ? 1 : 0));
  const slots = counts.reduce((a, b) => a + b, 0);

  // Fill a bag for the middle slots: guaranteed specials first (they
  // survive trimming on small maps), occasional extras, rest combat.
  const bag = ['shop', 'treasure', 'event'];
  for (let i = 0; i < cfg.elites; i++) bag.push('elite');
  if (Math.random() < 0.5)  bag.push('event');
  if (Math.random() < 0.35) bag.push('rest');
  while (bag.length < slots) bag.push('combat');
  bag.length = slots;
  for (let i = bag.length - 1; i > 0; i--) {
    const k = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[k]] = [bag[k], bag[i]];
  }

  let b = 0;
  for (const c of counts) {
    const layer = [];
    for (let i = 0; i < c; i++) layer.push(makeRoom(bag[b++], cfg));
    layers.push(layer);
  }

  // Pre-boss layer always offers a rest beside one last fight.
  layers.push([{ type: 'rest' }, makeRoom(Math.random() < 0.4 ? 'elite' : 'combat', cfg)]);
  layers.push([{ type: 'boss' }]);

  const connections = [];
  for (let li = 0; li < layers.length - 1; li++) {
    connections.push(connectLayers(layers[li].length, layers[li + 1].length));
  }
  return { layers, connections };
}

// Generate a fresh map for one floor.
export function buildFloorMap(floorDef) {
  const { layers, connections } = genLayout(floorDef);
  return {
    floor: { ...floorDef, layers, connections },
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
