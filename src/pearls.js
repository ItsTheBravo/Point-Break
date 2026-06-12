import { PAL } from './constants.js';

class Pearl {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = 9;
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
        const pull = 0.9 * (1 - d / magnetRadius) + 0.25;
        this.vx += (dx / d) * pull * step;
        this.vy += (dy / d) * pull * step;
      }
    }
    this.x += (this.vx - speed) * step;
    this.y += this.vy * step;
    this.vx *= Math.pow(0.92, step);
    this.vy *= Math.pow(0.92, step);
  }

  drawY(time) {
    return this.magnetized ? this.y : this.y + Math.sin(time / 550 + this.bob) * 3;
  }

  draw(ctx, time) {
    const y = this.drawY(time);
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = PAL.pearlGlow;
    const g = ctx.createRadialGradient(this.x - 2.5, y - 2.5, 1, this.x, y, this.r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, PAL.pearl);
    g.addColorStop(1, '#e8c87a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, y, this.r, 0, Math.PI * 2);
    ctx.fill();

    // Sparkle
    const sp = (Math.sin(time / 320 + this.bob * 3) + 1) / 2;
    if (sp > 0.7) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(255,255,255,${(sp - 0.7) * 3})`;
      ctx.lineWidth = 1.5;
      const sx = this.x + 3, sy = y - 4, s = 4;
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
    if (this.distSinceSpawn > 380) {
      this.distSinceSpawn = 0;
      if (Math.random() < 0.75) this._spawnPattern();
    }
    for (const p of this.items) p.update(speed, step, time, player, magnetRadius);
    this.items = this.items.filter(p => p.x > -25 && !p.collected);
  }

  _spawnPattern() {
    const margin = 70;
    const cy = margin + Math.random() * (this.H - margin * 2);
    const type = Math.random();
    if (type < 0.4) {
      // Sine wave trail
      const n = 4 + Math.floor(Math.random() * 3);
      const amp = 30 + Math.random() * 40;
      for (let i = 0; i < n; i++) {
        this.items.push(new Pearl(this.W + 25 + i * 42, cy + Math.sin(i * 0.9) * amp));
      }
    } else if (type < 0.7) {
      // Arc
      const n = 5;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        this.items.push(new Pearl(this.W + 25 + i * 38, cy - Math.sin(t * Math.PI) * 70));
      }
    } else {
      // Cluster
      const n = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        this.items.push(new Pearl(
          this.W + 25 + Math.random() * 70,
          cy + (Math.random() - 0.5) * 80
        ));
      }
    }
  }

  // Returns number collected this frame.
  collect(player, time) {
    let n = 0;
    for (const p of this.items) {
      if (p.collected) continue;
      const dy = p.drawY(time) - player.y;
      const dx = p.x - player.x;
      if (dx * dx + dy * dy < (p.r + player.r + 4) ** 2) {
        p.collected = true;
        n++;
      }
    }
    return n;
  }

  draw(ctx, time) {
    for (const p of this.items) p.draw(ctx, time);
  }
}
