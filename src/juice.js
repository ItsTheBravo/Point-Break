// Game-feel helpers: screen shake, flashes, floating text, tap ripples.

export class Shake {
  constructor() { this.trauma = 0; }
  add(amount) { this.trauma = Math.min(1, this.trauma + amount); }
  update(step) { this.trauma = Math.max(0, this.trauma - 0.04 * step); }
  offset() {
    const s = this.trauma * this.trauma * 14;
    return {
      x: (Math.random() * 2 - 1) * s,
      y: (Math.random() * 2 - 1) * s,
    };
  }
}

export class Flash {
  constructor() { this.color = '#fff'; this.alpha = 0; }
  trigger(color, alpha = 0.35) { this.color = color; this.alpha = alpha; }
  update(step) { this.alpha = Math.max(0, this.alpha - 0.04 * step); }
  draw(ctx, W, H) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

export class FloatingTexts {
  constructor() { this.items = []; }
  add(x, y, text, { color = '#fff', size = 16, vy = -0.8, life = 1100 } = {}) {
    this.items.push({ x, y, text, color, size, vy, life, maxLife: life });
  }
  update(dt, scrollSpeed, step) {
    for (const t of this.items) {
      t.life -= dt;
      t.y += t.vy * step;
      t.x -= scrollSpeed * 0.4 * step;
    }
    this.items = this.items.filter(t => t.life > 0);
  }
  draw(ctx) {
    for (const t of this.items) {
      const a = Math.min(1, t.life / (t.maxLife * 0.5));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = `bold ${t.size}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
  }
}

export class Ripples {
  constructor() { this.items = []; }
  add(x, y, color = 'rgba(255,255,255,0.5)') {
    this.items.push({ x, y, r: 6, life: 1, color });
  }
  update(step) {
    for (const r of this.items) {
      r.r += 2.4 * step;
      r.life -= 0.05 * step;
    }
    this.items = this.items.filter(r => r.life > 0);
  }
  draw(ctx) {
    for (const r of this.items) {
      ctx.save();
      ctx.globalAlpha = r.life * 0.6;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

export class Banners {
  constructor() { this.items = []; }
  add(text, color = '#ffd866') {
    this.items.push({ text, color, t: 0, dur: 1400 });
  }
  update(dt) {
    for (const b of this.items) b.t += dt;
    this.items = this.items.filter(b => b.t < b.dur);
  }
  draw(ctx, W, H) {
    for (const b of this.items) {
      const p = b.t / b.dur;
      // Pop in, hold, fade out.
      const scale = p < 0.15 ? 0.5 + (p / 0.15) * 0.6 : 1.1 - Math.min(0.1, (p - 0.15) * 0.3);
      const alpha = p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(W / 2, H * 0.3);
      ctx.scale(scale, scale);
      ctx.font = `bold 34px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(b.text, 0, 0);
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, 0, 0);
      ctx.restore();
    }
  }
}
