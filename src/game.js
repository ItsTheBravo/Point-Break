import { TUNE, PAL, BIOMES } from './constants.js';
import { buildStats, addTotalPearls, getBestM, setBestM } from './storage.js';
import { Sound } from './audio.js';
import { Player } from './player.js';
import { ObstacleManager } from './obstacles.js';
import { PearlManager } from './pearls.js';
import { ParticleSystem } from './particles.js';
import { Background } from './background.js';
import { HUD } from './hud.js';
import { Shop } from './shop.js';
import { StartScreen } from './screens.js';
import { Shake, Flash, FloatingTexts, Ripples, Banners } from './juice.js';
import { RELICS, pickRelicChoices } from './relics.js';
import { RelicPicker } from './relic-picker.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this._resize();
    window.addEventListener('resize', () => this._resize());

    // State machine: 'start' | 'playing' | 'dying' | 'relic-pick' | 'shop'
    this.state = 'start';
    this.time = 0;
    this.lastTs = 0;
    this.hitstop = 0;
    this.timeScale = 1;

    this.bg = new Background(this.W, this.H);
    this.hud = new HUD();
    this.shop = new Shop();
    this.startScreen = new StartScreen();
    this.particles = new ParticleSystem();
    this.shake = new Shake();
    this.flash = new Flash();
    this.floaters = new FloatingTexts();
    this.ripples = new Ripples();
    this.banners = new Banners();
    this.relicPicker = new RelicPicker();
    this.obstacles = new ObstacleManager(this.W, this.H);
    this.pearls = new PearlManager(this.W, this.H);

    // Run-scoped relic state.
    this.activeRelics = [];
    this.offeredRelicDistances = TUNE.relicOfferDistances.slice();

    // Expose Sound so relics can call it.
    this.Sound = Sound;

    this.shop.onRestart = () => this._startRun();
    this._resetRunVars();
    this._buildPlayer();
    this._bindInput();

    requestAnimationFrame(ts => this._loop(ts));
  }

  // ── Setup ──────────────────────────────────────────────────────────────

  _resize() {
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = Math.floor(this.W * this.dpr);
    this.canvas.height = Math.floor(this.H * this.dpr);
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.bg?.resize(this.W, this.H);
    this.obstacles?.resize(this.W, this.H);
    this.pearls?.resize(this.W, this.H);
  }

  _resetRunVars() {
    this.distPx = 0;
    this.speed = TUNE.baseSpeed;
    this.sessionPearls = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestComboTier = 1;
    this.nextMilestone = TUNE.milestoneEveryM;
    this.announcedBest = false;
    this.deathTimer = 0;

    this.activeRelics = [];
    this.offeredRelicDistances = TUNE.relicOfferDistances.slice();
    this._nextBiomeIdx = 1;
    this._biomeTransitionTimer = 0;
    this._currentBiome = BIOMES[0];

    // Relic-specific counters.
    this._vampireCounter = 0;
    this._phantomTimer = 0;
    this._adrenalineActive = false;
    this._phantomGhosts = [];
  }

  _buildPlayer() {
    this.player = new Player(this.W * 0.24, this.H / 2, buildStats());
  }

  _startRun() {
    this.state = 'playing';
    this._resetRunVars();
    this._buildPlayer();
    this.obstacles.reset();
    this.pearls.reset();
    this.particles.reset();
    this.floaters.items = [];
    this.bg.startTransition(BIOMES[0], BIOMES[0]);
  }

  // ── Relic helpers ───────────────────────────────────────────────────────

  hasRelic(id) { return this.activeRelics.some(r => r === RELICS[id]); }

  _fireRelicHook(hook, ...args) {
    for (const relic of this.activeRelics) {
      if (relic[hook]) relic[hook](this, ...args);
    }
  }

  _offerRelics() {
    this.state = 'relic-pick';
    const choices = pickRelicChoices(this.activeRelics, 3);
    if (choices.length === 0) {
      this.state = 'playing';
      return;
    }
    Sound.relicOffer();
    this.relicPicker.show(choices, (chosen) => {
      this.activeRelics.push(chosen);
      if (chosen.apply) chosen.apply(this);
      Sound.relicPick();
      this.flash.trigger(PAL.gold, 0.2);
      this.banners.add(`${chosen.name}!`, PAL.gold);
      this.state = 'playing';
    }, this.time);
  }

  // ── Phantom twin ability ────────────────────────────────────────────────

  _spawnPhantom() {
    this._phantomGhosts.push({
      x: this.player.x,
      y: this.player.y,
      life: 1.2,
      angle: this.player.angle,
    });
  }

  _updatePhantoms(step, speed, dt) {
    for (const g of this._phantomGhosts) {
      g.x += speed * TUNE.dashSpeedMult * step;
      g.life -= dt / 1000;
      // Collect pearls along path.
      for (const p of this.pearls.items) {
        if (p.collected) continue;
        const dx = p.x - g.x, dy = p.y - g.y;
        if (dx * dx + dy * dy < (p.r + 20) ** 2) {
          p.collected = true;
          this._gainPearls(1, p.x, p.y, false);
        }
      }
      // Shatter ice on path.
      for (const o of this.obstacles.items) {
        if (o.kind !== 'ice') continue;
        if (g.x > o.x && g.x < o.x + o.w) {
          if (!o.topGone) { o.topGone = true; this.Sound.shatter(); }
          if (!o.botGone) { o.botGone = true; }
        }
      }
    }
    this._phantomGhosts = this._phantomGhosts.filter(g => g.life > 0);
  }

  // ── Input ───────────────────────────────────────────────────────────────

  _bindInput() {
    const tap = (x, y) => {
      Sound.unlock();

      if (this.hud.inMute(x, y)) {
        Sound.toggleMute();
        Sound.tap();
        return;
      }

      switch (this.state) {
        case 'start':
          Sound.tap();
          this._startRun();
          break;
        case 'playing': {
          if (x < this.W / 2) {
            if (this.player.dash()) {
              Sound.dash();
              this.shake.add(0.18);
              this.ripples.add(x, y, 'rgba(57,230,255,0.6)');
              this.particles.emit(this.player.x - 24, this.player.y, {
                count: 14, color: PAL.narDash, speed: 4.5, spread: Math.PI * 0.7, angle: Math.PI, radius: 3,
              });
              this._fireRelicHook('onDash');
            } else {
              this.ripples.add(x, y, 'rgba(140,150,160,0.4)');
            }
          } else {
            this.player.swim();
            this.hud.notifySwim();
            Sound.swim();
            this.ripples.add(x, y, 'rgba(191,232,255,0.5)');
            this.particles.emit(this.player.x - 6, this.player.y + 12, {
              count: 5, color: 'rgba(170,220,255,0.8)', speed: 1.6,
              spread: Math.PI * 0.6, angle: Math.PI / 2, radius: 2.2, gravity: -0.02,
            });
          }
          break;
        }
        case 'relic-pick':
          this.relicPicker.handleTap(x, y, this.time);
          break;
        case 'shop':
          this.shop.handleTap(x, y, this.time);
          break;
      }
    };

    const move = (x, y) => {
      if (this.state === 'relic-pick') this.relicPicker.handleMove(x, y);
    };

    this.canvas.addEventListener('pointerdown', e => { e.preventDefault(); tap(e.clientX, e.clientY); });
    this.canvas.addEventListener('pointermove', e => { move(e.clientX, e.clientY); });

    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) tap(this.W * 0.75, this.H / 2);
      else if (['ShiftLeft', 'KeyX', 'KeyA'].includes(e.code)) tap(this.W * 0.25, this.H / 2);
    });
  }

  // ── Combo / pearls ──────────────────────────────────────────────────────

  get comboTier() {
    if (this.combo >= TUNE.comboTier3) return 3;
    if (this.combo >= TUNE.comboTier2) return 2;
    return 1;
  }

  _gainPearls(n, x, y, viaCombo) {
    const tier = viaCombo ? this.comboTier : 1;
    const gain = Math.max(1, Math.round(n * tier * this.player.stats.pearlValue));
    this.sessionPearls += gain;
    const label = gain > 1 ? `+${gain}` : '+1';
    const color = tier === 3 ? '#ff7ad9' : tier === 2 ? PAL.gold : PAL.pearl;
    this.floaters.add(x, y - 20, label, { color, size: tier > 1 ? 19 : 15 });
    return gain;
  }

  // ── Biome progression ───────────────────────────────────────────────────

  _checkBiome(distM) {
    if (this._nextBiomeIdx >= BIOMES.length) return;
    const next = BIOMES[this._nextBiomeIdx];
    if (distM >= next.startM) {
      this._nextBiomeIdx++;
      this._currentBiome = next;
      this.bg.startTransition(BIOMES[this._nextBiomeIdx - 2] || BIOMES[0], next);
      this.banners.add(next.name, next.glowColor || PAL.cyan);
      Sound.biomeTransition();
      this.shake.add(0.35);
      this.flash.trigger(next.glowColor || '#ffffff', 0.18);
    }
  }

  // ── Death / Shop ────────────────────────────────────────────────────────

  _die() {
    this.state = 'dying';
    this.deathTimer = 850;
    this.timeScale = 0.28;
    Sound.death();
    this.shake.add(0.75);
    this.flash.trigger('#ff3b30', 0.42);
    this.particles.emit(this.player.x, this.player.y, {
      count: 28, color: '#ff7a5c', speed: 5.5, spread: Math.PI * 2, radius: 5,
    });
    this.particles.emit(this.player.x, this.player.y, {
      count: 16, color: PAL.narBody, speed: 3.8, spread: Math.PI * 2, radius: 4, shape: 'shard',
    });
  }

  _openShop() {
    this.state = 'shop';
    this.timeScale = 1;
    const distM = Math.floor(this.distPx / TUNE.pxPerMeter);
    addTotalPearls(this.sessionPearls);
    const prevBest = getBestM();
    const isNewBest = distM > prevBest;
    if (isNewBest) setBestM(distM);
    this.shop.show(distM, this.sessionPearls, Math.max(distM, prevBest), isNewBest, this.bestComboTier, this.time);
  }

  // ── Apply damage helper ─────────────────────────────────────────────────

  _applyDamage(isLaser = false) {
    const result = this.player.takeDamage();
    if (!result) return;
    if (result === 'shield') {
      Sound.shieldPop();
      this.shake.add(0.28);
      this.flash.trigger('#78dcff', 0.2);
      this.floaters.add(this.player.x, this.player.y - 32, 'SHIELD!', { color: '#78dcff', size: 15 });
      this.particles.emit(this.player.x, this.player.y, { count: 16, color: 'rgba(120,220,255,0.9)', speed: 3.8, spread: Math.PI * 2, radius: 3 });
      return;
    }
    if (isLaser) Sound.laser(); else Sound.hurt();
    this.hitstop = 75;
    this.shake.add(0.55);
    this.flash.trigger(isLaser ? '#ff4060' : '#ff3b30', 0.3);
    this.combo = 0; this.comboTimer = 0;
    this.particles.emit(this.player.x, this.player.y, { count: 12, color: '#ff5c4a', speed: 3.8, spread: Math.PI * 2, radius: 3.5 });
    this._fireRelicHook('onDamage');
    if (this.player.health <= 0) this._die();
  }

  // ── Update ──────────────────────────────────────────────────────────────

  _update(dtRaw) {
    this.time += dtRaw;

    if (this.hitstop > 0) { this.hitstop -= dtRaw; return; }

    const dt = dtRaw * this.timeScale;
    const step = dt / 16.667;
    const stepRaw = dtRaw / 16.667;

    this.shake.update(stepRaw);
    this.flash.update(stepRaw);
    this.ripples.update(stepRaw);
    this.banners.update(dtRaw);
    this.shop.update(dtRaw);
    this.hud.update(stepRaw, this.player);

    if (this.state === 'start') {
      this.bg.update(0.8, step, this.time);
      return;
    }

    if (this.state === 'relic-pick' || this.state === 'shop') {
      this.bg.update(0.5, step, this.time);
      this.particles.update(step, 0.5);
      return;
    }

    // ── 'playing' and 'dying' ──
    const distM = Math.floor(this.distPx / TUNE.pxPerMeter);

    // Adrenaline relic speed modifier.
    const adrenalineBoost = (this._adrenalineActive && this.hasRelic('adrenaline_rush')) ? 1.5 : 1;
    this.speed = Math.min(TUNE.maxSpeed,
      TUNE.baseSpeed + (this.distPx / 1000) * TUNE.speedRampPer1000px) * adrenalineBoost;

    const worldSpeed = this.player.isDashing ? this.speed * TUNE.dashSpeedMult : this.speed;

    // Biome transition lerp.
    const transSpeed = 0.0004 * step;
    this.bg.update(worldSpeed, step, this.time, transSpeed);
    this.obstacles.update(worldSpeed, step, dt, this.time, this.distPx, this._currentBiome.id);
    this.pearls.update(worldSpeed, step, this.time,
      this.state === 'playing' ? this.player : null,
      this.player.stats.magnetRadius);
    this.particles.update(step, worldSpeed);
    this.floaters.update(dt, worldSpeed, step);

    if (this.state === 'dying') {
      this.deathTimer -= dtRaw;
      if (this.deathTimer <= 0) this._openShop();
      return;
    }

    // ── Playing only ──
    this.distPx += worldSpeed * step;
    this.player.update(dt, step, worldSpeed);

    // Relic per-frame hooks.
    this._fireRelicHook('onUpdate', dt);
    if (this.hasRelic('phantom_twin')) this._updatePhantoms(step, this.speed, dt);

    // Combo decay.
    if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 0; }

    // Boundary checks.
    if (this.player.y - this.player.r < 0) {
      this.player.y = this.player.r;
      this.player.vy = Math.max(0, this.player.vy);
    }
    if (this.player.y + this.player.r > this.H) {
      this.player.y = this.H - this.player.r;
      this.player.vy = -7.5;
      this._applyDamage();
      if (this.state !== 'playing') return;
    }

    // Pearl collection.
    const { count: collected, hasGolden } = this.pearls.collect(this.player, this.time);
    if (collected > 0) {
      this.combo += collected;
      this.comboTimer = TUNE.comboWindowMs;
      this.bestComboTier = Math.max(this.bestComboTier, this.comboTier);

      const prevCombo = this.combo - collected;
      Sound.pearl(this.combo);
      if (hasGolden) Sound.goldenPearl();

      // Lucky spiral relic: 25% chance golden multiplier.
      const luckyMult = (this.hasRelic('lucky_spiral') && Math.random() < 0.25) ? 4 : 1;
      const totalGain = this._gainPearls(collected * luckyMult, this.player.x, this.player.y, true);

      this._fireRelicHook('onPearl', collected);

      // Pearl cascade relic: milestone fires.
      const crossedMilestone = Math.floor(prevCombo / 10) < Math.floor(this.combo / 10);
      if (crossedMilestone) this._fireRelicHook('onComboMilestone', this.combo);

      this.particles.emit(this.player.x + 10, this.player.y, {
        count: 6 * collected, color: hasGolden ? PAL.gold : PAL.pearl,
        speed: 2.8, spread: Math.PI * 2, radius: 2.5,
      });
    }

    // Obstacle collision.
    const hits = this.obstacles.collide(this.player);
    for (const hit of hits) {
      const canPhase = this.player.isDashing && this.hasRelic('void_passage');
      if (canPhase) continue; // phase through everything

      if (hit.kind === 'spike_wheel' && this.player.isDashing) {
        // Dashable spike wheel.
        hit.obj.gone = true;
        Sound.shatter();
        this.hitstop = 45;
        this.shake.add(0.3);
        this.flash.trigger('#ff9040', 0.14);
        this.particles.emit(hit.x, hit.y, { count: 18, color: '#a04020', speed: 4.5, spread: Math.PI * 2, radius: 4, shape: 'shard' });
        this._gainPearls(1, hit.x, hit.y, false);
        if (this.hasRelic('thirsty_tusk')) this._gainPearls(2, hit.x, hit.y, false);
      } else if (hit.kind === 'ice' && this.player.isDashing) {
        // Shatter ice.
        hit.obj.destroy(hit.part);
        Sound.shatter();
        this.hitstop = 42;
        this.shake.add(0.25);
        this.flash.trigger('#bfe8ff', 0.12);
        const iy = hit.part === 'top' ? hit.obj.topH / 2 : (hit.obj.botY + this.H) / 2;
        this.particles.emit(hit.obj.x + hit.obj.w / 2, iy, { count: 18, color: PAL.ice, speed: 4.5, spread: Math.PI * 2, radius: 5, shape: 'shard' });
        this._gainPearls(1, hit.obj.x + hit.obj.w / 2, iy, false);
        if (this.hasRelic('thirsty_tusk')) this._gainPearls(3, hit.obj.x + hit.obj.w / 2, iy, false);
      } else if (!this.player.invincible) {
        this._applyDamage(hit.kind === 'laser');
        break;
      }
    }

    // Biome transitions.
    this._checkBiome(distM);

    // Relic offers at distance milestones.
    if (this.offeredRelicDistances.length > 0 && distM >= this.offeredRelicDistances[0]) {
      this.offeredRelicDistances.shift();
      this._offerRelics();
    }

    // Distance milestones (banner + sound).
    if (distM >= this.nextMilestone) {
      this.banners.add(`${this.nextMilestone}m!`, PAL.gold);
      Sound.milestone();
      this.nextMilestone += TUNE.milestoneEveryM;
    }
    const best = getBestM();
    if (!this.announcedBest && best > 50 && distM > best) {
      this.announcedBest = true;
      this.banners.add('NEW BEST!', '#ff7ad9');
      Sound.milestone();
    }
  }

  // ── Draw ─────────────────────────────────────────────────────────────────

  _draw() {
    const ctx = this.ctx;
    const { W, H } = this;
    const distM = Math.floor(this.distPx / TUNE.pxPerMeter);

    ctx.save();
    const off = this.shake.offset();
    ctx.translate(off.x, off.y);

    this.bg.draw(ctx, this.time, distM);

    if (this.state !== 'start') {
      this.obstacles.draw(ctx, this.time, this.player.dashReady, this._currentBiome);
      this.pearls.draw(ctx, this.time);
      this.particles.draw(ctx);

      // Phantom twin ghosts.
      for (const g of this._phantomGhosts) {
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(g.angle);
        ctx.globalAlpha = g.life * 0.38;
        ctx.shadowBlur = 12;
        ctx.shadowColor = PAL.narDash;
        // Simple ghost outline.
        ctx.strokeStyle = PAL.narDash;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 25, 14, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (this.state === 'playing') this.player.draw(ctx, this.time);
      this.floaters.draw(ctx);
    }

    ctx.restore();

    this.bg.drawVignette(ctx, this._currentBiome);
    this.ripples.draw(ctx);
    this.flash.draw(ctx, W, H);

    if (this.state === 'playing' || this.state === 'dying') {
      this.hud.draw(ctx, W, H, this.player, this.sessionPearls, distM, getBestM(),
        this.combo, Math.max(0, this.comboTimer / TUNE.comboWindowMs),
        Sound.muted, this.time, this.activeRelics);
      this.banners.draw(ctx, W, H);
    } else if (this.state === 'start') {
      this.startScreen.draw(ctx, W, H, this.time);
      this.hud.drawMute(ctx, W, Sound.muted);
    } else if (this.state === 'relic-pick') {
      // Draw HUD underneath.
      this.hud.draw(ctx, W, H, this.player, this.sessionPearls, distM, getBestM(),
        this.combo, Math.max(0, this.comboTimer / TUNE.comboWindowMs),
        Sound.muted, this.time, this.activeRelics);
      this.relicPicker.draw(ctx, W, H, this.time);
    } else if (this.state === 'shop') {
      this.shop.draw(ctx, W, H, this.time);
      this.hud.drawMute(ctx, W, Sound.muted);
    }
  }

  _loop(ts) {
    const dt = Math.min(50, ts - (this.lastTs || ts));
    this.lastTs = ts;
    this._update(dt);
    this._draw();
    requestAnimationFrame(t => this._loop(t));
  }
}
