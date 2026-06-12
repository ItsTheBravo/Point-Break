import { PAL } from './constants.js';

class Pearl {
  constructor(x, y, golden = false) {
    this.x = x;
    this.y = y;
    this.r = golden ? 11 : 9;
    this.golden = golden;
    this.bob = Math.random() * Math.PI * 2;
    this.collected = false;
    this.vx = 0;
    this.vy = 0;
    this.magnetized = false;
  }

  update(speed, step, time, player, magnetRadius) {
    if (magnetRadius > 0 && player) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < magnetRadius * magnetRadius) {
        this.magnetized = true;
        const d = Math.max(8, Math.sqrt(d2));
        const pull = 0.95 * (1 - d / magnetRadius) + 0.28;
        this.vx += (dx / d) * pull * step;
        this.vy += (dy / d) * pull * step;
      }
    }
    this.x += (this.vx - speed) * step;
    this.y += this.vy * step;
    this.vx *= Math.pow(0.91, step);
    this.vy *= Math.pow(0.91, step);
  }

  drawY(time) {
    return this.magnetized ? this.y : this.y + Math.sin(time / 540 + this.bob) * 3;
  }

  draw(ctx, time) {
    const y = this.drawY(time);
    ctx.save();
    ctx.shadowBlur = this.golden ? 18 : 10;
    ctx.shadowColor = this.golden ? 'rgba(255,200,60,0.9)' : PAL.pearlGlow;
    const g = ctx.createRadialGradient(this.x - 2.5, y - 2.5, 1, this.x, y, this.r);
    if (this.golden) {
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.4, '#ffe080');
      g.addColorStop(1, '#d4a000');
    } else {
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.5, PAL.pearl);
      g.addColorStop(1, '#e8c87a');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, y, this.r, 0, Math.PI * 2);
    ctx.fill();

    // Sparkle.
    const sp = (Math.sin(time / 300 + this.bob * 3) + 1) / 2;
    if (sp > 0.65) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(255,255,255,${(sp - 0.65) * 2.8})`;
      ctx.lineWidth = 1.5;
      const sx = this.x + 3, sy = y - 4, s = this.golden ? 6 : 4;
      ctx.beginPath();
      ctx.moveTo(sx - s, sy); ctx.lineTo(sx + s, sy);
      ctx.moveTo(sx, sy - s); ctx.lineTo(sx, sy + s);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export class PearlManager {
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

  update(speed, step, time, player, magnetRadius) {
    this.distSinceSpawn += speed * step;
    if (this.distSinceSpawn > 360) {
      this.distSinceSpawn = 0;
      if (Math.random() < 0.78) this._spawnPattern();
    }
    for (const p of this.items) p.update(speed, step, time, player, magnetRadius);
    this.items = this.items.filter(p => p.x > -28 && !p.collected);
  }

  _spawnPattern() {
    const margin = 72;
    const cy = margin + Math.random() * (this.H - margin * 2);
    const type = Math.random();
    const golden = Math.random() < 0.08; // rare golden in natural spawns
    if (type < 0.35) {
      const n = 4 + Math.floor(Math.random() * 4);
      const amp = 30 + Math.random() * 45;
      for (let i = 0; i < n; i++) {
        this.items.push(new Pearl(this.W + 22 + i * 44, cy + Math.sin(i * 0.9) * amp, golden && i === Math.floor(n / 2)));
      }
    } else if (type < 0.65) {
      const n = 5;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        this.items.push(new Pearl(this.W + 22 + i * 38, cy - Math.sin(t * Math.PI) * 75, golden && i === 2));
      }
    } else {
      const n = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        this.items.push(new Pearl(this.W + 22 + Math.random() * 75, cy + (Math.random() - 0.5) * 85));
      }
    }
  }

  _spawnAt(x, y, golden = false) {
    this.items.push(new Pearl(x, y, golden));
  }

  collect(player, time) {
    let n = 0;
    let hasGolden = false;
    for (const p of this.items) {
      if (p.collected) continue;
      const dy = p.drawY(time) - player.y;
      const dx = p.x - player.x;
      if (dx * dx + dy * dy < (p.r + player.r + 4) ** 2) {
        p.collected = true;
        n++;
        if (p.golden) hasGolden = true;
      }
    }
    return { count: n, hasGolden };
  }

  draw(ctx, time) {
    for (const p of this.items) p.draw(ctx, time);
  }
}
