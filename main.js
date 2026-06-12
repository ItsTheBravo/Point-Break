// ─── Constants ────────────────────────────────────────────────────────────────

const GRAVITY = 0.25;
const SWIM_FORCE = -6;
const BASE_SPEED = 3;
const DASH_SPEED_MULTIPLIER = 2.8;
const DASH_DURATION = 420; // ms
const BASE_DASH_COOLDOWN = 3000; // ms
const PEARL_RADIUS = 10;
const OBSTACLE_GAP = 200;
const OBSTACLE_WIDTH = 50;
const SPAWN_INTERVAL = 220; // frames between obstacle columns
const PEARL_SPAWN_CHANCE = 0.45;

const COLORS = {
  water_deep: '#051a2e',
  water_mid: '#0a2d4d',
  water_light: '#0e4272',
  narwhal_body: '#d4e8f0',
  narwhal_tusk: '#f5f0e8',
  narwhal_eye: '#1a1a2e',
  narwhal_belly: '#ffffff',
  narwhal_dash: '#00ffff',
  rock_unbreakable: '#c0392b',
  rock_shadow: '#922b21',
  breakable: '#8B6914',
  breakable_shadow: '#5D4608',
  pearl: '#e8f4f8',
  pearl_shine: '#ffffff',
  hud_bg: 'rgba(0,0,0,0.4)',
  health_full: '#2ecc71',
  health_low: '#e74c3c',
  dash_ready: '#00ffff',
  dash_cooldown: '#7f8c8d',
  tap_zone: 'rgba(255,255,255,0.04)',
  tap_zone_border: 'rgba(255,255,255,0.08)',
};

// ─── Storage ──────────────────────────────────────────────────────────────────

const Storage = {
  get(key, def) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : def;
    } catch { return def; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  },
};

// ─── Upgrades Definition ──────────────────────────────────────────────────────

const UPGRADES = [
  {
    id: 'max_health',
    label: '+1 Max Health',
    description: 'Increases your maximum health by 1.',
    baseCost: 15,
    costGrowth: 10,
    maxLevel: 5,
    apply(stats, level) { stats.maxHealth = 3 + level; },
  },
  {
    id: 'dash_cooldown',
    label: 'Faster Dash',
    description: 'Reduces Tusk Dash cooldown by 0.5s.',
    baseCost: 20,
    costGrowth: 15,
    maxLevel: 4,
    apply(stats, level) { stats.dashCooldown = BASE_DASH_COOLDOWN - level * 500; },
  },
  {
    id: 'swim_power',
    label: 'Stronger Swim',
    description: 'Increases swim thrust.',
    baseCost: 12,
    costGrowth: 8,
    maxLevel: 4,
    apply(stats, level) { stats.swimForce = SWIM_FORCE - level * 0.5; },
  },
  {
    id: 'dash_duration',
    label: 'Longer Dash',
    description: 'Increases Tusk Dash duration by 100ms.',
    baseCost: 18,
    costGrowth: 12,
    maxLevel: 4,
    apply(stats, level) { stats.dashDuration = DASH_DURATION + level * 100; },
  },
];

function getUpgradeCost(upg, level) {
  return upg.baseCost + level * upg.costGrowth;
}

function loadUpgradeLevels() {
  return Storage.get('upgrade_levels', {});
}

function saveUpgradeLevels(levels) {
  Storage.set('upgrade_levels', levels);
}

function buildStats() {
  const levels = loadUpgradeLevels();
  const stats = {
    maxHealth: 3,
    dashCooldown: BASE_DASH_COOLDOWN,
    swimForce: SWIM_FORCE,
    dashDuration: DASH_DURATION,
  };
  for (const upg of UPGRADES) {
    const level = levels[upg.id] || 0;
    if (level > 0) upg.apply(stats, level);
  }
  return stats;
}

// ─── Player ───────────────────────────────────────────────────────────────────

class Player {
  constructor(x, y, stats) {
    this.x = x;
    this.y = y;
    this.vy = 0;
    this.width = 52;
    this.height = 32;
    this.stats = stats;
    this.health = stats.maxHealth;
    this.isDashing = false;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.invincibleTimer = 0;
    this.hitFlashTimer = 0;
    this.pearls = 0; // session pearls
  }

  swim() {
    this.vy = this.stats.swimForce;
  }

  dash() {
    if (this.dashCooldownTimer > 0 || this.isDashing) return false;
    this.isDashing = true;
    this.dashTimer = this.stats.dashDuration;
    this.invincibleTimer = this.stats.dashDuration + 100;
    return true;
  }

  get dashReady() {
    return this.dashCooldownTimer <= 0 && !this.isDashing;
  }

  get dashCooldownFraction() {
    if (this.isDashing) return 1;
    if (this.dashCooldownTimer <= 0) return 1;
    return 1 - this.dashCooldownTimer / this.stats.dashCooldown;
  }

  takeDamage() {
    if (this.invincibleTimer > 0) return false;
    this.health--;
    this.invincibleTimer = 1200;
    this.hitFlashTimer = 300;
    return true;
  }

  update(dt) {
    this.vy += GRAVITY;
    this.y += this.vy;

    if (this.isDashing) {
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.dashCooldownTimer = this.stats.dashCooldown;
      }
    }
    if (this.dashCooldownTimer > 0) {
      this.dashCooldownTimer = Math.max(0, this.dashCooldownTimer - dt);
    }
    if (this.invincibleTimer > 0) {
      this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);
    }
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    const flash = this.hitFlashTimer > 0 && Math.floor(this.hitFlashTimer / 80) % 2 === 0;
    const dashGlow = this.isDashing;

    if (dashGlow) {
      ctx.shadowBlur = 18;
      ctx.shadowColor = COLORS.narwhal_dash;
    }

    if (flash) {
      ctx.globalAlpha = 0.4;
    }

    // Body
    ctx.fillStyle = this.isDashing ? COLORS.narwhal_dash : COLORS.narwhal_body;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.fillStyle = COLORS.narwhal_belly;
    ctx.beginPath();
    ctx.ellipse(4, 6, this.width / 3.5, this.height / 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tusk
    ctx.strokeStyle = this.isDashing ? '#ffffff' : COLORS.narwhal_tusk;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.width / 2 - 4, -6);
    ctx.lineTo(this.width / 2 + 22, -2);
    ctx.stroke();

    // Tail fin
    ctx.fillStyle = COLORS.narwhal_body;
    ctx.beginPath();
    ctx.moveTo(-this.width / 2 + 6, 0);
    ctx.lineTo(-this.width / 2 - 12, -12);
    ctx.lineTo(-this.width / 2 - 4, 0);
    ctx.lineTo(-this.width / 2 - 12, 12);
    ctx.closePath();
    ctx.fill();

    // Dorsal fin
    ctx.fillStyle = COLORS.narwhal_body;
    ctx.beginPath();
    ctx.moveTo(2, -this.height / 2);
    ctx.lineTo(14, -this.height / 2 - 12);
    ctx.lineTo(20, -this.height / 2);
    ctx.closePath();
    ctx.fill();

    // Eye
    ctx.fillStyle = COLORS.narwhal_eye;
    ctx.beginPath();
    ctx.arc(14, -4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(15, -5, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Dash trail particles
    if (dashGlow) {
      for (let i = 0; i < 4; i++) {
        const px = -this.width / 2 - 10 - i * 14;
        const py = (Math.random() - 0.5) * this.height;
        ctx.fillStyle = `rgba(0, 255, 255, ${0.6 - i * 0.12})`;
        ctx.beginPath();
        ctx.arc(px, py, 4 - i * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  get hitboxX() { return this.x - this.width / 2 + 10; }
  get hitboxY() { return this.y - this.height / 2 + 4; }
  get hitboxW() { return this.width - 20; }
  get hitboxH() { return this.height - 8; }
}

// ─── Obstacle ─────────────────────────────────────────────────────────────────

class Obstacle {
  constructor(x, gapY, gapSize, breakable, canvasH) {
    this.x = x;
    this.gapY = gapY;
    this.gapSize = gapSize;
    this.breakable = breakable;
    this.canvasH = canvasH;
    this.width = OBSTACLE_WIDTH;
    this.destroyed = false;
  }

  get topHeight() { return this.gapY - this.gapSize / 2; }
  get bottomY() { return this.gapY + this.gapSize / 2; }
  get bottomHeight() { return this.canvasH - this.bottomY; }

  update(speed) {
    this.x -= speed;
  }

  collidesWith(player) {
    const px = player.hitboxX, py = player.hitboxY;
    const pw = player.hitboxW, ph = player.hitboxH;
    const ox = this.x, ow = this.width;
    if (px + pw < ox || px > ox + ow) return false;
    if (py + ph < this.topHeight) return false;
    if (py > this.bottomY) return false;
    return true;
  }

  collidesTop(player) {
    const px = player.hitboxX, py = player.hitboxY;
    const pw = player.hitboxW, ph = player.hitboxH;
    const ox = this.x, ow = this.width;
    if (px + pw < ox || px > ox + ow) return false;
    return py < this.topHeight && py + ph > 0;
  }

  collidesBottom(player) {
    const px = player.hitboxX, py = player.hitboxY;
    const pw = player.hitboxW, ph = player.hitboxH;
    const ox = this.x, ow = this.width;
    if (px + pw < ox || px > ox + ow) return false;
    return py + ph > this.bottomY && py < this.canvasH;
  }

  draw(ctx, canvasH) {
    if (this.destroyed) return;

    const color = this.breakable ? COLORS.breakable : COLORS.rock_unbreakable;
    const shadow = this.breakable ? COLORS.breakable_shadow : COLORS.rock_shadow;

    ctx.save();

    if (!this.breakable) {
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(192,57,43,0.5)';
    }

    // Top pillar
    if (this.topHeight > 0) {
      this._drawPillar(ctx, this.x, 0, this.width, this.topHeight, color, shadow, true);
    }

    // Bottom pillar
    if (this.bottomHeight > 0) {
      this._drawPillar(ctx, this.x, this.bottomY, this.width, this.bottomHeight, color, shadow, false);
    }

    ctx.restore();

    // Breakable indicator
    if (this.breakable) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#f39c12';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      if (this.topHeight > 0) {
        ctx.strokeRect(this.x + 4, 4, this.width - 8, this.topHeight - 8);
      }
      if (this.bottomHeight > 0) {
        ctx.strokeRect(this.x + 4, this.bottomY + 4, this.width - 8, this.bottomHeight - 8);
      }
      ctx.restore();

      // Wood grain lines
      ctx.save();
      ctx.strokeStyle = shadow;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.4;
      for (let gy = 14; gy < this.topHeight - 4; gy += 14) {
        ctx.beginPath();
        ctx.moveTo(this.x + 4, gy);
        ctx.lineTo(this.x + this.width - 4, gy);
        ctx.stroke();
      }
      for (let gy = this.bottomY + 14; gy < this.bottomY + this.bottomHeight - 4; gy += 14) {
        ctx.beginPath();
        ctx.moveTo(this.x + 4, gy);
        ctx.lineTo(this.x + this.width - 4, gy);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      // Rock texture cracks
      ctx.save();
      ctx.strokeStyle = shadow;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      if (this.topHeight > 20) {
        ctx.beginPath();
        ctx.moveTo(this.x + 15, this.topHeight - 20);
        ctx.lineTo(this.x + 22, this.topHeight - 8);
        ctx.lineTo(this.x + 30, this.topHeight - 14);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  _drawPillar(ctx, x, y, w, h, color, shadow, isTop) {
    if (h <= 0) return;
    // Main fill
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);

    // Gradient shading
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.3)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.1)');
    grad.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    // Cap
    ctx.fillStyle = isTop ? shadow : color;
    if (isTop) {
      ctx.fillRect(x - 4, h - 10, w + 8, 14);
    } else {
      ctx.fillRect(x - 4, y, w + 8, 14);
    }
  }
}

// ─── ObstacleManager ─────────────────────────────────────────────────────────

class ObstacleManager {
  constructor(canvasW, canvasH) {
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.obstacles = [];
    this.frameCount = 0;
    this.difficulty = 1;
  }

  update(speed) {
    this.frameCount++;
    const spawnInterval = Math.max(140, SPAWN_INTERVAL - this.difficulty * 4);

    if (this.frameCount % spawnInterval === 0) {
      this._spawnColumn(speed);
      this.difficulty = Math.min(20, this.difficulty + 0.3);
    }

    for (const obs of this.obstacles) {
      obs.update(speed);
    }

    this.obstacles = this.obstacles.filter(o => o.x + o.width > -20);
  }

  _spawnColumn(speed) {
    const minGap = 130;
    const maxGap = 210 - this.difficulty * 2;
    const gapSize = Math.max(minGap, maxGap);
    const margin = 80;
    const gapY = margin + Math.random() * (this.canvasH - margin * 2 - gapSize) + gapSize / 2;
    const breakable = Math.random() < 0.38;

    this.obstacles.push(new Obstacle(
      this.canvasW + 20,
      gapY,
      gapSize,
      breakable,
      this.canvasH
    ));
  }

  draw(ctx) {
    for (const obs of this.obstacles) {
      obs.draw(ctx, this.canvasH);
    }
  }

  reset() {
    this.obstacles = [];
    this.frameCount = 0;
    this.difficulty = 1;
  }
}

// ─── Pearl ────────────────────────────────────────────────────────────────────

class Pearl {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = PEARL_RADIUS;
    this.collected = false;
    this.bobOffset = Math.random() * Math.PI * 2;
  }

  update(speed, time) {
    this.x -= speed;
    this.bobY = Math.sin(time / 600 + this.bobOffset) * 3;
  }

  collidesWith(player) {
    const cx = player.x, cy = player.y;
    const dx = cx - this.x, dy = cy - (this.y + (this.bobY || 0));
    return dx * dx + dy * dy < (this.r + 12) * (this.r + 12);
  }

  draw(ctx) {
    if (this.collected) return;
    const y = this.y + (this.bobY || 0);

    // Glow
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(200,240,255,0.8)';

    // Outer pearl
    const grad = ctx.createRadialGradient(this.x - 3, y - 3, 1, this.x, y, this.r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, COLORS.pearl);
    grad.addColorStop(1, '#a8d8ea');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, y, this.r, 0, Math.PI * 2);
    ctx.fill();

    // Shine
    ctx.fillStyle = COLORS.pearl_shine;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(this.x - 3, y - 3, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ─── PearlManager ─────────────────────────────────────────────────────────────

class PearlManager {
  constructor(canvasW, canvasH) {
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.pearls = [];
    this.frameCount = 0;
  }

  update(speed, time) {
    this.frameCount++;
    if (this.frameCount % 80 === 0 && Math.random() < PEARL_SPAWN_CHANCE) {
      this._spawnPearl();
    }

    for (const p of this.pearls) {
      p.update(speed, time);
    }

    this.pearls = this.pearls.filter(p => p.x > -20 && !p.collected);
  }

  _spawnPearl() {
    const margin = 60;
    const y = margin + Math.random() * (this.canvasH - margin * 2);
    const count = Math.random() < 0.3 ? 3 : 1;
    for (let i = 0; i < count; i++) {
      this.pearls.push(new Pearl(
        this.canvasW + 20 + i * 35,
        y + (Math.random() - 0.5) * 40
      ));
    }
  }

  checkCollisions(player) {
    let collected = 0;
    for (const p of this.pearls) {
      if (!p.collected && p.collidesWith(player)) {
        p.collected = true;
        collected++;
      }
    }
    return collected;
  }

  draw(ctx, time) {
    for (const p of this.pearls) {
      p.draw(ctx);
    }
  }

  reset() {
    this.pearls = [];
    this.frameCount = 0;
  }
}

// ─── ParticleSystem ───────────────────────────────────────────────────────────

class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  emit(x, y, opts = {}) {
    const count = opts.count || 6;
    for (let i = 0; i < count; i++) {
      const angle = (opts.angle || 0) + (Math.random() - 0.5) * (opts.spread || Math.PI * 2);
      const speed = (opts.speed || 2) + Math.random() * (opts.speedVar || 2);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.02 + Math.random() * 0.03,
        r: (opts.radius || 4) + Math.random() * 3,
        color: opts.color || '#ffffff',
      });
    }
  }

  update() {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.life -= p.decay;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  draw(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  reset() {
    this.particles = [];
  }
}

// ─── BackgroundRenderer ───────────────────────────────────────────────────────

class BackgroundRenderer {
  constructor(canvasW, canvasH) {
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.bubbles = [];
    this._initBubbles();
    this.scrollX = 0;
    this.rayOffsets = [0.15, 0.38, 0.62, 0.85].map(x => ({
      x: x * canvasW,
      alpha: 0.03 + Math.random() * 0.04,
      speed: 0.2 + Math.random() * 0.3,
    }));
  }

  _initBubbles() {
    for (let i = 0; i < 28; i++) {
      this.bubbles.push(this._newBubble(true));
    }
  }

  _newBubble(randomY = false) {
    return {
      x: Math.random() * this.canvasW,
      y: randomY ? Math.random() * this.canvasH : this.canvasH + 10,
      r: 2 + Math.random() * 5,
      speed: 0.3 + Math.random() * 0.6,
      drift: (Math.random() - 0.5) * 0.3,
      alpha: 0.1 + Math.random() * 0.2,
    };
  }

  update(scrollSpeed) {
    this.scrollX = (this.scrollX + scrollSpeed * 0.15) % this.canvasW;
    for (const b of this.bubbles) {
      b.y -= b.speed;
      b.x += b.drift;
      if (b.y < -20) Object.assign(b, this._newBubble(false));
    }
  }

  draw(ctx) {
    // Deep water gradient
    const grad = ctx.createLinearGradient(0, 0, 0, this.canvasH);
    grad.addColorStop(0, '#020f1a');
    grad.addColorStop(0.4, COLORS.water_deep);
    grad.addColorStop(0.8, COLORS.water_mid);
    grad.addColorStop(1, '#061e33');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.canvasW, this.canvasH);

    // Light rays
    for (const ray of this.rayOffsets) {
      ctx.save();
      const rayGrad = ctx.createLinearGradient(0, 0, 0, this.canvasH * 0.7);
      rayGrad.addColorStop(0, `rgba(100,200,255,${ray.alpha})`);
      rayGrad.addColorStop(1, 'rgba(100,200,255,0)');
      ctx.fillStyle = rayGrad;
      ctx.beginPath();
      ctx.moveTo(ray.x - 30, 0);
      ctx.lineTo(ray.x + 30, 0);
      ctx.lineTo(ray.x + 80, this.canvasH * 0.7);
      ctx.lineTo(ray.x - 80, this.canvasH * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ray.x += ray.speed;
      if (ray.x > this.canvasW + 100) ray.x = -100;
    }

    // Bubbles
    for (const b of this.bubbles) {
      ctx.save();
      ctx.globalAlpha = b.alpha;
      ctx.strokeStyle = 'rgba(150,220,255,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Seabed hint
    const bedGrad = ctx.createLinearGradient(0, this.canvasH - 30, 0, this.canvasH);
    bedGrad.addColorStop(0, 'rgba(20,10,5,0)');
    bedGrad.addColorStop(1, 'rgba(20,10,5,0.5)');
    ctx.fillStyle = bedGrad;
    ctx.fillRect(0, this.canvasH - 30, this.canvasW, 30);
  }
}

// ─── HUD ──────────────────────────────────────────────────────────────────────

class HUD {
  constructor(canvasW, canvasH) {
    this.canvasW = canvasW;
    this.canvasH = canvasH;
  }

  draw(ctx, player, sessionPearls, totalPearls, score) {
    const pad = 14;

    // Health bar background
    ctx.save();
    ctx.fillStyle = COLORS.hud_bg;
    ctx.roundRect(pad, pad, 160, 36, 8);
    ctx.fill();

    // Health hearts
    for (let i = 0; i < player.stats.maxHealth; i++) {
      const filled = i < player.health;
      ctx.font = '20px serif';
      ctx.globalAlpha = filled ? 1 : 0.25;
      ctx.fillText('❤️', pad + 8 + i * 28, pad + 26);
    }
    ctx.restore();

    // Dash indicator
    ctx.save();
    const dashX = pad;
    const dashY = pad + 46;
    ctx.fillStyle = COLORS.hud_bg;
    ctx.roundRect(dashX, dashY, 160, 32, 8);
    ctx.fill();

    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = player.dashReady ? COLORS.dash_ready : COLORS.dash_cooldown;
    ctx.fillText('TUSK DASH', dashX + 8, dashY + 14);

    // Cooldown bar
    const barW = 140;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.roundRect(dashX + 8, dashY + 18, barW, 8, 4);
    ctx.fill();
    ctx.fillStyle = player.dashReady ? COLORS.dash_ready : COLORS.dash_cooldown;
    ctx.roundRect(dashX + 8, dashY + 18, barW * player.dashCooldownFraction, 8, 4);
    ctx.fill();
    ctx.restore();

    // Pearl count top-right
    ctx.save();
    ctx.fillStyle = COLORS.hud_bg;
    ctx.roundRect(this.canvasW - 120 - pad, pad, 120, 36, 8);
    ctx.fill();
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#e8f4f8';
    ctx.textAlign = 'right';
    ctx.fillText(`🦪 ${sessionPearls}`, this.canvasW - pad - 8, pad + 24);
    ctx.restore();

    // Score (distance)
    ctx.save();
    ctx.fillStyle = COLORS.hud_bg;
    ctx.roundRect(this.canvasW / 2 - 60, pad, 120, 32, 8);
    ctx.fill();
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#aaddff';
    ctx.textAlign = 'center';
    ctx.fillText(`${score}m`, this.canvasW / 2, pad + 22);
    ctx.restore();
  }

  drawTapZones(ctx) {
    // Left zone — dash
    ctx.save();
    ctx.fillStyle = COLORS.tap_zone;
    ctx.fillRect(0, 0, this.canvasW / 2, this.canvasH);
    ctx.strokeStyle = COLORS.tap_zone_border;
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(this.canvasW / 2, 0);
    ctx.lineTo(this.canvasW / 2, this.canvasH);
    ctx.stroke();
    ctx.restore();

    // Labels
    ctx.save();
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.22;

    ctx.fillStyle = '#00ffff';
    ctx.fillText('TAP', this.canvasW / 4, this.canvasH - 30);
    ctx.fillText('TUSK DASH', this.canvasW / 4, this.canvasH - 14);

    ctx.fillStyle = '#ffffff';
    ctx.fillText('TAP', (3 * this.canvasW) / 4, this.canvasH - 30);
    ctx.fillText('SWIM UP', (3 * this.canvasW) / 4, this.canvasH - 14);
    ctx.restore();
  }
}

// ─── Shop ─────────────────────────────────────────────────────────────────────

class Shop {
  constructor(canvasW, canvasH) {
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.visible = false;
    this.hoveredIndex = -1;
    this.message = '';
    this.messageTimer = 0;
    this.onRestart = null;
    this.pearlsEarned = 0;
    this.finalScore = 0;
    this._buttonRects = [];
    this._restartRect = null;
  }

  show(pearlsEarned, finalScore, totalPearls) {
    this.visible = true;
    this.pearlsEarned = pearlsEarned;
    this.finalScore = finalScore;
    this.totalPearls = totalPearls;
    this.message = '';
    this.messageTimer = 0;
  }

  hide() {
    this.visible = false;
  }

  handleTap(x, y) {
    if (!this.visible) return false;

    // Restart button
    if (this._restartRect) {
      const r = this._restartRect;
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        this.hide();
        if (this.onRestart) this.onRestart();
        return true;
      }
    }

    // Upgrade buttons
    const levels = loadUpgradeLevels();
    for (let i = 0; i < this._buttonRects.length; i++) {
      const r = this._buttonRects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        const upg = UPGRADES[i];
        const level = levels[upg.id] || 0;
        if (level >= upg.maxLevel) {
          this._showMsg('Max level reached!');
        } else {
          const cost = getUpgradeCost(upg, level);
          const current = Storage.get('total_pearls', 0);
          if (current < cost) {
            this._showMsg('Not enough pearls!');
          } else {
            Storage.set('total_pearls', current - cost);
            levels[upg.id] = level + 1;
            saveUpgradeLevels(levels);
            this.totalPearls = current - cost;
            this._showMsg('Upgrade purchased!');
          }
        }
        return true;
      }
    }
    return true; // absorb all taps when shop is visible
  }

  _showMsg(msg) {
    this.message = msg;
    this.messageTimer = 2000;
  }

  update(dt) {
    if (this.messageTimer > 0) this.messageTimer = Math.max(0, this.messageTimer - dt);
  }

  draw(ctx) {
    if (!this.visible) return;

    const W = this.canvasW, H = this.canvasH;
    const levels = loadUpgradeLevels();
    const totalPearls = Storage.get('total_pearls', 0);

    // Overlay
    ctx.save();
    ctx.fillStyle = 'rgba(2,10,20,0.88)';
    ctx.fillRect(0, 0, W, H);

    const panelW = Math.min(500, W - 30);
    const panelX = (W - panelW) / 2;
    let y = 40;

    // Panel background
    ctx.fillStyle = 'rgba(10,30,55,0.95)';
    ctx.strokeStyle = 'rgba(0,200,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.roundRect(panelX, y - 10, panelW, H - 60, 16);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = '#e8f4f8';
    ctx.font = `bold ${Math.min(32, W * 0.07)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('NARWHAL LOST!', W / 2, y + 32);
    y += 50;

    // Stats
    ctx.font = '15px monospace';
    ctx.fillStyle = '#aaddff';
    ctx.fillText(`Distance: ${this.finalScore}m   Pearls earned: ${this.pearlsEarned}`, W / 2, y + 4);
    y += 26;

    ctx.font = 'bold 17px monospace';
    ctx.fillStyle = '#e8f4f8';
    ctx.fillText(`🦪 Total Pearls: ${totalPearls}`, W / 2, y + 6);
    y += 34;

    // Divider
    ctx.strokeStyle = 'rgba(0,200,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 20, y);
    ctx.lineTo(panelX + panelW - 20, y);
    ctx.stroke();
    y += 18;

    ctx.fillStyle = '#00ccff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('UPGRADES', W / 2, y + 4);
    y += 26;

    // Upgrade buttons
    this._buttonRects = [];
    const btnH = 66;
    const btnGap = 10;
    const btnW = panelW - 40;
    const btnX = panelX + 20;

    for (let i = 0; i < UPGRADES.length; i++) {
      const upg = UPGRADES[i];
      const level = levels[upg.id] || 0;
      const maxed = level >= upg.maxLevel;
      const cost = maxed ? 0 : getUpgradeCost(upg, level);
      const canAfford = !maxed && totalPearls >= cost;
      const btnY = y + i * (btnH + btnGap);

      this._buttonRects.push({ x: btnX, y: btnY, w: btnW, h: btnH });

      // Button bg
      ctx.fillStyle = maxed
        ? 'rgba(40,80,40,0.6)'
        : canAfford
          ? 'rgba(0,60,100,0.8)'
          : 'rgba(40,40,60,0.7)';
      ctx.roundRect(btnX, btnY, btnW, btnH, 10);
      ctx.fill();
      ctx.strokeStyle = maxed ? 'rgba(80,200,80,0.4)' : canAfford ? 'rgba(0,200,255,0.4)' : 'rgba(100,100,150,0.3)';
      ctx.lineWidth = 1;
      ctx.roundRect(btnX, btnY, btnW, btnH, 10);
      ctx.stroke();

      // Upgrade name
      ctx.fillStyle = maxed ? '#aaffaa' : '#e8f4f8';
      ctx.font = `bold 14px monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(upg.label, btnX + 12, btnY + 22);

      // Description
      ctx.fillStyle = '#88aacc';
      ctx.font = '12px monospace';
      ctx.fillText(upg.description, btnX + 12, btnY + 40);

      // Level pips
      for (let l = 0; l < upg.maxLevel; l++) {
        ctx.fillStyle = l < level ? '#00ffaa' : 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.arc(btnX + 12 + l * 14, btnY + 55, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cost / maxed label
      ctx.textAlign = 'right';
      if (maxed) {
        ctx.fillStyle = '#aaffaa';
        ctx.font = 'bold 13px monospace';
        ctx.fillText('MAXED', btnX + btnW - 12, btnY + 22);
      } else {
        ctx.fillStyle = canAfford ? '#00ffcc' : '#cc4444';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(`🦪 ${cost}`, btnX + btnW - 12, btnY + 22);
      }
    }

    y += UPGRADES.length * (btnH + btnGap) + 14;

    // Message
    if (this.messageTimer > 0) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = this.message.includes('!') && !this.message.includes('Not') ? '#00ffaa' : '#ff6666';
      ctx.globalAlpha = Math.min(1, this.messageTimer / 400);
      ctx.fillText(this.message, W / 2, y);
      y += 26;
    }

    ctx.globalAlpha = 1;

    // Restart button
    const restartH = 50;
    const restartW = Math.min(200, panelW - 80);
    const restartX = (W - restartW) / 2;
    const restartY = H - 70;
    this._restartRect = { x: restartX, y: restartY, w: restartW, h: restartH };

    ctx.fillStyle = 'rgba(0,180,100,0.85)';
    ctx.roundRect(restartX, restartY, restartW, restartH, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,255,150,0.5)';
    ctx.lineWidth = 1.5;
    ctx.roundRect(restartX, restartY, restartW, restartH, 12);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('▶ PLAY AGAIN', W / 2, restartY + 32);

    ctx.restore();
  }
}

// ─── StartScreen ──────────────────────────────────────────────────────────────

class StartScreen {
  constructor(canvasW, canvasH) {
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.visible = true;
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
  }

  draw(ctx) {
    if (!this.visible) return;
    const W = this.canvasW, H = this.canvasH;
    const bob = Math.sin(this.time / 500) * 8;

    ctx.save();
    ctx.fillStyle = 'rgba(2,8,18,0.75)';
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8f4f8';
    ctx.font = `bold ${Math.min(36, W * 0.08)}px monospace`;
    ctx.fillText('ROGUELIKE', W / 2, H / 2 - 90 + bob);
    ctx.fillStyle = '#00ccff';
    ctx.font = `bold ${Math.min(46, W * 0.1)}px monospace`;
    ctx.fillText('FLAPPY NARWHAL', W / 2, H / 2 - 44 + bob);

    // Narwhal emoji placeholder
    ctx.font = `${Math.min(70, W * 0.14)}px serif`;
    ctx.fillText('🦄', W / 2, H / 2 + 30 + bob);

    ctx.fillStyle = '#aaddff';
    ctx.font = '14px monospace';
    ctx.fillText('TAP anywhere to begin', W / 2, H / 2 + 100);

    const totalPearls = Storage.get('total_pearls', 0);
    if (totalPearls > 0) {
      ctx.fillStyle = '#88aacc';
      ctx.font = '13px monospace';
      ctx.fillText(`🦪 Total Pearls: ${totalPearls}`, W / 2, H / 2 + 124);
    }

    ctx.restore();
  }
}

// ─── Game ─────────────────────────────────────────────────────────────────────

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this._resize();
    window.addEventListener('resize', () => this._resize());

    this.state = 'start'; // 'start' | 'playing' | 'dead'
    this.lastTime = 0;
    this.score = 0;
    this.sessionPearls = 0;
    this.speed = BASE_SPEED;

    this._initSystems();
    this._bindInput();
    requestAnimationFrame(ts => this._loop(ts));
  }

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.bg) {
      this.bg.canvasW = this.canvas.width;
      this.bg.canvasH = this.canvas.height;
    }
    if (this.hud) {
      this.hud.canvasW = this.canvas.width;
      this.hud.canvasH = this.canvas.height;
    }
    if (this.shop) {
      this.shop.canvasW = this.canvas.width;
      this.shop.canvasH = this.canvas.height;
    }
    if (this.startScreen) {
      this.startScreen.canvasW = this.canvas.width;
      this.startScreen.canvasH = this.canvas.height;
    }
  }

  _initSystems() {
    const W = this.canvas.width, H = this.canvas.height;
    this.bg = new BackgroundRenderer(W, H);
    this.hud = new HUD(W, H);
    this.shop = new Shop(W, H);
    this.startScreen = new StartScreen(W, H);
    this.particles = new ParticleSystem();
    this.shop.onRestart = () => this._startRun();
    this._buildPlayer();
    this.obstacleManager = new ObstacleManager(W, H);
    this.pearlManager = new PearlManager(W, H);
  }

  _buildPlayer() {
    const stats = buildStats();
    this.player = new Player(
      this.canvas.width * 0.22,
      this.canvas.height / 2,
      stats
    );
  }

  _startRun() {
    this.state = 'playing';
    this.score = 0;
    this.sessionPearls = 0;
    this.speed = BASE_SPEED;
    this._buildPlayer();
    this.obstacleManager.reset();
    this.pearlManager.reset();
    this.particles.reset();
    if (this.startScreen) this.startScreen.visible = false;
  }

  _bindInput() {
    const onTap = (x, y) => {
      if (this.state === 'start') {
        this._startRun();
        return;
      }
      if (this.state === 'dead') {
        this.shop.handleTap(x, y);
        return;
      }
      if (this.state === 'playing') {
        if (x < this.canvas.width / 2) {
          const didDash = this.player.dash();
          if (didDash) {
            this.particles.emit(this.player.x - 20, this.player.y, {
              count: 12, color: '#00ffff', speed: 4, spread: Math.PI * 0.6,
              angle: Math.PI, radius: 3,
            });
          }
        } else {
          this.player.swim();
          this.particles.emit(this.player.x, this.player.y + 10, {
            count: 4, color: 'rgba(100,200,255,0.7)', speed: 1.5,
            spread: Math.PI * 0.5, angle: Math.PI / 2, radius: 2,
          });
        }
      }
    };

    // Touch
    this.canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      onTap((t.clientX - rect.left) * scaleX, (t.clientY - rect.top) * scaleY);
    }, { passive: false });

    // Mouse (desktop testing)
    this.canvas.addEventListener('mousedown', e => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      onTap((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
    });

    // Keyboard (desktop testing)
    window.addEventListener('keydown', e => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        onTap(this.canvas.width * 0.75, this.canvas.height / 2);
      }
      if (e.code === 'ShiftLeft' || e.code === 'KeyX') {
        onTap(this.canvas.width * 0.25, this.canvas.height / 2);
      }
    });
  }

  _update(dt) {
    const W = this.canvas.width, H = this.canvas.height;

    if (this.state === 'start') {
      this.startScreen.update(dt);
      this.bg.update(1);
      return;
    }

    if (this.state === 'dead') {
      this.shop.update(dt);
      return;
    }

    // Playing
    this.bg.update(this.speed);

    // Ramp up speed
    this.speed = BASE_SPEED + (this.score / 500) * 0.8;

    const dashSpeed = this.player.isDashing ? this.speed * DASH_SPEED_MULTIPLIER : this.speed;

    this.obstacleManager.update(dashSpeed);
    this.pearlManager.update(dashSpeed, this.lastTime);
    this.player.update(dt);
    this.particles.update();

    // Boundary clamp
    const halfH = this.player.height / 2;
    if (this.player.y - halfH < 0) {
      this.player.y = halfH;
      this.player.vy = 0;
    }
    if (this.player.y + halfH > H) {
      this._die();
      return;
    }

    // Score
    this.score = Math.floor(this.score + dashSpeed * 0.05);

    // Pearl collection
    const collected = this.pearlManager.checkCollisions(this.player);
    if (collected > 0) {
      this.sessionPearls += collected;
      this.particles.emit(this.player.x + 20, this.player.y, {
        count: 8 * collected, color: '#e8f4f8', speed: 3, spread: Math.PI,
        angle: 0, radius: 3,
      });
    }

    // Obstacle collisions
    for (const obs of this.obstacleManager.obstacles) {
      if (obs.destroyed) continue;
      if (obs.collidesWith(this.player)) continue; // gap — no collision

      const hitTop = obs.collidesTop(this.player);
      const hitBottom = obs.collidesBottom(this.player);

      if (hitTop || hitBottom) {
        if (obs.breakable && this.player.isDashing) {
          obs.destroyed = true;
          this.particles.emit(
            obs.x + obs.width / 2,
            hitTop ? obs.topHeight : obs.bottomY,
            { count: 16, color: COLORS.breakable, speed: 4, spread: Math.PI * 2, radius: 5 }
          );
        } else {
          const damaged = this.player.takeDamage();
          if (damaged) {
            this.particles.emit(this.player.x, this.player.y, {
              count: 10, color: '#ff4444', speed: 3, spread: Math.PI * 2, radius: 4,
            });
            if (this.player.health <= 0) {
              this._die();
              return;
            }
          }
        }
      }
    }
  }

  _die() {
    this.state = 'dead';
    const prev = Storage.get('total_pearls', 0);
    Storage.set('total_pearls', prev + this.sessionPearls);
    const totalPearls = Storage.get('total_pearls', 0);
    this.shop.show(this.sessionPearls, this.score, totalPearls);
    this.particles.emit(this.player.x, this.player.y, {
      count: 24, color: '#ff6644', speed: 5, spread: Math.PI * 2, radius: 6,
    });
  }

  _draw() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;

    this.bg.draw(ctx);

    if (this.state !== 'start') {
      this.obstacleManager.draw(ctx);
      this.pearlManager.draw(ctx, this.lastTime);
      this.particles.draw(ctx);
      this.player.draw(ctx);
    }

    if (this.state === 'playing') {
      this.hud.drawTapZones(ctx);
      this.hud.draw(ctx, this.player, this.sessionPearls, Storage.get('total_pearls', 0), this.score);
    }

    if (this.state === 'start') {
      this.startScreen.draw(ctx);
    }

    if (this.state === 'dead') {
      this.shop.draw(ctx);
    }
  }

  _loop(timestamp) {
    const dt = Math.min(50, timestamp - (this.lastTime || timestamp));
    this.lastTime = timestamp;

    this._update(dt);
    this._draw();

    requestAnimationFrame(ts => this._loop(ts));
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

// Polyfill roundRect for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.beginPath();
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
    this.closePath();
    return this;
  };
}

new Game();
