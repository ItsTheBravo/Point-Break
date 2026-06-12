import { TUNE, PAL } from './constants.js';

// ── Pillar pair (rock = unbreakable, ice = dash-breakable) ──────────

class PillarPair {
  constructor(x, gapY, gapSize, kind, H) {
    this.x = x;
    this.gapY = gapY;
    this.gapSize = gapSize;
    this.kind = kind; // 'rock' | 'ice'
    this.H = H;
    this.w = 56;
    this.topGone = false;
    this.botGone = false;
    this.passed = false;

    // Pre-baked jagged teeth so edges don't flicker between frames.
    this.teeth = [];
    for (let i = 0; i <= this.w; i += 9) {
      this.teeth.push(7 + Math.random() * 10);
    }
    this.cracks = [];
    for (let i = 0; i < 3; i++) {
      this.cracks.push({
        x: 8 + Math.random() * (this.w - 16),
        len: 15 + Math.random() * 25,
        lean: (Math.random() - 0.5) * 14,
      });
    }
  }

  get topH() { return this.gapY - this.gapSize / 2; }
  get botY() { return this.gapY + this.gapSize / 2; }

  update(speed, step) { this.x -= speed * step; }

  get offscreen() { return this.x + this.w < -30; }

  // Circle-vs-pillars collision. Returns 'top' | 'bot' | null.
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

  draw(ctx, time, dashReady) {
    if (!this.topGone && this.topH > 0) this._pillar(ctx, 0, this.topH, true, time, dashReady);
    if (!this.botGone && this.botY < this.H) this._pillar(ctx, this.botY, this.H - this.botY, false, time, dashReady);
  }

  _pillar(ctx, y, h, isTop, time, dashReady) {
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
      grad.addColorStop(0, PAL.rockDark);
      grad.addColorStop(0.4, PAL.rock);
      grad.addColorStop(1, PAL.rockDark);
    }
    ctx.fillStyle = grad;

    // Body + jagged teeth facing the gap.
    ctx.beginPath();
    const edgeY = isTop ? y + h : y;
    const dir = isTop ? 1 : -1;
    ctx.moveTo(x, isTop ? y : y + h);
    ctx.lineTo(x, edgeY - dir * 2);
    let i = 0;
    for (let tx = x; tx < x + w; tx += 9, i++) {
      const t = this.teeth[Math.min(i, this.teeth.length - 1)];
      ctx.lineTo(tx + 4.5, edgeY + dir * (t - 9));
      ctx.lineTo(Math.min(tx + 9, x + w), edgeY - dir * 2);
    }
    ctx.lineTo(x + w, isTop ? y : y + h);
    ctx.closePath();
    ctx.fill();

    if (ice) {
      // Crystal facets + cracks.
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.5;
      for (const c of this.cracks) {
        const cy = isTop ? Math.min(y + h - 8, h * 0.4 + y) : y + 8;
        ctx.beginPath();
        ctx.moveTo(x + c.x, cy);
        ctx.lineTo(x + c.x + c.lean, cy + (isTop ? -c.len : c.len));
        ctx.stroke();
      }
      // Pulsing cyan rim while dash is ready — "you can smash this".
      if (dashReady) {
        const pulse = 0.25 + 0.18 * Math.sin(time / 220);
        ctx.strokeStyle = `rgba(57,230,255,${pulse})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
      }
    } else {
      // Strata lines on rock.
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      const stripeGap = 26;
      const startY = isTop ? y + 14 : y + 10;
      for (let sy = startY; sy < y + h - 8; sy += stripeGap) {
        ctx.beginPath();
        ctx.moveTo(x + 3, sy);
        ctx.lineTo(x + w - 3, sy + 3);
        ctx.stroke();
      }
      // Warm edge highlight.
      ctx.strokeStyle = 'rgba(255,140,90,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 2, isTop ? y : y + h);
      ctx.lineTo(x + 2, edgeY);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Floating mine (unbreakable hazard) ───────────────────────────────

class Mine {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.baseY = y;
    this.r = 16;
    this.bob = Math.random() * Math.PI * 2;
    this.kind = 'mine';
    this.gone = false;
  }

  update(speed, step, time) {
    this.x -= speed * step;
    this.y = this.baseY + Math.sin(time / 600 + this.bob) * 8;
  }

  get offscreen() { return this.x < -40; }

  hitTest(px, py, pr) {
    const d2 = (px - this.x) ** 2 + (py - this.y) ** 2;
    return d2 < (pr + this.r - 2) ** 2 ? 'mine' : null;
  }

  draw(ctx, time) {
    const pulse = (Math.sin(time / 180 + this.bob) + 1) / 2;
    ctx.save();
    ctx.translate(this.x, this.y);

    // Spikes
    ctx.strokeStyle = PAL.mineSpike;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * this.r * 0.8, Math.sin(a) * this.r * 0.8);
      ctx.lineTo(Math.cos(a) * (this.r + 7), Math.sin(a) * (this.r + 7));
      ctx.stroke();
    }

    // Body
    ctx.shadowBlur = 10 + pulse * 8;
    ctx.shadowColor = PAL.mineGlow;
    const g = ctx.createRadialGradient(-4, -5, 2, 0, 0, this.r);
    g.addColorStop(0, '#5a646e');
    g.addColorStop(1, PAL.mineBody);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    ctx.fill();

    // Blinking core
    ctx.shadowBlur = 0;
    ctx.fillStyle = pulse > 0.5 ? PAL.mineGlow : '#7a2620';
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ── Manager: pattern-based procedural spawning ───────────────────────

export class ObstacleManager {
  constructor(W, H) {
    this.W = W;
    this.H = H;
    this.reset();
  }

  reset() {
    this.items = [];
    this.distSinceSpawn = 0;
  }

  resize(W, H) { this.W = W; this.H = H; }

  // difficulty: 0..1
  update(speed, step, time, distPx) {
    const difficulty = Math.min(1, Math.max(0, (distPx - TUNE.graceDistancePx) / 14000));
    this.distSinceSpawn += speed * step;

    const spacing = TUNE.obstacleSpacingStart -
      (TUNE.obstacleSpacingStart - TUNE.obstacleSpacingMin) * difficulty;

    if (distPx > TUNE.graceDistancePx && this.distSinceSpawn >= spacing) {
      this.distSinceSpawn = 0;
      this._spawn(difficulty);
    }

    for (const o of this.items) o.update(speed, step, time);
    this.items = this.items.filter(o => !o.offscreen);
    return difficulty;
  }

  _spawn(difficulty) {
    const roll = Math.random();
    const mineChance = 0.12 + difficulty * 0.18;
    if (roll < mineChance) {
      this._spawnMines(difficulty);
    } else {
      const ice = Math.random() < 0.36;
      this._spawnPillars(ice ? 'ice' : 'rock', difficulty);
    }
  }

  _spawnPillars(kind, difficulty) {
    const gap = TUNE.gapStart - (TUNE.gapStart - TUNE.gapMin) * difficulty;
    const margin = 70;
    const gapY = margin + gap / 2 + Math.random() * (this.H - margin * 2 - gap);
    this.items.push(new PillarPair(this.W + 30, gapY, gap, kind, this.H));

    // At higher difficulty, sometimes float a mine inside the gap lane
    // of the NEXT stretch to punish lazy flying.
    if (difficulty > 0.35 && Math.random() < 0.3) {
      this.items.push(new Mine(this.W + 30 + 170, gapY + (Math.random() - 0.5) * gap * 1.4));
    }
  }

  _spawnMines(difficulty) {
    const count = 2 + Math.floor(Math.random() * (2 + difficulty * 2));
    const usedYs = [];
    for (let i = 0; i < count; i++) {
      let y, tries = 0;
      do {
        y = 60 + Math.random() * (this.H - 120);
        tries++;
      } while (tries < 8 && usedYs.some(u => Math.abs(u - y) < 90));
      usedYs.push(y);
      this.items.push(new Mine(this.W + 40 + i * 55 + Math.random() * 40, y));
    }
  }

  // Returns array of collision events: { kind, part, x, y, obj }
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

  draw(ctx, time, dashReady) {
    for (const o of this.items) {
      if (o.kind === 'mine') o.draw(ctx, time);
      else o.draw(ctx, time, dashReady);
    }
  }
}
