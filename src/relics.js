import { PAL } from './constants.js';
import { relicLocked } from './unlocks.js';

// Each relic has hooks fired by game.js at the right moments.
// Hooks receive the game object and can mutate its state directly.

export const RARITY = {
  common:    { label: 'COMMON',    color: '#94a3b8', glow: 'rgba(148,163,184,0.3)', price: 25 },
  uncommon:  { label: 'UNCOMMON',  color: '#3b82f6', glow: 'rgba(59,130,246,0.4)',  price: 45 },
  rare:      { label: 'RARE',      color: '#a855f7', glow: 'rgba(168,85,247,0.5)',  price: 70 },
  legendary: { label: 'LEGENDARY', color: PAL.legendary, glow: 'rgba(245,158,11,0.6)', price: 100 },
};

export const RELICS = {

  iron_blubber: {
    name: 'Iron Blubber',
    rarity: 'common',
    desc: 'Gain +2 max health for this run.',
    icon: 'heart',
    apply(g) {
      g.player.stats.maxHealth += 2;
      g.player.health = Math.min(g.player.health + 2, g.player.stats.maxHealth);
    },
  },

  lucky_spiral: {
    name: 'Lucky Spiral',
    rarity: 'common',
    desc: '25% chance each pearl is a Golden Pearl worth 4×.',
    icon: 'star',
    // Effect handled in game._collectPearls via hasRelic check.
  },

  thirsty_tusk: {
    name: 'Thirsty Tusk',
    rarity: 'common',
    desc: 'Each ice obstacle smashed awards +3 bonus pearls.',
    icon: 'gem',
    // Effect handled in game collision via hasRelic check.
  },

  berserker_shell: {
    name: 'Berserker Shell',
    rarity: 'uncommon',
    desc: 'Taking damage instantly recharges your dash.',
    icon: 'bolt',
    onDamage(g) {
      g.player.dashCooldownTimer = 0;
      g.player.isDashing = false;
      g.flash.trigger(PAL.cyan, 0.18);
      g.floaters.add(g.player.x, g.player.y - 44, 'DASH READY!', { color: PAL.cyan, size: 14 });
    },
  },

  echo_tusk: {
    name: 'Echo Tusk',
    rarity: 'uncommon',
    desc: 'Dashing emits a shockwave that shatters all nearby ice.',
    icon: 'wave',
    onDash(g) {
      const r = 180;
      let shattered = 0;
      for (const o of g.obstacles.items) {
        if (o.kind !== 'ice') continue;
        const cx = o.x + o.w / 2;
        const cy = o.gapY || 0;
        if ((cx - g.player.x) ** 2 + (cy - g.player.y) ** 2 < r * r) {
          if (!o.topGone) {
            o.topGone = true;
            shattered++;
            g.particles.emit(cx, o.topH / 2, { count: 10, color: PAL.ice, speed: 3.5, spread: Math.PI * 2, radius: 4, shape: 'shard' });
          }
          if (!o.botGone) {
            o.botGone = true;
            shattered++;
            g.particles.emit(cx, (o.botY + g.H) / 2, { count: 10, color: PAL.ice, speed: 3.5, spread: Math.PI * 2, radius: 4, shape: 'shard' });
          }
        }
      }
      if (shattered > 0) {
        g.Sound.shatter();
        g.floaters.add(g.player.x, g.player.y - 50, `ECHO ×${shattered}!`, { color: PAL.cyan, size: 15 });
      }
      // Shockwave ring particle burst.
      g.particles.emit(g.player.x, g.player.y, { count: 22, color: 'rgba(57,230,255,0.7)', speed: 7, spread: Math.PI * 2, radius: 2.5, gravity: 0 });
    },
  },

  vampire_pearl: {
    name: 'Vampire Pearl',
    rarity: 'uncommon',
    desc: 'Every 8 pearls collected restores 1 HP.',
    icon: 'drop',
    onPearl(g, count) {
      g._vampireCounter = (g._vampireCounter || 0) + count;
      while (g._vampireCounter >= 8) {
        g._vampireCounter -= 8;
        if (g.player.health < g.player.stats.maxHealth) {
          g.player.health++;
          g.floaters.add(g.player.x, g.player.y - 50, '+1 HP', { color: '#ff7ab0', size: 15 });
          g.particles.emit(g.player.x, g.player.y, { count: 8, color: '#ff7ab0', speed: 2.5, spread: Math.PI * 2, radius: 3 });
        }
      }
    },
  },

  void_passage: {
    name: 'Void Passage',
    rarity: 'rare',
    desc: 'While dashing, you phase through ALL obstacles — even rock and mines.',
    icon: 'ghost',
    // Effect handled in game collision: while player.isDashing AND hasRelic('void_passage'), skip all damage.
  },

  adrenaline_rush: {
    name: 'Adrenaline Rush',
    rarity: 'rare',
    desc: 'Below 2 HP: +50% speed, dash cooldown halved.',
    icon: 'lightning',
    onUpdate(g) {
      if (g.player.health <= 1) {
        g._adrenalineActive = true;
      } else {
        g._adrenalineActive = false;
      }
    },
  },

  pearl_cascade: {
    name: 'Pearl Cascade',
    rarity: 'rare',
    desc: 'Reaching combo 10 summons a ring of 6 free pearls.',
    icon: 'ring',
    onComboMilestone(g, combo) {
      if (combo % 10 === 0) {
        const n = 6;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const r = 70 + Math.random() * 30;
          g.pearls._spawnAt(g.player.x + Math.cos(a) * r, g.player.y + Math.sin(a) * r);
        }
        g.floaters.add(g.player.x, g.player.y - 55, 'CASCADE!', { color: PAL.gold, size: 18 });
        g.Sound.milestone();
      }
    },
  },

  phantom_twin: {
    name: 'Phantom Twin',
    rarity: 'legendary',
    desc: 'Every 4s a ghost auto-dashes forward, collecting pearls and shattering ice.',
    icon: 'twin',
    onUpdate(g, dt) {
      g._phantomTimer = (g._phantomTimer || 0) - dt;
      if (g._phantomTimer <= 0) {
        g._phantomTimer = 4000;
        g._spawnPhantom();
      }
    },
  },

  comb_jelly: {
    name: 'Comb Jelly',
    rarity: 'common',
    desc: 'Combo window lasts 2.5s longer.',
    icon: 'wave',
    apply(g) { g._comboWindowBonus = (g._comboWindowBonus || 0) + 2500; },
  },

  deep_pockets: {
    name: 'Deep Pockets',
    rarity: 'common',
    desc: 'Pearls are worth +30% more.',
    icon: 'gem',
    apply(g) { g.player.stats.pearlValue *= 1.3; },
  },

  dash_battery: {
    name: 'Dash Battery',
    rarity: 'common',
    desc: 'Dash cooldown reduced by 30%.',
    icon: 'bolt',
    apply(g) { g.player.stats.dashCooldown *= 0.7; },
  },

  pearl_lens: {
    name: 'Pearl Lens',
    rarity: 'common',
    desc: 'Pearl magnet radius greatly increased.',
    icon: 'star',
    apply(g) { g.player.stats.magnetRadius = (g.player.stats.magnetRadius || 0) + 120; },
  },

  featherfall: {
    name: 'Featherfall',
    rarity: 'common',
    desc: 'You sink 35% slower.',
    icon: 'drop',
    apply(g) { g.player.stats.gravityMult = (g.player.stats.gravityMult || 1) * 0.65; },
  },

  golden_hull: {
    name: 'Golden Hull',
    rarity: 'uncommon',
    desc: 'Gain a bubble shield now and at the start of each floor.',
    icon: 'ring',
    apply(g) { g.player.shield++; },
    onFloorStart(g) { g.player.shield++; },
  },

  glacier_surf: {
    name: 'Glacier Surf',
    rarity: 'uncommon',
    desc: 'Smashing ice extends your dash by 0.5s — chain it!',
    icon: 'wave',
    // Effect handled in game collision via hasRelic check.
  },

  slipstream: {
    name: 'Slipstream',
    rarity: 'uncommon',
    desc: 'Reflected boss projectiles award +6 pearls.',
    icon: 'lightning',
    onReflect(g, p) { g._gainPearls(6, p.x, p.y, false); },
  },

  diamond_tusk: {
    name: 'Diamond Tusk',
    rarity: 'rare',
    desc: 'Your dash shatters ROCK pillars too.',
    icon: 'gem',
    // Effect handled in game collision via hasRelic check.
  },

  second_wind: {
    name: 'Second Wind',
    rarity: 'rare',
    desc: 'Once per run, a fatal hit leaves you at 1 HP instead.',
    icon: 'heart',
    // Effect handled in game._applyDamage via hasRelic check.
  },

  // ── Synergy & unlockable relics ──

  blood_pearl: {
    name: 'Blood Pearl',
    rarity: 'uncommon',
    desc: 'Taking a hit bursts 6 pearls out of you.',
    icon: 'drop',
    onDamage(g) {
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 50 + Math.random() * 60;
        g.pearls._spawnAt(g.player.x + Math.cos(a) * r, g.player.y + Math.sin(a) * r);
      }
    },
  },

  siren_song: {
    name: 'Siren Song',
    rarity: 'uncommon',
    desc: 'While dashing, your pearl magnet reaches much further.',
    icon: 'wave',
    // Effect handled in game pearl update via hasRelic check.
  },

  current_rider: {
    name: 'Current Rider',
    rarity: 'rare',
    desc: 'Your combo no longer resets when you take damage.',
    icon: 'lightning',
    // Effect handled in game._applyDamage via hasRelic check.
  },

  storm_caller: {
    name: 'Storm Caller',
    rarity: 'rare',
    desc: 'Every 10-combo milestone grants 1s of invincibility.',
    icon: 'bolt',
    onComboMilestone(g) {
      g.player.invincibleTimer = Math.max(g.player.invincibleTimer, 1000);
      g.flash.trigger(PAL.cyan, 0.18);
      g.floaters.add(g.player.x, g.player.y - 55, 'STORM!', { color: PAL.cyan, size: 16 });
    },
  },

  moon_shell: {
    name: 'Moon Shell',
    rarity: 'rare',
    desc: 'Every 50 pearls collected grants +1 bubble shield.',
    icon: 'ring',
    onPearl(g, count) {
      g._moonShellCounter = (g._moonShellCounter || 0) + count;
      while (g._moonShellCounter >= 50) {
        g._moonShellCounter -= 50;
        g.player.shield++;
        g.floaters.add(g.player.x, g.player.y - 50, '+1 SHIELD', { color: '#78dcff', size: 15 });
        g.Sound.milestone();
      }
    },
  },

  tusk_amp: {
    name: 'Tusk Amplifier',
    rarity: 'rare',
    desc: 'Reflecting a boss projectile restores 1 HP.',
    icon: 'heart',
    onReflect(g) {
      if (g.player.health < g.player.stats.maxHealth) {
        g.player.health++;
        g.floaters.add(g.player.x, g.player.y - 50, '+1 HP', { color: '#ff7ab0', size: 15 });
      }
    },
  },

  pressure_pearl: {
    name: 'Pressure Pearl',
    rarity: 'uncommon',
    desc: 'At 2 HP or less, all pearls are worth double.',
    icon: 'gem',
    // Effect handled in game._gainPearls via hasRelic check.
  },

  glass_tusk: {
    name: 'Glass Tusk',
    rarity: 'rare',
    desc: 'Dash cooldown halved… but −2 max HP. Live dangerously.',
    icon: 'bolt',
    apply(g) {
      g.player.stats.dashCooldown *= 0.5;
      g.player.stats.maxHealth = Math.max(1, g.player.stats.maxHealth - 2);
      g.player.health = Math.min(g.player.health, g.player.stats.maxHealth);
    },
  },

  king_tide: {
    name: 'King Tide',
    rarity: 'legendary',
    desc: 'All pearls count one combo tier higher.',
    icon: 'star',
    // Effect handled in game.comboTier getter via hasRelic check.
  },

  barnacle_crown: {
    name: 'Barnacle Crown',
    rarity: 'legendary',
    desc: 'Each floor starts with +1 shield per 4 relics you hold.',
    icon: 'ring',
    onFloorStart(g) {
      const n = Math.floor(g.activeRelics.length / 4);
      if (n > 0) {
        g.player.shield += n;
        g.floaters.add(g.player.x, g.player.y - 50, `+${n} SHIELD`, { color: '#78dcff', size: 15 });
      }
    },
  },

};

// Stamp ids onto relic objects so the unlock system can reference them.
for (const [id, r] of Object.entries(RELICS)) r.id = id;

export const RELIC_LIST = Object.values(RELICS);

export function pickRelicChoices(held, n = 3) {
  const available = RELIC_LIST.filter(r => !held.includes(r) && !relicLocked(r.id));
  const shuffled = available.slice().sort(() => Math.random() - 0.5);
  // Weight toward higher rarity earlier.
  return shuffled.slice(0, Math.min(n, shuffled.length));
}
