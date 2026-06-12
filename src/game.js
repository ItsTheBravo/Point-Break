import { TUNE, PAL } from './constants.js';
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

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this._resize();
    window.addEventListener('resize', () => this._resize());

    this.state = 'start'; // 'start' | 'playing' | 'dying' | 'shop'
    this.time = 0;
    this.lastTs = 0;
    this.hitstop = 0;
    this.timeScale = 1;
    this.slowmoTimer = 0;

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

    this.obstacles = new ObstacleManager(this.W, this.H);
    this.pearls = new PearlManager(this.W, this.H);

    this.shop.onRestart = () => this._startRun();
    this._resetRunVars();
    this._buildPlayer();
    this._bindInput();

    requestAnimationFrame(ts => this._loop(ts));
  }

  // ── Setup ──────────────────────────────────────────────────────

  _resize() {
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = Math.floor(this.W * this.dpr);
    this.canvas.height = Math.floor(this.H * this.dpr);
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.bg) this.bg.resize(this.W, this.H);
    if (this.obstacles) this.obstacles.resize(this.W, this.H);
    if (this.pearls) this.pearls.resize(this.W, this.H);
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
  }

  // ── Input ──────────────────────────────────────────────────────

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
        case 'playing':
          if (x < this.W / 2) {
            if (this.player.dash()) {
              Sound.dash();
              this.shake.add(0.18);
              this.ripples.add(x, y, 'rgba(57,230,255,0.6)');
              this.particles.emit(this.player.x - 22, this.player.y, {
                count: 14, color: PAL.narDash, speed: 4, spread: Math.PI * 0.7,
                angle: Math.PI, radius: 3,
              });
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
        case 'shop':
          this.shop.handleTap(x, y, this.time);
          break;
      }
    };

    this.canvas.addEventListener('pointerdown', e => {
      e.preventDefault();
      tap(e.clientX, e.clientY);
    });

    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        tap(this.W * 0.75, this.H / 2);
      } else if (e.code === 'ShiftLeft' || e.code === 'KeyX' || e.code === 'KeyA') {
        tap(this.W * 0.25, this.H / 2);
      }
    });
  }

  // ── Combo / pearls ─────────────────────────────────────────────

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
    this.floaters.add(x, y - 18, label, { color, size: tier > 1 ? 19 : 15 });
    return gain;
  }

  // ── Death ──────────────────────────────────────────────────────

  _die() {
    this.state = 'dying';
    this.deathTimer = 850;
    this.timeScale = 0.3;
    Sound.death();
    this.shake.add(0.7);
    this.flash.trigger('#ff3b30', 0.4);
    this.particles.emit(this.player.x, this.player.y, {
      count: 26, color: '#ff7a5c', speed: 5, spread: Math.PI * 2, radius: 5,
    });
    this.particles.emit(this.player.x, this.player.y, {
      count: 14, color: PAL.narBody, speed: 3.5, spread: Math.PI * 2, radius: 4, shape: 'shard',
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

  // ── Update ─────────────────────────────────────────────────────

  _update(dtRaw) {
    this.time += dtRaw;

    if (this.hitstop > 0) {
      this.hitstop -= dtRaw;
      return;
    }

    if (this.slowmoTimer > 0) {
      this.slowmoTimer -= dtRaw;
      if (this.slowmoTimer <= 0) this.timeScale = 1;
    }

    const dt = dtRaw * this.timeScale;
    const step = dt / 16.667;
    const stepRaw = dtRaw / 16.667;

    this.shake.update(stepRaw);
    this.flash.update(stepRaw);
    this.ripples.update(stepRaw);
    this.banners.update(dtRaw);
    this.shop.update(dtRaw);
    this.hud.update(stepRaw);

    if (this.state === 'start') {
      this.bg.update(0.8, step, this.time);
      return;
    }

    if (this.state === 'shop') {
      this.bg.update(0.5, step, this.time);
      this.particles.update(step, 0.5);
      return;
    }

    // 'playing' and 'dying' share world simulation.
    const distM = Math.floor(this.distPx / TUNE.pxPerMeter);
    this.speed = Math.min(TUNE.maxSpeed,
      TUNE.baseSpeed + (this.distPx / 1000) * TUNE.speedRampPer1000px);

    const worldSpeed = this.player.isDashing ? this.speed * TUNE.dashSpeedMult : this.speed;

    this.bg.update(worldSpeed, step, this.time);
    this.obstacles.update(worldSpeed, step, this.time, this.distPx);
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

    // ── Playing only below ──
    this.distPx += worldSpeed * step;
    this.player.update(dt, step, worldSpeed);

    // Combo decay.
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // Boundaries: ceiling clamps, floor hurts.
    if (this.player.y - this.player.r < 0) {
      this.player.y = this.player.r;
      this.player.vy = Math.max(0, this.player.vy);
    }
    if (this.player.y + this.player.r > this.H) {
      this.player.y = this.H - this.player.r;
      this.player.vy = -7;
      this._applyDamage();
      if (this.state !== 'playing') return;
    }

    // Pearls.
    const collected = this.pearls.collect(this.player, this.time);
    if (collected > 0) {
      this.combo += collected;
      this.comboTimer = TUNE.comboWindowMs;
      this.bestComboTier = Math.max(this.bestComboTier, this.comboTier);
      Sound.pearl(this.combo);
      this._gainPearls(collected, this.player.x, this.player.y, true);
      this.particles.emit(this.player.x + 10, this.player.y, {
        count: 6 * collected, color: PAL.pearl, speed: 2.6, spread: Math.PI * 2, radius: 2.5,
      });
    }

    // Obstacles.
    const hits = this.obstacles.collide(this.player);
    for (const hit of hits) {
      if (hit.kind === 'ice' && this.player.isDashing) {
        hit.obj.destroy(hit.part);
        Sound.shatter();
        this.hitstop = 40;
        this.shake.add(0.25);
        this.flash.trigger('#bfe8ff', 0.12);
        const iy = hit.part === 'top' ? hit.obj.topH : hit.obj.botY;
        this.particles.emit(hit.obj.x + hit.obj.w / 2, iy, {
          count: 18, color: PAL.ice, speed: 4.5, spread: Math.PI * 2, radius: 5, shape: 'shard',
        });
        this.particles.emit(hit.obj.x + hit.obj.w / 2, iy, {
          count: 8, color: '#ffffff', speed: 3, spread: Math.PI * 2, radius: 2.5,
        });
        // Smashing ice pays out — rewards aggressive play.
        this._gainPearls(1, hit.obj.x + hit.obj.w / 2, iy, false);
      } else if (!this.player.invincible) {
        this._applyDamage();
        break;
      }
    }

    // Milestones.
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

  _applyDamage() {
    const result = this.player.takeDamage();
    if (!result) return;
    if (result === 'shield') {
      Sound.shieldPop();
      this.shake.add(0.25);
      this.flash.trigger('#78dcff', 0.18);
      this.floaters.add(this.player.x, this.player.y - 30, 'SHIELD!', { color: '#78dcff', size: 15 });
      this.particles.emit(this.player.x, this.player.y, {
        count: 16, color: 'rgba(120,220,255,0.9)', speed: 3.5, spread: Math.PI * 2, radius: 3,
      });
      return;
    }
    Sound.hurt();
    this.hitstop = 70;
    this.shake.add(0.5);
    this.flash.trigger('#ff3b30', 0.28);
    this.combo = 0;
    this.comboTimer = 0;
    this.particles.emit(this.player.x, this.player.y, {
      count: 12, color: '#ff5c4a', speed: 3.5, spread: Math.PI * 2, radius: 3.5,
    });
    if (this.player.health <= 0) this._die();
  }

  // ── Draw ───────────────────────────────────────────────────────

  _draw() {
    const ctx = this.ctx;
    const { W, H } = this;
    const distM = Math.floor(this.distPx / TUNE.pxPerMeter);

    ctx.save();
    const off = this.shake.offset();
    ctx.translate(off.x, off.y);

    this.bg.draw(ctx, this.time, distM);

    if (this.state !== 'start') {
      this.obstacles.draw(ctx, this.time, this.player.dashReady);
      this.pearls.draw(ctx, this.time);
      this.particles.draw(ctx);
      if (this.state === 'playing') this.player.draw(ctx, this.time);
      this.floaters.draw(ctx);
    }

    ctx.restore();

    this.bg.drawVignette(ctx);
    this.ripples.draw(ctx);
    this.flash.draw(ctx, W, H);

    if (this.state === 'playing' || this.state === 'dying') {
      this.hud.draw(ctx, W, H, this.player, this.sessionPearls, distM, getBestM(),
        this.combo, Math.max(0, this.comboTimer / TUNE.comboWindowMs), Sound.muted, this.time);
      this.banners.draw(ctx, W, H);
    } else if (this.state === 'start') {
      this.startScreen.draw(ctx, W, H, this.time);
      this.hud.drawMute(ctx, W, Sound.muted);
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
