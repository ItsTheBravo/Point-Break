export const TUNE = {
  gravity: 0.24,
  maxFall: 8.0,
  swimForce: -6.4,
  swimSquash: 0.70,

  baseSpeed: 4.2,
  maxSpeed: 12.0,
  speedRampPer1000px: 0.55,
  pxPerMeter: 10,

  dashSpeedMult: 2.8,
  dashForwardLunge: 46,

  obstacleSpacingStart: 300,
  obstacleSpacingMin: 145,
  gapStart: 190,
  gapMin: 100,
  graceDistancePx: 620,

  comboWindowMs: 2400,
  comboTier2: 5,
  comboTier3: 12,

  milestoneEveryM: 500,

  // Relic offer distances (metres)
  relicOfferDistances: [500, 1400, 2600, 4000, 5800, 8000],
};

export const BIOMES = [
  {
    id: 'reef',
    name: 'SUNLIT REEF',
    startM: 0,
    waterTop: '#031018',
    waterMid: '#04253f',
    waterBot: '#062138',
    ridgeFar: '#06182a',
    ridgeNear: '#081f33',
    kelp: '#0a4438',
    ambientColor: 'rgba(100,200,255,0.045)',
    glowColor: 'rgba(57,230,255,0.3)',
    fogColor: null,
    rockTint: null,
  },
  {
    id: 'abyss',
    name: 'THE ABYSS',
    startM: 1000,
    waterTop: '#01060d',
    waterMid: '#010e1e',
    waterBot: '#020c18',
    ridgeFar: '#030c1a',
    ridgeNear: '#040e1f',
    kelp: '#061c14',
    ambientColor: 'rgba(80,0,180,0.06)',
    glowColor: 'rgba(180,60,255,0.45)',
    fogColor: 'rgba(5,0,15,0.25)',
    rockTint: '#4a1a6a',
  },
  {
    id: 'rift',
    name: 'VOLCANIC RIFT',
    startM: 2500,
    waterTop: '#0d0503',
    waterMid: '#160905',
    waterBot: '#0d0705',
    ridgeFar: '#1a0808',
    ridgeNear: '#200c0a',
    kelp: '#2a1208',
    ambientColor: 'rgba(255,60,0,0.04)',
    glowColor: 'rgba(255,100,20,0.5)',
    fogColor: 'rgba(20,5,0,0.2)',
    rockTint: '#6b1a0a',
  },
];

export const PAL = {
  narBody: '#dcecf4',
  narBelly: '#ffffff',
  narDash: '#7dfcff',
  narEye: '#13202e',

  rock: '#8e3b2f',
  rockDark: '#5e251d',
  rockLight: '#b85a44',

  ice: '#bfe8ff',
  iceDark: '#7fc3e8',
  iceCore: '#e8f8ff',

  mineBody: '#39414a',
  mineSpike: '#525c66',
  mineGlow: '#ff3b30',

  laserOn: '#ff2040',
  laserWarn: '#ffaa00',
  laserOff: '#00ff77',
  laserNode: '#2a3040',

  pearl: '#fff6e0',
  pearlGlow: 'rgba(255,238,180,0.85)',

  hudBg: 'rgba(3,12,22,0.6)',
  cyan: '#39e6ff',
  gold: '#ffd866',
  danger: '#ff5252',
  good: '#3df2a6',
  purple: '#c084fc',
  legendary: '#f59e0b',
};
