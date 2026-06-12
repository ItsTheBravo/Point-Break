import { PAL } from './constants.js';

// Layered parallax trench: gradient water, far ridges, kelp, fish,
// light rays, bubbles, and a vignette.

function makeRidge(W, H, baseY, jag, segW) {
  const pts = [];
  const n = Math.ceil(W / segW) + 3;
  for (let i = 0; i < n; i++) {
    pts.push(baseY + (Math.random() - 0.5) * jag);
  }
  return { pts, segW };
}

export class Background {
  constructor(W, H) {
    this.resize(W, H);
  }

  resize(W, H) {
    this.W = W;
    this.H = H;
    this.scrollFar = 0;
    this.scrollMid = 0;

    this.ridgeTop = makeRidge(W, H, H * 0.12, H * 0.12, 70);
    this.ridgeBot = makeRidge(W, H, H * 0.86, H * 0.14, 70);

    this.kelp = [];
    const kelpCount = Math.ceil(W / 90);
    for (let i = 0; i < kelpCount * 2; i++) {
      this.kelp.push({
        x: Math.random() * W * 2,
        h: 50 + Math.random() * 90,
        sway: Math.random() * Math.PI * 2,
        w: 5 + Math.random() * 5,
      });
    }

    this.bubbles = [];
    for (let i = 0; i < 24; i++) this.bubbles.push(this._bubble(true));

    this.fish = [];

    this.rays = [];
    for (let i = 0; i < 4; i++) {
      this.rays.push({
        x: Math.random() * W,
        alpha: 0.025 + Math.random() * 0.035,
        speed: 0.15 + Math.random() * 0.25,
        width: 40 + Math.random() * 50,
      });
    }
  }

  _bubble(randomY) {
    return {
      x: Math.random() * this.W,
      y: randomY ? Math.random() * this.H : this.H + 12,
      r: 1.5 + Math.random() * 4,
      speed: 0.25 + Math.random() * 0.55,
      drift: (Math.random() - 0.5) * 0.25,
      alpha: 0.08 + Math.random() * 0.16,
      wob: Math.random() * Math.PI * 2,
    };
  }

  update(speed, step, time) {
    const ridgeTotal = this.ridgeTop.pts.length * this.ridgeTop.segW;
    this.scrollFar = (this.scrollFar + speed * 0.18 * step) % ridgeTotal;
    this.scrollMid = (this.scrollMid + speed * 0.45 * step) % (this.W * 2);

    for (const b of this.bubbles) {
      b.y -= b.speed * step;
      b.x += (b.drift + Math.sin(time / 700 + b.wob) * 0.15) * step;
      if (b.y < -15) Object.assign(b, this._bubble(false));
    }

    for (const r of this.rays) {
      r.x += r.speed * step;
      if (r.x > this.W + 120) r.x = -120;
    }

    // Occasional fish silhouette drifting by.
    if (Math.random() < 0.004 * step && this.fish.length < 4) {
      const dir = Math.random() < 0.7 ? -1 : 1;
      this.fish.push({
        x: dir === -1 ? this.W + 40 : -40,
        y: this.H * (0.15 + Math.random() * 0.6),
        vx: dir * (0.5 + Math.random() * 0.8),
        s: 8 + Math.random() * 10,
        wig: Math.random() * Math.PI * 2,
      });
    }
    for (const f of this.fish) {
      f.x += (f.vx - speed * 0.3) * step;
      f.y += Math.sin(time / 300 + f.wig) * 0.3 * step;
    }
    this.fish = this.fish.filter(f => f.x > -80 && f.x < this.W + 80);
  }

  draw(ctx, time, depthM) {
    const { W, H } = this;

    // Water gradient — gets slightly darker the deeper you travel.
    const darken = Math.min(0.35, depthM / 4000);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, PAL.waterTop);
    grad.addColorStop(0.45, PAL.waterDeep);
    grad.addColorStop(1, PAL.waterBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    if (darken > 0) {
      ctx.fillStyle = `rgba(0,0,10,${darken})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Light rays.
    for (const r of this.rays) {
      const rg = ctx.createLinearGradient(0, 0, 0, H * 0.75);
      rg.addColorStop(0, `rgba(120,210,255,${r.alpha})`);
      rg.addColorStop(1, 'rgba(120,210,255,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(r.x - r.width * 0.4, 0);
      ctx.lineTo(r.x + r.width * 0.4, 0);
      ctx.lineTo(r.x + r.width, H * 0.75);
      ctx.lineTo(r.x - r.width, H * 0.75);
      ctx.closePath();
      ctx.fill();
    }

    // Far ridges (top stalactites + bottom seafloor) with parallax wrap.
    this._drawRidge(ctx, this.ridgeTop, this.scrollFar, true, PAL.ridgeFar);
    this._drawRidge(ctx, this.ridgeBot, this.scrollFar, false, PAL.ridgeFar);

    // Kelp, mid parallax.
    for (const k of this.kelp) {
      let kx = ((k.x - this.scrollMid) % (W * 2) + W * 2) % (W * 2) - W * 0.5;
      if (kx < -40 || kx > W + 40) continue;
      const sway = Math.sin(time / 900 + k.sway) * 14;
      ctx.save();
      ctx.strokeStyle = PAL.kelp;
      ctx.lineWidth = k.w;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(kx, H + 4);
      ctx.quadraticCurveTo(kx + sway * 0.4, H - k.h * 0.55, kx + sway, H - k.h);
      ctx.stroke();
      ctx.restore();
    }

    // Fish silhouettes.
    for (const f of this.fish) {
      ctx.save();
      ctx.fillStyle = PAL.fish;
      ctx.translate(f.x, f.y);
      ctx.scale(f.vx > 0 ? 1 : -1, 1);
      ctx.beginPath();
      ctx.ellipse(0, 0, f.s, f.s * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-f.s * 0.8, 0);
      ctx.lineTo(-f.s * 1.5, -f.s * 0.5);
      ctx.lineTo(-f.s * 1.5, f.s * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Bubbles.
    for (const b of this.bubbles) {
      ctx.save();
      ctx.globalAlpha = b.alpha;
      ctx.strokeStyle = 'rgba(170,225,255,0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawRidge(ctx, ridge, scroll, isTop, color) {
    const { W, H } = this;
    const { pts, segW } = ridge;
    // Slide smoothly: phase shifts vertices left, baseIdx walks the ring.
    const phase = scroll % segW;
    const baseIdx = Math.floor(scroll / segW);
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    const startY = isTop ? -10 : H + 10;
    ctx.moveTo(-segW * 2, startY);
    for (let i = -1; i <= Math.ceil(W / segW) + 2; i++) {
      const idx = (((baseIdx + i) % pts.length) + pts.length) % pts.length;
      ctx.lineTo(i * segW - phase, pts[idx]);
    }
    ctx.lineTo(W + segW * 2, startY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawVignette(ctx) {
    const { W, H } = this;
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,15,0.45)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }
}
