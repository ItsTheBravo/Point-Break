export class ParticleSystem {
  constructor() { this.items = []; }

  emit(x, y, {
    count = 6, color = '#fff', speed = 2, speedVar = 2,
    angle = 0, spread = Math.PI * 2, radius = 4, gravity = 0.05,
    decay = 0.025, shape = 'circle',
  } = {}) {
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed + Math.random() * speedVar;
      this.items.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 1,
        decay: decay + Math.random() * decay,
        r: radius * (0.6 + Math.random() * 0.8),
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.3,
        color, gravity, shape,
      });
    }
  }

  update(step, scrollSpeed = 0) {
    for (const p of this.items) {
      p.x += (p.vx - scrollSpeed * 0.5) * step;
      p.y += p.vy * step;
      p.vy += p.gravity * step;
      p.rot += p.vrot * step;
      p.life -= p.decay * step;
    }
    this.items = this.items.filter(p => p.life > 0);
  }

  draw(ctx) {
    for (const p of this.items) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      if (p.shape === 'shard') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        const r = p.r * p.life;
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.7, r * 0.6);
        ctx.lineTo(-r * 0.7, r * 0.4);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.1, p.r * p.life), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  reset() { this.items = []; }
}
