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
import { FLOORS, ROOM_ICONS, buildFloorMap, availableNext, advanceMap } from './floor-data.js';
import { FloorMapScreen } from './floor-map.js';
import { createBoss } from './boss.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this._resize();
    window.addEventListener('resize', () => this._resize());

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
    this.floorMapScreen = new FloorMapScreen();

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
    this.roomDistPx = 0;
    this.roomLengthPx = 0;
    this.totalMeters = 0;
    this._treasureTimer = 0;
    this.speed = TUNE.baseSpeed;
    this.sessionPearls = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestComboTier = 1;
    this.announcedBest = false;
    this.deathTimer = 0;
    this.currentRoom = null;
    this.boss = null;
    this._bossDefeatedHandled = false;
    this.roomClearTimer = 0;
    this.floorIdx = 0;
    this.mapState = null;
    this.cycleN = 0;

    this.activeRelics = [];
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

  // ── Run lifecycle ───────────────────────────────────────────────────────

  _startRun() {
    this._resetRunVars();
    this._buildPlayer();
    this.obstacles.reset();
    this.pearls.reset();
    this.particles.reset();
    this.floaters.items = [];
    this._currentBiome = BIOMES[0];
    this.bg.startTransition(BIOMES[0], BIOMES[0]);
    this.floorIdx = 0;
    this.mapState = buildFloorMap(FLOORS[0]);
    this.state = 'map';
    this.floorMapScreen.open(this.time);
  }

  _startFloor(idx) {
    this.floorIdx = idx;
    const floor = FLOORS[idx];
    this.mapState = buildFloorMap(floor);
    this._currentBiome = BIOMES[floor.biomeIdx];
    this.bg.startTransition(this._currentBiome, this._currentBiome);
    this.banners.add(floor.name, this._currentBiome.glowColor || PAL.cyan);
    Sound.biomeTransition();
    this.state = 'map';
    this.floorMapScreen.open(this.time);
  }

  _openMap() {
    this.state = 'map';
    this.floorMapScreen.open(this.time);
    this.obstacles.items = [];
    this.obstacles.spawnQueue = [];
    this.pearls.items = [];
    this.boss = null;
    this._bossDefeatedHandled = false;
  }

  _enterRoom(layer, idx) {
    const floor = FLOORS[this.floorIdx];
    const room = floor.layers[layer][idx];
    advanceMap(this.mapState, layer, idx);

    this.currentRoom = room;
    this.roomDistPx = 0;
    this.roomLengthPx = (room.lengthM || 0) * TUNE.pxPerMeter;

    const cycleScale = 1 + this.cycleN * 0.25;
    this.speed = floor.baseSpeed * cycleScale;

    this._currentBiome = BIOMES[floor.biomeIdx];
    this.bg.startTransition(this._currentBiome, this._currentBiome);

    this.obstacles.setRoomMode(room.type, floor.baseDifficulty);
    this.obstacles.resetForRoom();
    this.pearls.reset();

    if (room.type === 'boss') {
      this.boss = createBoss(floor.bossName, this.W, this.H);
      this._bossDefeatedHandled = false;
    } else {
      this.boss = null;
      this._bossDefeatedHandled = false;
      if (room.type === 'treasure') {
        this._treasureTimer = 0;
        // Spread pearls across the entire visible screen — CotL floating room feel.
        for (let i = 0; i < 38; i++) {
          const golden = Math.random() < 0.22;
          this.pearls._spawnAt(
            60 + Math.random() * (this.W - 120),
            55 + Math.random() * (this.H - 110),
            golden
          );
        }
      }
    }

    // Reset player position, brief entry invincibility.
    this.player.y = this.H / 2;
    this.player.vy = 0;
    this.player.angle = 0;
    this.player.invincibleTimer = Math.max(this.player.invincibleTimer, 750);

    const icon = ROOM_ICONS[room.type];
    this.banners.add(icon ? icon.label : room.type.toUpperCase(), icon?.color || PAL.cyan);
    this.state = 'playing';
  }

  // ── Room clear / floor clear / victory ─────────────────────────────────

  _roomClear() {
    if (this.state !== 'playing') return;
    this.state = 'room-clear';
    this.roomClearTimer = this.currentRoom.type === 'boss' ? 2600 : 1800;
    Sound.milestone();
    this.shake.add(0.4);
    this.flash.trigger(PAL.good, 0.22);
    this.banners.add('CLEAR!', PAL.good);
    this.particles.emit(this.W / 2, this.H / 2, {
      count: 30, color: PAL.pearl, speed: 3.8, spread: Math.PI * 2, radius: 3.5,
    });
  }

  _floorClear() {
    const isLast = this.floorIdx >= FLOORS.length - 1;
    this.banners.add(`FLOOR ${this.floorIdx + 1} CLEAR!`, '#ffd866');
    this.shake.add(0.65);
    this.flash.trigger('#ffd866', 0.38);

    if (isLast) {
      this._offerRelics(() => this._showVictory());
    } else {
      this._offerRelics(() => this._startFloor(this.floorIdx + 1));
    }
  }

  _showVictory() {
    this.state = 'victory';
    addTotalPearls(this.sessionPearls);
    const distM = Math.floor(this.totalMeters / TUNE.pxPerMeter);
    const prev = getBestM();
    if (distM > prev) setBestM(distM);
    Sound.milestone();
    this.shake.add(0.9);
    this.flash.trigger('#ffd866', 0.55);
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        this.particles.emit(
          this.W * (0.18 + Math.random() * 0.64),
          this.H * (0.15 + Math.random() * 0.45),
          { count: 28, color: i % 2 === 0 ? '#ffd866' : '#ff3b60', speed: 5.5, spread: Math.PI * 2, radius: 4.5 }
        );
      }, i * 190);
    }
  }

  // ── Relic helpers ───────────────────────────────────────────────────────

  hasRelic(id) { return this.activeRelics.some(r => r === RELICS[id]); }

  _fireRelicHook(hook, ...args) {
    for (const relic of this.activeRelics) {
      if (relic[hook]) relic[hook](this, ...args);
    }
  }

  _offerRelics(onDone) {
    const choices = pickRelicChoices(this.activeRelics, 3);
    if (choices.length === 0) { if (onDone) onDone(); return; }
    this.state = 'relic-pick';
    Sound.relicOffer();
    this.relicPicker.show(choices, (chosen) => {
      this.activeRelics.push(chosen);
      if (chosen.apply) chosen.apply(this);
      Sound.relicPick();
      this.flash.trigger(PAL.gold, 0.2);
      this.banners.add(`${chosen.name}!`, PAL.gold);
      if (onDone) onDone();
      else this.state = 'playing';
    }, this.time);
  }

  // ── Phantom twin ────────────────────────────────────────────────────────

  _spawnPhantom() {
    this._phantomGhosts.push({
      x: this.player.x, y: this.player.y,
      life: 1.2, angle: this.player.angle,
    });
  }

  _updatePhantoms(step, speed, dt) {
    for (const g of this._phantomGhosts) {
      g.x += speed * TUNE.dashSpeedMult * step;
      g.life -= dt / 1000;
      for (const p of this.pearls.items) {
        if (p.collected) continue;
        const dx = p.x - g.x, dy = p.y - g.y;
        if (dx * dx + dy * dy < (p.r + 20) ** 2) {
          p.collected = true;
          this._gainPearls(1, p.x, p.y, false);
        }
      }
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

        case 'map': {
          const sel = this.floorMapScreen.handleTap(x, y, this.mapState, this.time);
          if (sel) {
            Sound.tap();
            this._enterRoom(sel.layer, sel.idx);
          }
          break;
        }

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

        case 'victory':
          this._loopVictory();
          break;
      }
    };

    const move = (x, y) => {
      if (this.state === 'relic-pick') this.relicPicker.handleMove(x, y);
      if (this.state === 'map') this.floorMapScreen.handleMove(x, y, this.mapState);
    };

    this.canvas.addEventListener('pointerdown', e => { e.preventDefault(); tap(e.clientX, e.clientY); });
    this.canvas.addEventListener('pointermove', e => { move(e.clientX, e.clientY); });

    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) tap(this.W * 0.75, this.H / 2);
      else if (['ShiftLeft', 'KeyX', 'KeyA'].includes(e.code)) tap(this.W * 0.25, this.H / 2);
    });
  }

  _loopVictory() {
    // Keep relics, full health, increment loop counter.
    this.cycleN++;
    this.sessionPearls = 0;
    this.roomDistPx = 0;
    this.totalMeters = 0;
    this.combo = 0; this.comboTimer = 0;
    this.bestComboTier = 1;
    this.announcedBest = false;
    this._buildPlayer();
    this.obstacles.reset();
    this.pearls.reset();
    this.particles.reset();
    this.floaters.items = [];
    this.boss = null;
    this._bossDefeatedHandled = false;
    this.floorIdx = 0;
    this.mapState = buildFloorMap(FLOORS[0]);
    this._currentBiome = BIOMES[0];
    this.bg.startTransition(BIOMES[0], BIOMES[0]);
    this.state = 'map';
    this.floorMapScreen.open(this.time);
    this.banners.add(`LOOP ${this.cycleN + 1}`, '#ff7ad9');
    Sound.biomeTransition();
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

  // ── Death / Shop ────────────────────────────────────────────────────────

  _die() {
    if (this.state !== 'playing') return;
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
    const distM = Math.floor(this.totalMeters / TUNE.pxPerMeter);
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

    if (this.state === 'map') {
      this.bg.update(0.3, step, this.time);
      return;
    }

    if (this.state === 'victory') {
      this.particles.update(step, 0);
      return;
    }

    if (this.state === 'relic-pick' || this.state === 'shop') {
      this.bg.update(0.5, step, this.time);
      this.particles.update(step, 0.4);
      return;
    }

    // ── playing, room-clear, dying ──
    const floor = FLOORS[this.floorIdx] || FLOORS[0];
    const cycleScale = 1 + this.cycleN * 0.25;
    const adrenalineBoost = (this._adrenalineActive && this.hasRelic('adrenaline_rush')) ? 1.5 : 1;
    this.speed = Math.min(TUNE.maxSpeed,
      floor.baseSpeed * cycleScale + (this.roomDistPx / 1000) * TUNE.speedRampPer1000px
    ) * adrenalineBoost;

    if (this.state === 'room-clear') {
      this.speed = Math.max(0, this.speed * Math.pow(0.93, stepRaw));
      const ws = this.speed;
      this.bg.update(ws, step, this.time);
      this.particles.update(step, ws * 0.3);
      this.floaters.update(dt, 0, step);
      this.roomClearTimer -= dtRaw;
      if (this.roomClearTimer <= 0) {
        if (this.currentRoom.type === 'boss') this._floorClear();
        else this._openMap();
      }
      return;
    }

    const isTreasure = this.currentRoom?.type === 'treasure';
    // Treasure rooms: near-zero scroll for a calm floating feel.
    const scrollMult = isTreasure ? 0.12 : 1;
    const worldSpeed = (this.player.isDashing ? this.speed * TUNE.dashSpeedMult : this.speed) * scrollMult;
    const biomeId = this._currentBiome?.id || 'reef';

    this.bg.update(worldSpeed, step, this.time);
    this.obstacles.update(worldSpeed, step, dt, this.time, this.roomDistPx, biomeId);
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
    this.roomDistPx += worldSpeed * step;
    this.totalMeters += worldSpeed * step;

    // Treasure room: reduce gravity for buoyant floating feel.
    if (isTreasure) {
      this.player.vy = Math.min(this.player.vy, 3.2);
      this.player.vy -= 0.07; // gentle upward buoyancy
    }

    this.player.update(dt, step, worldSpeed);

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

    // Boss update.
    if (this.boss) {
      this.boss.update(dt, step, this.player, this);
      if (this.boss.defeated && !this._bossDefeatedHandled) {
        this._bossDefeatedHandled = true;
        this.banners.add(`${FLOORS[this.floorIdx].bossName} DEFEATED!`, '#ff3b60');
        setTimeout(() => this._roomClear(), 1800);
      }
    }

    // Pearl collection.
    const { count: collected, hasGolden } = this.pearls.collect(this.player, this.time);
    if (collected > 0) {
      this.combo += collected;
      this.comboTimer = TUNE.comboWindowMs;
      this.bestComboTier = Math.max(this.bestComboTier, this.comboTier);
      Sound.pearl(this.combo);
      if (hasGolden) Sound.goldenPearl();
      const luckyMult = (this.hasRelic('lucky_spiral') && Math.random() < 0.25) ? 4 : 1;
      this._gainPearls(collected * luckyMult, this.player.x, this.player.y, true);
      this._fireRelicHook('onPearl', collected);
      const prevCombo = this.combo - collected;
      const crossedMilestone = Math.floor(prevCombo / 10) < Math.floor(this.combo / 10);
      if (crossedMilestone) this._fireRelicHook('onComboMilestone', this.combo);
      this.particles.emit(this.player.x + 10, this.player.y, {
        count: 6 * collected, color: hasGolden ? PAL.gold : PAL.pearl,
        speed: 2.8, spread: Math.PI * 2, radius: 2.5,
      });
    }

    // Obstacle collision (not during boss rooms — boss handles its own).
    if (!this.boss) {
      const hits = this.obstacles.collide(this.player);
      for (const hit of hits) {
        const canPhase = this.player.isDashing && this.hasRelic('void_passage');
        if (canPhase) continue;

        if (hit.kind === 'spike_wheel' && this.player.isDashing) {
          hit.obj.gone = true;
          Sound.shatter();
          this.hitstop = 45;
          this.shake.add(0.3);
          this.flash.trigger('#ff9040', 0.14);
          this.particles.emit(hit.x, hit.y, { count: 18, color: '#a04020', speed: 4.5, spread: Math.PI * 2, radius: 4, shape: 'shard' });
          this._gainPearls(1, hit.x, hit.y, false);
          if (this.hasRelic('thirsty_tusk')) this._gainPearls(2, hit.x, hit.y, false);
        } else if (hit.kind === 'ice' && this.player.isDashing) {
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
    }

    // Treasure room: timer-based end + trickle in more pearls.
    if (isTreasure) {
      const TREASURE_DUR = 20000;
      this._treasureTimer += dtRaw;
      // Trickle in fresh pearls as others get collected.
      if (Math.random() < 0.015 && this.pearls.items.filter(p => !p.collected).length < 18) {
        this.pearls._spawnAt(
          this.W * (0.55 + Math.random() * 0.35),
          60 + Math.random() * (this.H - 120),
          Math.random() < 0.2
        );
      }
      if (this._treasureTimer >= TREASURE_DUR) this._roomClear();
      return;
    }

    // Room clear check (non-boss rooms).
    if (this.currentRoom && this.currentRoom.type !== 'boss' && this.roomDistPx >= this.roomLengthPx) {
      this._roomClear();
    }
  }

  // ── Draw ─────────────────────────────────────────────────────────────────

  _draw() {
    const ctx = this.ctx;
    const { W, H } = this;
    const roomDistM = Math.floor(this.roomDistPx / TUNE.pxPerMeter);
    const totalDistM = Math.floor(this.totalMeters / TUNE.pxPerMeter);

    ctx.save();
    const off = this.shake.offset();
    ctx.translate(off.x, off.y);

    this.bg.draw(ctx, this.time, totalDistM);

    if (this.state === 'start') {
      // nothing extra behind start screen
    } else if (this.state === 'map') {
      this.floorMapScreen.draw(ctx, W, H, this.mapState, this.time, this.cycleN);
    } else if (this.state === 'victory') {
      this._drawVictory(ctx, W, H);
    } else if (this.state !== 'shop') {
      // playing, room-clear, dying, relic-pick
      this.obstacles.draw(ctx, this.time, this.player.dashReady, this._currentBiome);
      this.pearls.draw(ctx, this.time);
      if (this.boss) this.boss.draw(ctx, this.time, W, H);
      this.particles.draw(ctx);

      // Phantom twin ghosts.
      for (const g of this._phantomGhosts) {
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(g.angle);
        ctx.globalAlpha = g.life * 0.38;
        ctx.shadowBlur = 12; ctx.shadowColor = PAL.narDash;
        ctx.strokeStyle = PAL.narDash; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, 0, 25, 14, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      const showPlayer = this.state === 'playing' || this.state === 'room-clear' || this.state === 'dying';
      if (showPlayer) this.player.draw(ctx, this.time);
      this.floaters.draw(ctx);
    }

    ctx.restore();

    this.bg.drawVignette(ctx, this._currentBiome);
    this.ripples.draw(ctx);
    this.flash.draw(ctx, W, H);

    // ── HUD overlays ──
    const inGame = this.state === 'playing' || this.state === 'dying' || this.state === 'room-clear';
    if (inGame) {
      const icon = this.currentRoom ? ROOM_ICONS[this.currentRoom.type] : null;
      const isTreas = this.currentRoom?.type === 'treasure';
      const roomInfo = this.currentRoom ? {
        floorNum: this.floorIdx + 1,
        roomLabel: icon?.label || this.currentRoom.type.toUpperCase(),
        roomDistM: isTreas ? Math.ceil(Math.max(0, 20000 - this._treasureTimer) / 1000) : roomDistM,
        roomLengthM: isTreas ? 20 : (this.currentRoom.lengthM || 0),
        isTreasure: isTreas,
      } : null;
      this.hud.draw(ctx, W, H, this.player, this.sessionPearls, totalDistM, getBestM(),
        this.combo, Math.max(0, this.comboTimer / TUNE.comboWindowMs),
        Sound.muted, this.time, this.activeRelics, roomInfo);
      this.banners.draw(ctx, W, H);
    } else if (this.state === 'start') {
      this.startScreen.draw(ctx, W, H, this.time);
      this.hud.drawMute(ctx, W, Sound.muted);
    } else if (this.state === 'map') {
      this.hud.drawMute(ctx, W, Sound.muted);
      this.banners.draw(ctx, W, H);
    } else if (this.state === 'relic-pick') {
      const icon = this.currentRoom ? ROOM_ICONS[this.currentRoom.type] : null;
      const roomInfo = this.currentRoom ? {
        floorNum: this.floorIdx + 1,
        roomLabel: icon?.label || this.currentRoom.type.toUpperCase(),
        roomDistM, roomLengthM: this.currentRoom.lengthM || 0,
      } : null;
      this.hud.draw(ctx, W, H, this.player, this.sessionPearls, totalDistM, getBestM(),
        this.combo, 0, Sound.muted, this.time, this.activeRelics, roomInfo);
      this.relicPicker.draw(ctx, W, H, this.time);
    } else if (this.state === 'shop') {
      this.shop.draw(ctx, W, H, this.time);
      this.hud.drawMute(ctx, W, Sound.muted);
    } else if (this.state === 'victory') {
      this.particles.draw(ctx);
      this.banners.draw(ctx, W, H);
      this.hud.drawMute(ctx, W, Sound.muted);
    }
  }

  _drawVictory(ctx, W, H) {
    ctx.fillStyle = 'rgba(2,8,18,0.88)';
    ctx.fillRect(0, 0, W, H);

    // Stars sparkle
    for (let i = 0; i < 18; i++) {
      const sx = (Math.sin(i * 2.3 + this.time / 800) * 0.5 + 0.5) * W;
      const sy = (Math.cos(i * 1.7 + this.time / 600) * 0.5 + 0.5) * H;
      const sr = 1.5 + Math.sin(this.time / 200 + i) * 1.2;
      ctx.fillStyle = `rgba(255,220,100,${0.4 + Math.sin(this.time / 300 + i) * 0.3})`;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    }

    // Title
    ctx.textAlign = 'center';
    ctx.save();
    ctx.shadowBlur = 30; ctx.shadowColor = '#ffd866';
    ctx.font = "bold 44px 'Courier New', monospace";
    ctx.fillStyle = '#ffd866';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 7;
    ctx.strokeText('VICTORY!', W / 2, H * 0.3);
    ctx.fillText('VICTORY!', W / 2, H * 0.3);
    ctx.restore();

    ctx.font = "bold 16px 'Courier New', monospace";
    ctx.fillStyle = '#cfe8ff';
    ctx.fillText('ALL 3 FLOORS CLEARED', W / 2, H * 0.3 + 42);

    if (this.cycleN > 0) {
      ctx.font = "bold 13px 'Courier New', monospace";
      ctx.fillStyle = '#ff7ad9';
      ctx.fillText(`LOOP ${this.cycleN + 1} COMPLETE!`, W / 2, H * 0.3 + 66);
    }

    // Stats
    const distM = Math.floor(this.totalMeters / TUNE.pxPerMeter);
    const statsY = H * 0.52;
    const lines = [
      [`${distM}m`, 'TRAVELED'],
      [`${this.sessionPearls}`, 'PEARLS COLLECTED'],
      [`${this.activeRelics.length}`, 'RELICS HELD'],
    ];
    ctx.font = "13px 'Courier New', monospace";
    for (let i = 0; i < lines.length; i++) {
      ctx.fillStyle = '#ffd866';
      ctx.fillText(lines[i][0], W / 2, statsY + i * 30);
      ctx.fillStyle = 'rgba(140,185,220,0.75)';
      ctx.fillText(lines[i][1], W / 2, statsY + i * 30 + 14);
    }

    // Continue prompt
    const pulse = 0.6 + Math.sin(this.time / 360) * 0.3;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.font = "bold 14px 'Courier New', monospace";
    ctx.fillStyle = '#ffd866';
    ctx.fillText('TAP TO CONTINUE  ·  LOOP ∞', W / 2, H * 0.82);
    ctx.restore();
  }

  _loop(ts) {
    const dt = Math.min(50, ts - (this.lastTs || ts));
    this.lastTs = ts;
    this._update(dt);
    this._draw();
    requestAnimationFrame(t => this._loop(t));
  }
}
