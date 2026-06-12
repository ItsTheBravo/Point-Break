// Central tuning knobs. Tweak these to change game feel.

export const TUNE = {
  // Physics
  gravity: 0.22,
  maxFall: 7.5,
  swimForce: -6.2,
  swimSquash: 0.72,

  // World
  baseSpeed: 3.0,
  maxSpeed: 6.8,
  speedRampPer1000px: 0.32,
  pxPerMeter: 10,

  // Dash
  dashSpeedMult: 2.6,
  dashForwardLunge: 44,

  // Spawning
  obstacleSpacingStart: 340,
  obstacleSpacingMin: 245,
  gapStart: 215,
  gapMin: 150,
  graceDistancePx: 900,

  // Combo
  comboWindowMs: 2600,
  comboTier2: 6,
  comboTier3: 14,

  // Milestones
  milestoneEveryM: 500,
};

export const PAL = {
  waterTop: '#031018',
  waterDeep: '#04253f',
  waterBottom: '#062138',

  ridgeFar: '#06182a',
  ridgeNear: '#081f33',
  kelp: '#0a4438',
  fish: 'rgba(10,40,60,0.55)',

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

  pearl: '#fff6e0',
  pearlGlow: 'rgba(255,238,180,0.85)',

  hudBg: 'rgba(3,12,22,0.55)',
  cyan: '#39e6ff',
  gold: '#ffd866',
  danger: '#ff5252',
  good: '#3df2a6',
};
