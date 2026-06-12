import { TUNE, PAL } from './constants.js';

// ── Pillar pair ────────────────────────────────────────────────────────────

class PillarPair {
  constructor(x, gapY, gapSize, kind, H) {
    this.x = x;
    this.gapY = gapY;
    this.gapSize = gapSize;
    this.kind = kind;
    this.H = H;
    this.w = 58;
    this.topGone = false;
    this.botGone = false;
    this.passed = false;
    this.teeth = [];
    for (let i = 0; i <= this.w; i += 9) this.teeth.push(7 + Math.random() * 11);
    this.cracks = Array.from({ length: 4 }, () => ({
      x: 8 + Math.random() * (this.w - 16),
      len: 12 + Math.random() * 22,
      lean: (Math.random() - 0.5) * 16,
    }));
    this.hexes = Array.from({ length: 6 }, () => ({
      x: 4 + Math.random() * (this.w - 8),
      y: Math.random(),
      r: 5 + Math.random() * 4,
    }));
  }

  get topH() { return this.gapY - this.gapSize / 2; }
  get botY() { return this.gapY + this.gapSize / 2; }
  get done() { return this.topGone && this.botGone; }

  update(speed, step) { this.x -= speed * step; }
  get offscreen() { return this.x + this.w < -30; }

  hitTest(px, py, pr) {
    if (px + pr < this.x || px - pr > this.x + this.w) return null;
    if (!this.topGone && py - pr < this.topH) {
      const cx = Math.max(this.x, Math.min(px, this.x + this.w));
      const cy = Math.max(0, Math.min(py, this.topH));
      if ((px - cx) ** 2 + (py - cy) ** 2 < pr * pr) return 'top';
    }
    if (!this.botGone && py + pr > this.botY) {
      const cx = Math.max(this.x, Math.min(px, this.x + this.w));
      const cy = Math.max(this.botY, Math.min(py, this.H));
      if ((px - cx) ** 2 + (py - cy) ** 2 < pr * pr) return 'bot';
    }
    return null;
  }

  destroy(part) {
    if (part === 'top') this.topGone = true;
    else this.botGone = true;
  }

  draw(ctx, time, dashReady, rockTint) {
    if (!this.topGone && this.topH > 0) this._pillar(ctx, 0, this.topH, true, time, dashReady, rockTint);
    if (!this.botGone && this.botY < this.H) this._pillar(ctx, this.botY, this.H - this.botY, false, time, dashReady, rockTint);
  }

  _pillar(ctx, y, h, isTop, time, dashReady, rockTint) {
    const { x, w } = this;
    const ice = this.kind === 'ice';
    ctx.save();
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    if (ice) {
      grad.addColorStop(0, PAL.iceDark);
      grad.addColorStop(0.45, PAL.iceCore);
      grad.addColorStop(1, PAL.ice);
      ctx.globalAlpha = 0.92;
    } else {
      const base = rockTint || PAL.rock;
      const dark = rockTint ? darken(rockTint, 0.5) : PAL.rockDark;
      grad.addColorStop(0, dark);
      grad.addColorStop(0.4, base);
      grad.addColorStop(1, dark);
    }
    ctx.fillStyle = grad;

    const edgeY = isTop ? y + h : y;
    const dir = isTop ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(x, isTop ? y : y + h);
    ctx.lineTo(x, edgeY - dir * 2);
    let i = 0;
    for (let tx = x; tx < x + w; tx += 9, i++) {
      const t = this.teeth[Math.min(i, this.teeth.length - 1)];
      ctx.lineTo(tx + 4.5, edgeY + dir * (t - 10));
      ctx.lineTo(Math.min(tx + 9, x + w), edgeY - dir * 2);
    }
    ctx.lineTo(x + w, isTop ? y : y + h);
    ctx.closePath();
    ctx.fill();

    if (ice) {
      // Hexagonal crystal facets.
      ctx.save();
      ctx.globalAlpha *= 0.3;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      for (const hex of this.hexes) {
        const hx = x + hex.x;
        const hy = isTop ? y + hex.y * h * 0.8 : y + h - hex.y * h * 0.8;
        ctx.beginPath();
        for (let side = 0; side < 6; side++) {
          const a = (side / 6) * Math.PI * 2;
          const fx = hx + Math.cos(a) * hex.r;
          const fy = hy + Math.sin(a) * hex.r;
          side === 0 ? ctx.moveTo(fx, fy) : ctx.lineTo(fx, fy);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
      // Crack lines.
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.5;
      for (const c of this.cracks) {
        const cy = isTop ? Math.min(y + h - 8, y + h * 0.3) : y + 8;
        ctx.beginPath();
        ctx.moveTo(x + c.x, cy);
        ctx.lineTo(x + c.x + c.lean, cy + (isTop ? -c.len : c.len));
        ctx.stroke();
      }
      // Cyan glow rim when dash ready.
      if (dashReady) {
        const pulse = 0.22 + 0.16 * Math.sin(time / 200);
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = PAL.cyan;
        ctx.strokeStyle = `rgba(57,230,255,${pulse})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
        ctx.restore();
      }
    } else {
      // Rock strata.
      ctx.save();
      ctx.globalAlpha *= 0.28;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.8;
      for (let sy = isTop ? y + 18 : y + 8; sy < y + h - 6; sy += 28) {
        ctx.beginPath();
        ctx.moveTo(x + 3, sy);
        ctx.lineTo(x + w - 3, sy + 4);
        ctx.stroke();
      }
      ctx.restore();
      // Edge highlight.
      ctx.strokeStyle = 'rgba(255,140,90,0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 2, isTop ? y : y + h);
      ctx.lineTo(x + 2, edgeY);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ── Floating mine ─────────────────────────────────────────────────────────

export class Mine {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.baseY = y;
    this.r = 15;
    this.bob = Math.random() * Math.PI * 2;
    this.kind = 'mine';
    this.gone = false;
  }

  update(speed, step, time) {
    this.x -= speed * step;
    this.y = this.baseY + Math.sin(time / 580 + this.bob) * 9;
  }

  get offscreen() { return this.x < -40; }

  hitTest(px, py, pr) {
    const d2 = (px - this.x) ** 2 + (py - this.y) ** 2;
    return d2 < (pr + this.r - 2) ** 2 ? 'mine' : null;
  }

  draw(ctx, time, glowColor) {
    const pulse = (Math.sin(time / 170 + this.bob) + 1) / 2;
    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.strokeStyle = glowColor || PAL.mineSpike;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * this.r * 0.75, Math.sin(a) * this.r * 0.75);
      ctx.lineTo(Math.cos(a) * (this.r + 8), Math.sin(a) * (this.r + 8));
      ctx.stroke();
    }

    ctx.shadowBlur = 12 + pulse * 10;
    ctx.shadowColor = glowColor || PAL.mineGlow;
    const g = ctx.createRadialGradient(-4, -5, 2, 0, 0, this.r);
    g.addColorStop(0, '#5a646e');
    g.addColorStop(1, PAL.mineBody);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = pulse > 0.5 ? (glowColor || PAL.mineGlow) : '#7a2620';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Laser gate ─────────────────────────────────────────────────────────────

class LaserGate {
  constructor(x, y1, y2) {
    this.x = x;
    this.y1 = y1;
    this.y2 = y2;
    this.kind = 'laser';
    this.gone = false;
    this.nodeR = 10;
    this.beamW = 5;

    // Phase: 'on' → 'warn' → 'off'
    this.phase = 'off'; // start off so player has a moment
    this.phaseDurations = { on: 1350, warn: 380, off: 850 };
    this.phaseTimer = 750; // short initial off
  }

  update(speed, step, dt) {
    this.x -= speed * step;
    this.phaseTimer -= dt;
    if (this.phaseTimer <= 0) {
      if (this.phase === 'on') {
        this.phase = 'warn';
        this.phaseTimer = this.phaseDurations.warn;
      } else if (this.phase === 'warn') {
        this.phase = 'off';
        this.phaseTimer = this.phaseDurations.off;
      } else {
        this.phase = 'on';
        this.phaseTimer = this.phaseDurations.on;
      }
    }
  }

  get offscreen() { return this.x < -30; }

  hitTest(px, py, pr) {
    if (this.gone || this.phase === 'off') return null;
    const nearX = Math.abs(px - this.x) < pr + this.beamW / 2;
    const inY = py > this.y1 - pr && py < this.y2 + pr;
    return nearX && inY ? 'laser' : null;
  }

  draw(ctx, time) {
    if (this.gone) return;
    const beamOn = this.phase === 'on';
    const beamWarn = this.phase === 'warn';
    const beamColor = beamOn ? PAL.laserOn : beamWarn
      ? (Math.floor(time / 60) % 2 === 0 ? PAL.laserWarn : 'rgba(255,180,0,0.3)')
      : PAL.laserOff;
    const nodeColor = beamOn ? '#ff4060' : beamWarn ? '#ffbb20' : '#3a5a40';
    const beamAlpha = beamOn ? 0.92 : beamWarn ? 0.7 : 0.2;

    ctx.save();
    // Beam
    if (beamAlpha > 0.1) {
      ctx.save();
      ctx.shadowBlur = beamOn ? 18 : 8;
      ctx.shadowColor = beamColor;
      ctx.globalAlpha = beamAlpha;
      ctx.strokeStyle = beamColor;
      ctx.lineWidth = this.beamW;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.x, this.y1);
      ctx.lineTo(this.x, this.y2);
      ctx.stroke();
      // Inner bright core.
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = beamAlpha * 0.5;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y1);
      ctx.lineTo(this.x, this.y2);
      ctx.stroke();
      ctx.restore();
    }

    // Nodes (wall anchors)
    for (const ny of [this.y1, this.y2]) {
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = beamColor;
      ctx.fillStyle = PAL.laserNode;
      ctx.beginPath();
      ctx.arc(this.x, ny, this.nodeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = nodeColor;
      ctx.beginPath();
      ctx.arc(this.x, ny, this.nodeR * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }
}

// ── Spike wheel (breakable via dash) ───────────────────────────────────────

class SpikeWheel {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.baseY = y;
    this.r = 22;
    this.spikes = 6;
    this.rot = Math.random() * Math.PI * 2;
    this.rotSpeed = (0.012 + Math.random() * 0.012) * (Math.random() < 0.5 ? 1 : -1);
    this.kind = 'spike_wheel';
    this.gone = false;
    this.bob = Math.random() * Math.PI * 2;
  }

  update(speed, step, time) {
    this.x -= speed * step;
    this.y = this.baseY + Math.sin(time / 700 + this.bob) * 11;
    this.rot += this.rotSpeed * step;
  }

  get offscreen() { return this.x < -50; }

  hitTest(px, py, pr) {
    if (this.gone) return null;
    const d2 = (px - this.x) ** 2 + (py - this.y) ** 2;
    return d2 < (pr + this.r + 5) ** 2 ? 'spike_wheel' : null;
  }

  draw(ctx, time) {
    if (this.gone) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(255,80,0,0.5)';

    // Spikes
    for (let i = 0; i < this.spikes; i++) {
      const a = (i / this.spikes) * Math.PI * 2;
      ctx.fillStyle = '#a04020';
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (this.r - 4), Math.sin(a) * (this.r - 4));
      ctx.lineTo(Math.cos(a) * (this.r + 14), Math.sin(a) * (this.r + 14));
      ctx.lineTo(Math.cos(a + 0.35) * (this.r - 4), Math.sin(a + 0.35) * (this.r - 4));
      ctx.closePath();
      ctx.fill();
    }
    // Hub
    const hub = ctx.createRadialGradient(-5, -5, 2, 0, 0, this.r);
    hub.addColorStop(0, '#6a3018');
    hub.addColorStop(1, '#3a1808');
    ctx.fillStyle = hub;
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    ctx.fill();
    // Ring detail
    ctx.strokeStyle = '#8a4020';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, this.r * 0.65, 0, Math.PI * 2);
    ctx.stroke();
    // Breakable indicator.
    ctx.fillStyle = 'rgba(57,230,255,0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, this.r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Obstacle Manager ──────────────────────────────────────────────────────

export class ObstacleManager {
  constructor(W, H) {
    this.W = W;
    this.H = H;
    this.reset();
  }

  reset() {
    this.items = [];
    this.totalDist = 0;
    this.spawnQueue = [];
    this._nextRegularSpawn = 600; // distance to first obstacle
  }

  resize(W, H) { this.W = W; this.H = H; }

  update(speed, step, dt, time, distPx, biomeId) {
    const difficulty = Math.min(1, Math.max(0, (distPx - TUNE.graceDistancePx) / 12000));
    this.totalDist += speed * step;

    // Process spawn queue.
    while (this.spawnQueue.length > 0 && this.spawnQueue[0].at <= this.totalDist) {
      this.spawnQueue.shift().fn(this, difficulty, biomeId);
    }

    // Schedule regular spawns.
    if (distPx > TUNE.graceDistancePx && this.totalDist >= this._nextRegularSpawn) {
      const spacing = TUNE.obstacleSpacingStart -
        (TUNE.obstacleSpacingStart - TUNE.obstacleSpacingMin) * difficulty;
      this._nextRegularSpawn = this.totalDist + spacing;
      this._schedulePattern(difficulty, biomeId);
    }

    for (const o of this.items) {
      if (o.kind === 'laser') o.update(speed, step, dt);
      else o.update(speed, step, time);
    }
    this.items = this.items.filter(o => !o.offscreen && !o.gone);
    return difficulty;
  }

  _schedulePattern(difficulty, biomeId) {
    const roll = Math.random();
    const d = this.totalDist;

    // At low difficulty, mostly standard. At high difficulty, mostly patterns.
    if (difficulty < 0.2 || roll < 0.35) {
      // Simple single pillar.
      this.spawnQueue.push({ at: d, fn: (m, diff) => m._spawnPillars(Math.random() < 0.4 ? 'ice' : 'rock', diff) });
    } else if (roll < 0.52) {
      this._queueChicane(difficulty);
    } else if (roll < 0.64) {
      this._queueIceGauntlet(difficulty);
    } else if (roll < 0.76 && difficulty > 0.25) {
      this._queueLaserSection(difficulty);
    } else if (roll < 0.86 && difficulty > 0.15) {
      this._queueMineField(difficulty);
    } else {
      this._queueCompression(difficulty);
    }

    this.spawnQueue.sort((a, b) => a.at - b.at);
  }

  _queueChicane(diff) {
    // Alternating top/bottom openings — forces up-down weaving.
    const d = this.totalDist;
    const sep = 210 + (1 - diff) * 60;
    this.spawnQueue.push(
      { at: d,       fn: (m, di) => m._spawnPillarsAt(d,       'rock', di, 'top') },
      { at: d + sep, fn: (m, di) => m._spawnPillarsAt(d + sep, 'rock', di, 'bot') },
      { at: d + sep * 2, fn: (m, di) => m._spawnPillarsAt(d + sep * 2, 'rock', di, 'top') },
    );
  }

  _queueIceGauntlet(diff) {
    // 3 ice pillars in a row, reward dashing.
    const d = this.totalDist;
    const sep = 200;
    for (let i = 0; i < 3; i++) {
      this.spawnQueue.push({ at: d + sep * i, fn: (m, di) => m._spawnPillars('ice', di) });
    }
  }

  _queueLaserSection(diff) {
    const d = this.totalDist;
    const margin = 60;
    const span = this.H * (0.35 + diff * 0.25);
    const y1 = margin + Math.random() * (this.H * 0.3);
    const y2 = y1 + span;
    this.spawnQueue.push({ at: d, fn: (m) => m.items.push(new LaserGate(m.W + 30, y1, y2)) });
    // Add a pillar before to funnel the player.
    this.spawnQueue.push({ at: d - 160, fn: (m, di) => m._spawnPillars('rock', di) });
  }

  _queueMineField(diff) {
    const d = this.totalDist;
    const count = 3 + Math.floor(diff * 4);
    for (let i = 0; i < count; i++) {
      const offset = i * (50 + Math.random() * 40);
      this.spawnQueue.push({
        at: d + offset,
        fn: (m) => {
          const y = 70 + Math.random() * (m.H - 140);
          m.items.push(new Mine(m.W + 30 + Math.random() * 20, y));
        },
      });
    }
  }

  _queueCompression(diff) {
    // Gap tightens across 3 pillars.
    const d = this.totalDist;
    const sep = 220;
    const gapBase = TUNE.gapStart - (TUNE.gapStart - TUNE.gapMin) * diff;
    for (let i = 0; i < 3; i++) {
      const shrink = i * 18;
      this.spawnQueue.push({
        at: d + sep * i,
        fn: (m) => {
          const gap = Math.max(TUNE.gapMin, gapBase - shrink);
          const margin = 60;
          const gapY = margin + gap / 2 + Math.random() * (m.H - margin * 2 - gap);
          m.items.push(new PillarPair(m.W + 30, gapY, gap, i === 1 ? 'ice' : 'rock', m.H));
        },
      });
    }
  }

  _spawnPillars(kind, difficulty) {
    const gap = Math.max(TUNE.gapMin, TUNE.gapStart - (TUNE.gapStart - TUNE.gapMin) * difficulty);
    const margin = 62;
    const gapY = margin + gap / 2 + Math.random() * (this.H - margin * 2 - gap);
    this.items.push(new PillarPair(this.W + 30, gapY, gap, kind, this.H));

    // Sprinkle a spike wheel or mine in the gap sometimes.
    if (difficulty > 0.3 && Math.random() < 0.28) {
      const type = Math.random();
      const wy = gapY + (Math.random() - 0.5) * gap * 0.7;
      if (type < 0.5) {
        this.items.push(new SpikeWheel(this.W + 30 + 160, wy));
      } else {
        this.items.push(new Mine(this.W + 30 + 200, wy));
      }
    }
  }

  _spawnPillarsAt(dist, kind, difficulty, side) {
    // Force gap to be biased top or bottom.
    const gap = Math.max(TUNE.gapMin + 10, TUNE.gapStart - (TUNE.gapStart - TUNE.gapMin) * difficulty);
    const margin = 55;
    const centerBand = this.H - margin * 2 - gap;
    let gapY;
    if (side === 'top') gapY = margin + gap / 2 + Math.random() * centerBand * 0.4;
    else gapY = margin + gap / 2 + centerBand * 0.6 + Math.random() * centerBand * 0.4;
    this.items.push(new PillarPair(this.W + 30, gapY, gap, kind, this.H));
  }

  collide(player) {
    const events = [];
    for (const o of this.items) {
      if (o.gone) continue;
      const part = o.hitTest(player.x, player.y, player.r);
      if (part) {
        events.push({ kind: o.kind, part, x: player.x + 20, y: player.y, obj: o });
      }
    }
    return events;
  }

  draw(ctx, time, dashReady, biome) {
    const rockTint = biome?.rockTint || null;
    const mineGlow = biome?.glowColor || null;
    for (const o of this.items) {
      if (o.kind === 'laser') o.draw(ctx, time);
      else if (o.kind === 'mine') o.draw(ctx, time, mineGlow);
      else if (o.kind === 'spike_wheel') o.draw(ctx, time);
      else o.draw(ctx, time, dashReady, rockTint);
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function darken(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 0xff) * factor);
  const g = Math.round(((n >> 8) & 0xff) * factor);
  const b = Math.round((n & 0xff) * factor);
  return `rgb(${r},${g},${b})`;
}
