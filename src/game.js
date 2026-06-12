import { TUNE, PAL, BIOMES } from './constants.js';
import { buildStats, addTotalPearls, getBestM, setBestM, bumpStat, maxStat } from './storage.js';
import { checkNewUnlocks } from './unlocks.js';
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
import { RELICS, RARITY, pickRelicChoices } from './relics.js';
import { RelicPicker } from './relic-picker.js';
import { FLOORS, ROOM_ICONS, buildFloorMap, advanceMap } from './floor-data.js';
import { FloorMapScreen } from './floor-map.js';
import { createBoss } from './boss.js';
import { ChoiceScreen } from './choice-screen.js';
import { RunShop } from './run-shop.js';
import { ClassSelect, CLASSES } from './class-select.js';

const TREASURE_DUR = 20000;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this._resize();
    window.addEventListener('resize', () => this._resize());

    // States: start | class-select | map | playing | room-clear | relic-pick | run-shop |
    //         choice | victory | dying | shop
    this.state = 'start';
    this.time = 0;
    this.lastTs = 0;
    this.hitstop = 0;
    this.timeScale = 1;
    this.paused = false;
    this._zoom = 1;
    this._bossIntro = 0;
    this._roomStartPearls = 0;

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
    this.choiceScreen = new ChoiceScreen();
    this.runShop = new RunShop();
    this.classSelect = new ClassSelect();

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
    this._roomReward = null;
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
    this._secondWindUsed = false;
    this._comboWindowBonus = 0;
    this._playerClass = null;
    this._moonShellCounter = 0;
    this._runMaxCombo = 0;
  }

  _buildPlayer() {
    this.player = new Player(this.W * 0.24, this.H / 2, buildStats());
  }

  get comboWindow() { return TUNE.comboWindowMs + (this._comboWindowBonus || 0); }

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
    this.state = 'class-select';
    this.classSelect.open((cls) => {
      bumpStat('runs');
      this._applyClass(cls);
      this.floorIdx = 0;
      this.mapState = buildFloorMap(FLOORS[0]);
      this.state = 'map';
      this.floorMapScreen.open(this.time);
      this.banners.add(cls.name, cls.color);
      Sound.tap();
    }, this.time);
  }

  _applyClass(cls) {
    this._playerClass = cls;
    for (const id of cls.startingRelicIds) {
      const relic = RELICS[id];
      if (relic && !this.activeRelics.includes(relic)) {
        this.activeRelics.push(relic);
        if (relic.apply) relic.apply(this);
      }
    }
    this._applyClassStatMods(cls);
    this.sessionPearls += cls.startPearls || 0;
    this.player.shield += cls.startShield || 0;
  }

  _applyClassStatMods(cls) {
    if (!cls) return;
    if (cls.statMods.dashCooldown != null)
      this.player.stats.dashCooldown *= cls.statMods.dashCooldown;
    if (cls.statMods.maxHealth != null) {
      this.player.stats.maxHealth += cls.statMods.maxHealth;
      this.player.health = Math.max(1, Math.min(this.player.health + cls.statMods.maxHealth, this.player.stats.maxHealth));
    }
    if (cls.statMods.magnetRadius != null)
      this.player.stats.magnetRadius += cls.statMods.magnetRadius;
    if (cls.statMods.pearlValue != null)
      this.player.stats.pearlValue *= cls.statMods.pearlValue;
  }

  _startFloor(idx) {
    this.floorIdx = idx;
    const floor = FLOORS[idx];
    this.mapState = buildFloorMap(floor);
    this._currentBiome = BIOMES[floor.biomeIdx];
    this.bg.startTransition(this._currentBiome, this._currentBiome);
    this.banners.add(floor.name, this._currentBiome.glowColor || PAL.cyan);
    Sound.biomeTransition();
    this._fireRelicHook('onFloorStart');
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

  // ── Room entry dispatch ─────────────────────────────────────────────────

  _enterRoom(layer, idx) {
    // Rooms live on the generated map, not the static floor config.
    const floor = this.mapState.floor;
    const room = floor.layers[layer][idx];
    advanceMap(this.mapState, layer, idx);
    this.currentRoom = room;

    switch (room.type) {
      case 'shop':  this._openRunShop(); return;
      case 'rest':  this._openRest();    return;
      case 'event': this._openEvent();   return;
      default:      this._startRoomPlay(room);
    }
  }

  _startRoomPlay(room) {
    const floor = FLOORS[this.floorIdx];
    this.currentRoom = room;
    this.roomDistPx = 0;
    this.roomLengthPx = (room.lengthM || 0) * TUNE.pxPerMeter;
    // Relics come from danger: elites and bosses (plus shops/events).
    // Treasure rooms are pearls-only so safe routes don't dominate.
    this._roomReward = room.type === 'elite' ? 'relic' : null;

    const cycleScale = 1 + this.cycleN * 0.25;
    this.speed = floor.baseSpeed * cycleScale;
    this._roomStartPearls = this.sessionPearls;

    this._currentBiome = BIOMES[floor.biomeIdx];
    this.bg.startTransition(this._currentBiome, this._currentBiome);

    const diff = room.type === 'elite'
      ? Math.min(1, floor.baseDifficulty + 0.25)
      : floor.baseDifficulty;
    this.obstacles.setRoomMode(room.type, diff);
    this.obstacles.resetForRoom();
    this.pearls.reset();

    if (room.type === 'boss') {
      this.boss = createBoss(floor.bossName, this.W, this.H);
      this._bossDefeatedHandled = false;
      this._bossIntro = 2200;
    } else {
      this.boss = null;
      this._bossDefeatedHandled = false;
      if (room.type === 'treasure') {
        this._treasureTimer = 0;
        // Spread pearls to the RIGHT of the player so all are reachable.
        for (let i = 0; i < 26; i++) {
          const golden = Math.random() < 0.12;
          this.pearls._spawnAt(
            this.player.x + 60 + Math.random() * (this.W - this.player.x - 120),
            55 + Math.random() * (this.H - 110),
            golden
          );
        }
      }
    }

    this.player.y = this.H / 2;
    this.player.vy = 0;
    this.player.angle = 0;
    this.player.invincibleTimer = Math.max(this.player.invincibleTimer, 750);

    const icon = ROOM_ICONS[room.type];
    this.banners.add(
      room.ambush ? 'AMBUSH!' : (icon ? icon.label : room.type.toUpperCase()),
      room.ambush ? PAL.danger : (icon?.color || PAL.cyan)
    );
    this.state = 'playing';
  }

  // ── Shop node ───────────────────────────────────────────────────────────

  _openRunShop() {
    const relics = pickRelicChoices(this.activeRelics, 3);
    const items = relics.map(r => ({
      kind: 'relic', relic: r, name: r.name, desc: r.desc,
      price: RARITY[r.rarity].price, rarity: r.rarity, sold: false,
    }));
    items.push({ kind: 'heal',   name: 'Kelp Wrap',    desc: 'Restore 2 HP',      price: 30, sold: false });
    items.push({ kind: 'shield', name: 'Bubble Charm', desc: '+1 bubble shield',  price: 35, sold: false });

    this.runShop.show(items, (item) => {
      if (this.sessionPearls < item.price) { Sound.deny(); return false; }
      if (item.kind === 'heal' && this.player.health >= this.player.stats.maxHealth) {
        Sound.deny(); return false;
      }
      this.sessionPearls -= item.price;
      if (item.kind === 'relic') {
        this.activeRelics.push(item.relic);
        maxStat('mostRelics', this.activeRelics.length);
        if (item.relic.apply) item.relic.apply(this);
        this.banners.add(`${item.relic.name}!`, PAL.gold);
      } else if (item.kind === 'heal') {
        this.player.health = Math.min(this.player.stats.maxHealth, this.player.health + 2);
      } else if (item.kind === 'shield') {
        this.player.shield++;
      }
      Sound.buy();
      return true;
    }, () => {
      Sound.tap();
      this._openMap();
    }, this.time);

    this.state = 'run-shop';
  }

  // ── Rest node ───────────────────────────────────────────────────────────

  _openRest() {
    this.choiceScreen.show('CALM CURRENT', 'A safe pocket in the reef. Catch your breath.', [
      { label: 'DEEP REST',  desc: 'Restore 3 HP.', color: '#ff7ab0' },
      { label: 'TOUGHEN UP', desc: '+1 max HP (and heal 1).', color: PAL.danger },
      { label: 'TUSK TUNING', desc: 'Dash cooldown −20% for this run.', color: PAL.cyan },
    ], (i) => {
      Sound.buy();
      if (i === 0) {
        this.player.health = Math.min(this.player.stats.maxHealth, this.player.health + 3);
        this.banners.add('+3 HP', '#ff7ab0');
      } else if (i === 1) {
        this.player.stats.maxHealth++;
        this.player.health++;
        this.banners.add('+1 MAX HP', PAL.danger);
      } else {
        this.player.stats.dashCooldown *= 0.8;
        this.banners.add('DASH TUNED', PAL.cyan);
      }
      this._openMap();
    }, this.time);
    this.state = 'choice';
  }

  // ── Event node ──────────────────────────────────────────────────────────

  _openEvent() {
    const events = [
      {
        title: 'SUNKEN WRECK',
        subtitle: 'An old hull, dark inside. Something glints…',
        risk: { label: 'DIVE IN', desc: '45% find a relic — 55% lose 2 HP to a moray.', color: '#c084fc' },
        safe: { label: 'SCAVENGE OUTSIDE', desc: 'Safely gather +25 pearls.', color: PAL.good },
        onRisk: () => {
          if (Math.random() < 0.45) {
            this.banners.add('RELIC FOUND!', PAL.gold);
            this._offerRelics(() => this._openMap());
            return true; // handled own transition
          }
          this.player.health = Math.max(1, this.player.health - 2);
          this.banners.add('MORAY BITE! −2 HP', PAL.danger);
          this.shake.add(0.5);
          this.flash.trigger(PAL.danger, 0.3);
          return false;
        },
        onSafe: () => { this._gainPearls(25, this.W / 2, this.H / 2, false); },
      },
      {
        title: 'GLOWING SCHOOL',
        subtitle: 'A shimmering school of fish darts into the dark.',
        risk: { label: 'FOLLOW THEM', desc: '50% they lead to +60 pearls — 50% it\'s an ambush.', color: '#c084fc' },
        safe: { label: 'LET THEM GO', desc: 'Snack on stragglers: +20 pearls.', color: PAL.good },
        onRisk: () => {
          if (Math.random() < 0.5) {
            this._gainPearls(60, this.W / 2, this.H / 2, false);
            this.banners.add('JACKPOT! +60', PAL.gold);
            return false;
          }
          this.banners.add('IT\'S A TRAP!', PAL.danger);
          this._startRoomPlay({ type: 'combat', lengthM: 30, ambush: true });
          return true; // handled own transition
        },
        onSafe: () => { this._gainPearls(20, this.W / 2, this.H / 2, false); },
      },
      {
        title: 'WHIRLPOOL',
        subtitle: 'A spinning vortex hums with strange energy.',
        risk: { label: 'RIDE IT', desc: '50% emerge restored (+2 HP, +20 pearls) — 50% take 1 HP.', color: '#c084fc' },
        safe: { label: 'SWIM AROUND', desc: 'Pass by safely. Nothing gained.', color: PAL.good },
        onRisk: () => {
          if (Math.random() < 0.5) {
            this.player.health = Math.min(this.player.stats.maxHealth, this.player.health + 2);
            this._gainPearls(20, this.W / 2, this.H / 2, false);
            this.banners.add('REVITALIZED!', PAL.good);
          } else {
            this.player.health = Math.max(1, this.player.health - 1);
            this.banners.add('BATTERED! −1 HP', PAL.danger);
            this.shake.add(0.4);
          }
          return false;
        },
        onSafe: () => {},
      },
    ];

    const ev = events[Math.floor(Math.random() * events.length)];
    this.choiceScreen.show(ev.title, ev.subtitle, [ev.risk, ev.safe], (i) => {
      Sound.tap();
      const handled = i === 0 ? ev.onRisk() : (ev.onSafe(), false);
      if (!handled) this._openMap();
    }, this.time);
    this.state = 'choice';
  }

  // ── Room clear / floor clear / victory ─────────────────────────────────

  _roomClear() {
    if (this.state !== 'playing') return;
    this.state = 'room-clear';
    this.roomClearTimer = this.currentRoom.type === 'boss' ? 2600 : 1800;
    Sound.milestone();
    this.shake.add(0.4);
    this.flash.trigger(PAL.good, 0.22);
    // Danger pays: clear bonus for fighting through instead of floating.
    const bonusByType = { combat: 12, elite: 30 };
    const bonus = this.currentRoom.ambush ? 20 : (bonusByType[this.currentRoom.type] || 0);
    if (bonus > 0) this._gainPearls(bonus, this.W / 2, this.H * 0.4, false);
    const earned = this.sessionPearls - this._roomStartPearls;
    this.banners.add(earned > 0 ? `CLEAR!  +${earned} PEARLS` : 'CLEAR!', PAL.good);
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
    this._bankedAtEnd = Math.round(this.sessionPearls * 0.5);
    addTotalPearls(this._bankedAtEnd);
    bumpStat('wins');
    bumpStat('banked', this._bankedAtEnd);
    maxStat('bestCombo', this._runMaxCombo || 0);
    const freshUnlocks = checkNewUnlocks();
    for (const u of freshUnlocks) this.banners.add(`UNLOCKED: ${u.name}`, PAL.gold);
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
      maxStat('mostRelics', this.activeRelics.length);
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

      if (this.state === 'playing' && this.hud.inPause(x, y)) {
        this.paused = !this.paused;
        Sound.tap();
        return;
      }
      if (this.paused) {
        this.paused = false;
        Sound.tap();
        return;
      }

      switch (this.state) {
        case 'start':
          Sound.tap();
          this._startRun();
          break;

        case 'class-select':
          this.classSelect.handleTap(x, y, this.time);
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

        case 'run-shop':
          this.runShop.handleTap(x, y, this.time);
          break;

        case 'choice':
          this.choiceScreen.handleTap(x, y, this.time);
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
      if (this.state === 'choice') this.choiceScreen.handleMove(x, y);
      if (this.state === 'class-select') this.classSelect.handleMove(x, y);
    };

    this.canvas.addEventListener('pointerdown', e => { e.preventDefault(); tap(e.clientX, e.clientY); });
    this.canvas.addEventListener('pointermove', e => { move(e.clientX, e.clientY); });

    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      if (e.code === 'KeyP' && this.state === 'playing') { this.paused = !this.paused; return; }
      if (this.state === 'class-select') {
        const n = parseInt(e.key);
        if (n >= 1 && n <= CLASSES.length) { this.classSelect.handleKey(n - 1); return; }
      }
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
    this._secondWindUsed = false;
    this._comboWindowBonus = 0;
    this._buildPlayer();
    // Re-apply held relics' stat effects to the fresh player.
    for (const r of this.activeRelics) { if (r.apply) r.apply(this); }
    // Re-apply class stat mods (not covered by relic hooks).
    this._applyClassStatMods(this._playerClass);
    if (this._playerClass) this.player.shield += this._playerClass.startShield || 0;
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
    let t = 1;
    if (this.combo >= TUNE.comboTier3) t = 3;
    else if (this.combo >= TUNE.comboTier2) t = 2;
    if (this.hasRelic('king_tide')) t = Math.min(3, t + 1);
    return t;
  }

  _gainPearls(n, x, y, viaCombo) {
    const tier = viaCombo ? this.comboTier : 1;
    const pressure = (this.hasRelic('pressure_pearl') && this.player.health <= 2) ? 2 : 1;
    const gain = Math.max(1, Math.round(n * tier * pressure * this.player.stats.pearlValue));
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
    const banked = Math.round(this.sessionPearls * 0.5);
    addTotalPearls(banked);
    bumpStat('banked', banked);
    maxStat('bestCombo', this._runMaxCombo || 0);
    const prevBest = getBestM();
    const isNewBest = distM > prevBest;
    if (isNewBest) setBestM(distM);
    const freshUnlocks = checkNewUnlocks();
    this.shop.show(distM, banked, Math.max(distM, prevBest), isNewBest, this.bestComboTier, this.time, freshUnlocks);
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
    bumpStat('hits');
    this.hitstop = 75;
    this.shake.add(0.55);
    this.flash.trigger(isLaser ? '#ff4060' : '#ff3b30', 0.3);
    if (!this.hasRelic('current_rider')) { this.combo = 0; this.comboTimer = 0; }
    this.particles.emit(this.player.x, this.player.y, { count: 12, color: '#ff5c4a', speed: 3.8, spread: Math.PI * 2, radius: 3.5 });
    this._fireRelicHook('onDamage');
    if (this.player.health <= 0) {
      if (this.hasRelic('second_wind') && !this._secondWindUsed) {
        this._secondWindUsed = true;
        this.player.health = 1;
        this.player.invincibleTimer = Math.max(this.player.invincibleTimer, 1600);
        this.banners.add('SECOND WIND!', PAL.gold);
        this.flash.trigger(PAL.gold, 0.35);
        Sound.milestone();
        return;
      }
      this._die();
    }
  }

  // ── Update ──────────────────────────────────────────────────────────────

  _update(dtRaw) {
    this.time += dtRaw;
    if (this.paused && this.state === 'playing') return;
    if (this.hitstop > 0) { this.hitstop -= dtRaw; return; }

    const dt = dtRaw * this.timeScale;
    const step = dt / 16.667;
    const stepRaw = dtRaw / 16.667;

    this.shake.update(stepRaw);
    this.flash.update(stepRaw);
    this.ripples.update(stepRaw);
    this.banners.update(dtRaw);
    this.shop.update(dtRaw);
    this.runShop.update(dtRaw);
    this.hud.update(stepRaw, this.player);

    if (this.state === 'start') {
      this.bg.update(0.8, step, this.time);
      return;
    }

    if (this.state === 'class-select') {
      this.bg.update(0.4, step, this.time);
      return;
    }

    if (this.state === 'map' || this.state === 'run-shop' || this.state === 'choice') {
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
    // Dash camera punch (decays whenever not dashing, including death).
    const zoomTarget = (this.state === 'playing' && this.player.isDashing) ? 1.05 : 1;
    this._zoom += (zoomTarget - this._zoom) * 0.12 * stepRaw;

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
        else if (this._roomReward === 'relic') {
          this._roomReward = null;
          this._offerRelics(() => this._openMap());
        }
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
    const sirenBonus = (this.hasRelic('siren_song') && this.player.isDashing) ? 200 : 0;
    this.pearls.update(worldSpeed, step, this.time,
      this.state === 'playing' ? this.player : null,
      this.player.stats.magnetRadius + sirenBonus);
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

    if (this._bossIntro > 0) this._bossIntro -= dtRaw;

    // Treasure room: buoyant floating feel.
    if (isTreasure) {
      this.player.vy = Math.min(this.player.vy, 3.2);
      this.player.vy -= 0.07;
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
      if (!isTreasure) this._applyDamage();
      if (this.state !== 'playing') return;
    }

    // Boss update.
    if (this.boss) {
      this.boss.update(dt, step, this.player, this);
      if (this.boss.defeated && !this._bossDefeatedHandled) {
        this._bossDefeatedHandled = true;
        bumpStat(`boss${this.floorIdx + 1}`);
        this.banners.add(`${FLOORS[this.floorIdx].bossName} DEFEATED!`, '#ff3b60');
        setTimeout(() => this._roomClear(), 1800);
      }
    }

    // Pearl collection.
    const { count: collected, hasGolden } = this.pearls.collect(this.player, this.time);
    if (collected > 0) {
      this.combo += collected;
      this.comboTimer = this.comboWindow;
      this._runMaxCombo = Math.max(this._runMaxCombo || 0, this.combo);
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

        const smashableRock = hit.kind === 'rock' && this.hasRelic('diamond_tusk');

        if (hit.kind === 'spike_wheel' && this.player.isDashing) {
          hit.obj.gone = true;
          Sound.shatter();
          this.hitstop = 45;
          this.shake.add(0.3);
          this.flash.trigger('#ff9040', 0.14);
          this.particles.emit(hit.x, hit.y, { count: 18, color: '#a04020', speed: 4.5, spread: Math.PI * 2, radius: 4, shape: 'shard' });
          this._gainPearls(1, hit.x, hit.y, false);
          if (this.hasRelic('thirsty_tusk')) this._gainPearls(2, hit.x, hit.y, false);
        } else if ((hit.kind === 'ice' || smashableRock) && this.player.isDashing) {
          hit.obj.destroy(hit.part);
          Sound.shatter();
          this.hitstop = 42;
          this.shake.add(0.25);
          this.flash.trigger(hit.kind === 'ice' ? '#bfe8ff' : '#ff9040', 0.12);
          const iy = hit.part === 'top' ? hit.obj.topH / 2 : (hit.obj.botY + this.H) / 2;
          this.particles.emit(hit.obj.x + hit.obj.w / 2, iy, {
            count: 18, color: hit.kind === 'ice' ? PAL.ice : PAL.rock,
            speed: 4.5, spread: Math.PI * 2, radius: 5, shape: 'shard',
          });
          this._gainPearls(1, hit.obj.x + hit.obj.w / 2, iy, false);
          if (this.hasRelic('thirsty_tusk')) this._gainPearls(3, hit.obj.x + hit.obj.w / 2, iy, false);
          // Glacier Surf: chain dashes by extending dash on each smash.
          if (hit.kind === 'ice' && this.hasRelic('glacier_surf')) {
            this.player.dashTimer += 500;
            this.player.invincibleTimer = Math.max(this.player.invincibleTimer, this.player.dashTimer + 120);
          }
        } else if (!this.player.invincible) {
          this._applyDamage(hit.kind === 'laser');
          break;
        }
      }
    }

    // Treasure room: timer-based end + trickle in more pearls.
    if (isTreasure) {
      this._treasureTimer += dtRaw;
      if (Math.random() < 0.012 && this.pearls.items.filter(p => !p.collected).length < 12) {
        this.pearls._spawnAt(
          this.W * (0.55 + Math.random() * 0.35),
          60 + Math.random() * (this.H - 120),
          Math.random() < 0.1
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
    if (Math.abs(this._zoom - 1) > 0.002) {
      ctx.translate(W / 2, H / 2);
      ctx.scale(this._zoom, this._zoom);
      ctx.translate(-W / 2, -H / 2);
    }

    this.bg.draw(ctx, this.time, totalDistM);

    if (this.state === 'start') {
      // nothing extra behind start screen
    } else if (this.state === 'class-select') {
      this.classSelect.draw(ctx, W, H, this.time);
    } else if (this.state === 'map') {
      this.floorMapScreen.draw(ctx, W, H, this.mapState, this.time, this.cycleN, {
        health: this.player.health,
        maxHealth: this.player.stats.maxHealth,
        shield: this.player.shield,
        pearls: this.sessionPearls,
        relics: this.activeRelics.length,
      });
    } else if (this.state === 'victory') {
      this._drawVictory(ctx, W, H);
    } else if (this.state !== 'shop' && this.state !== 'run-shop' && this.state !== 'choice') {
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

      // Speed lines while dashing.
      if (this.player.isDashing && this.state === 'playing') {
        ctx.save();
        ctx.strokeStyle = 'rgba(125,252,255,0.2)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        for (let i = 0; i < 9; i++) {
          const len = 90 + (i % 3) * 70;
          const lx = W - ((this.time * (1.1 + (i % 5) * 0.35) + i * 173) % (W + len));
          const ly = (i * 97 + 40) % H;
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx + len, ly);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Edge warnings for incoming off-screen hazards.
      if (this.state === 'playing' && !this.boss) {
        for (const o of this.obstacles.items) {
          if (o.x <= W + 10 || o.x > W + 700) continue;
          let wy = null, wc = null;
          if (o.kind === 'mine') { wy = o.y; wc = '#ff5252'; }
          else if (o.kind === 'spike_wheel') { wy = o.y; wc = '#ff9540'; }
          else if (o.kind === 'laser') { wy = (o.y1 + o.y2) / 2; wc = '#ff4060'; }
          if (wy === null) continue;
          const pulse = 0.55 + Math.sin(this.time / 140) * 0.35;
          ctx.save();
          ctx.globalAlpha = pulse;
          ctx.fillStyle = wc;
          ctx.beginPath();
          ctx.moveTo(W - 6, wy);
          ctx.lineTo(W - 20, wy - 9);
          ctx.lineTo(W - 20, wy + 9);
          ctx.closePath();
          ctx.fill();
          ctx.font = "bold 12px 'Courier New', monospace";
          ctx.textAlign = 'center';
          ctx.fillText('!', W - 28, wy + 4);
          ctx.restore();
        }
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
    const buildRoomInfo = () => {
      if (!this.currentRoom) return null;
      const icon = ROOM_ICONS[this.currentRoom.type];
      const isTreas = this.currentRoom.type === 'treasure';
      return {
        floorNum: this.floorIdx + 1,
        roomLabel: icon?.label || this.currentRoom.type.toUpperCase(),
        roomDistM: isTreas ? Math.ceil(Math.max(0, TREASURE_DUR - this._treasureTimer) / 1000) : roomDistM,
        roomLengthM: isTreas ? TREASURE_DUR / 1000 : (this.currentRoom.lengthM || 0),
        isTreasure: isTreas,
      };
    };

    if (inGame) {
      this.hud.draw(ctx, W, H, this.player, this.sessionPearls, totalDistM, getBestM(),
        this.combo, Math.max(0, this.comboTimer / this.comboWindow),
        Sound.muted, this.time, this.activeRelics, buildRoomInfo());
      this.hud.drawPause(ctx, W, this.paused);
      this.banners.draw(ctx, W, H);

      // Boss intro title card.
      if (this._bossIntro > 0 && this.boss) {
        const t = 1 - this._bossIntro / 2200;
        const a = Math.min(Math.min(1, t * 5), Math.min(1, (1 - t) * 3.2));
        const scale = 1 + Math.max(0, 1 - t * 3.5) * 0.5;
        ctx.save();
        ctx.globalAlpha = Math.max(0, a);
        ctx.translate(W / 2, H * 0.3);
        ctx.scale(scale, scale);
        ctx.textAlign = 'center';
        ctx.shadowBlur = 26; ctx.shadowColor = '#ff3b60';
        ctx.font = "bold 36px 'Courier New', monospace";
        ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 6;
        const bossName = FLOORS[this.floorIdx].bossName.toUpperCase();
        ctx.strokeText(bossName, 0, 0);
        ctx.fillStyle = '#ff3b60';
        ctx.fillText(bossName, 0, 0);
        ctx.shadowBlur = 0;
        ctx.font = "bold 12px 'Courier New', monospace";
        ctx.fillStyle = PAL.cyan;
        ctx.fillText('DASH ITS PROJECTILES TO REFLECT THEM', 0, 28);
        ctx.restore();
      }

      // Pause overlay.
      if (this.paused) {
        ctx.save();
        ctx.fillStyle = 'rgba(1,5,12,0.72)';
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = 'center';
        ctx.font = "bold 32px 'Courier New', monospace";
        ctx.fillStyle = '#e8f4f8';
        ctx.fillText('PAUSED', W / 2, H / 2 - 8);
        const pulse = 0.55 + Math.sin(this.time / 350) * 0.3;
        ctx.globalAlpha = pulse;
        ctx.font = "bold 13px 'Courier New', monospace";
        ctx.fillStyle = '#9cc3e0';
        ctx.fillText('TAP TO RESUME', W / 2, H / 2 + 22);
        ctx.restore();
      }
    } else if (this.state === 'start') {
      this.startScreen.draw(ctx, W, H, this.time);
      this.hud.drawMute(ctx, W, Sound.muted);
    } else if (this.state === 'class-select') {
      this.hud.drawMute(ctx, W, Sound.muted);
    } else if (this.state === 'map') {
      this.hud.drawMute(ctx, W, Sound.muted);
      this.banners.draw(ctx, W, H);
    } else if (this.state === 'relic-pick') {
      this.hud.draw(ctx, W, H, this.player, this.sessionPearls, totalDistM, getBestM(),
        this.combo, 0, Sound.muted, this.time, this.activeRelics, buildRoomInfo());
      this.relicPicker.draw(ctx, W, H, this.time);
    } else if (this.state === 'run-shop') {
      this.runShop.draw(ctx, W, H, this.time, this.sessionPearls);
      this.hud.drawMute(ctx, W, Sound.muted);
      this.banners.draw(ctx, W, H);
    } else if (this.state === 'choice') {
      this.choiceScreen.draw(ctx, W, H, this.time);
      this.hud.drawMute(ctx, W, Sound.muted);
      this.banners.draw(ctx, W, H);
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

    for (let i = 0; i < 18; i++) {
      const sx = (Math.sin(i * 2.3 + this.time / 800) * 0.5 + 0.5) * W;
      const sy = (Math.cos(i * 1.7 + this.time / 600) * 0.5 + 0.5) * H;
      const sr = 1.5 + Math.sin(this.time / 200 + i) * 1.2;
      ctx.fillStyle = `rgba(255,220,100,${0.4 + Math.sin(this.time / 300 + i) * 0.3})`;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    }

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

    const statsY = H * 0.52;
    const lines = [
      [`${this.sessionPearls}`, 'PEARLS REMAINING'],
      [`+${this._bankedAtEnd || 0}`, 'BANKED FOR UPGRADES'],
      [`${this.activeRelics.length}`, 'RELICS HELD'],
    ];
    ctx.font = "13px 'Courier New', monospace";
    for (let i = 0; i < lines.length; i++) {
      ctx.fillStyle = '#ffd866';
      ctx.fillText(lines[i][0], W / 2, statsY + i * 30);
      ctx.fillStyle = 'rgba(140,185,220,0.75)';
      ctx.fillText(lines[i][1], W / 2, statsY + i * 30 + 14);
    }

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
