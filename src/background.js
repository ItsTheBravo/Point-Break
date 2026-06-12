import { BIOMES } from './constants.js';

function lerp(a, b, t) { return a + (b - a) * t; }

function lerpColor(c1, c2, t) {
  // Both must be '#rrggbb'
  const p1 = parseInt(c1.slice(1), 16);
  const p2 = parseInt(c2.slice(1), 16);
  const r = Math.round(lerp((p1 >> 16) & 0xff, (p2 >> 16) & 0xff, t));
  const g = Math.round(lerp((p1 >> 8) & 0xff, (p2 >> 8) & 0xff, t));
  const b = Math.round(lerp(p1 & 0xff, p2 & 0xff, t));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function makeRidge(W, H, baseY, jag, segW) {
  const n = Math.ceil(W * 2 / segW) + 8;
  const pts = Array.from({ length: n }, () => baseY + (Math.random() - 0.5) * jag);
  return { pts, segW };
}

export class Background {
  constructor(W, H) {
    this._biomeFrom = BIOMES[0];
    this._biomeTo = BIOMES[0];
    this._biomeT = 1;
    this.resize(W, H);
  }

  resize(W, H) {
    this.W = W; this.H = H;
    this.scrollFar = 0;
    this.scrollMid = 0;
    this.ridgeTop = makeRidge(W, H, H * 0.11, H * 0.13, 68);
    this.ridgeBot = makeRidge(W, H, H * 0.87, H * 0.14, 68);
    this.kelp = Array.from({ length: Math.ceil(W / 80) * 2 }, () => ({
      x: Math.random() * W * 2,
      h: 50 + Math.random() * 100,
      sway: Math.random() * Math.PI * 2,
      w: 5 + Math.random() * 5,
    }));
    this.bubbles = Array.from({ length: 28 }, () => this._bubble(true));
    this.bioParticles = [];
    this.fish = [];
    this.rays = Array.from({ length: 4 }, () => ({
      x: Math.random() * W,
      alpha: 0.022 + Math.random() * 0.032,
      speed: 0.12 + Math.random() * 0.22,
      width: 38 + Math.random() * 55,
    }));
  }

  startTransition(fromBiome, toBiome) {
    this._biomeFrom = fromBiome;
    this._biomeTo = toBiome;
    this._biomeT = 0;
  }

  get currentBiome() {
    return this._biomeT >= 1 ? this._biomeTo : this._biomeTo;
  }

  _bubble(randomY) {
    return {
      x: Math.random() * this.W,
      y: randomY ? Math.random() * this.H : this.H + 14,
      r: 1.5 + Math.random() * 4.5,
      speed: 0.22 + Math.random() * 0.52,
      drift: (Math.random() - 0.5) * 0.22,
      alpha: 0.07 + Math.random() * 0.15,
      wob: Math.random() * Math.PI * 2,
    };
  }

  _bioPart(biome) {
    return {
      x: this.W + 20,
      y: Math.random() * this.H,
      vx: -(0.4 + Math.random() * 0.6),
      vy: (Math.random() - 0.5) * 0.3,
      r: 1.5 + Math.random() * 3.5,
      alpha: 0.3 + Math.random() * 0.5,
      pulse: Math.random() * Math.PI * 2,
      color: biome.glowColor || 'rgba(57,230,255,0.6)',
    };
  }

  update(speed, step, time, biomeTransitionDelta = 0) {
    this._biomeT = Math.min(1, this._biomeT + biomeTransitionDelta);

    const ridgeTotal = this.ridgeTop.pts.length * this.ridgeTop.segW;
    this.scrollFar = (this.scrollFar + speed * 0.17 * step) % ridgeTotal;
    this.scrollMid = (this.scrollMid + speed * 0.44 * step) % (this.W * 2);

    for (const b of this.bubbles) {
      b.y -= b.speed * step;
      b.x += (b.drift + Math.sin(time / 720 + b.wob) * 0.14) * step;
      if (b.y < -15) Object.assign(b, this._bubble(false));
    }

    for (const r of this.rays) {
      r.x += r.speed * step;
      if (r.x > this.W + 130) r.x = -130;
    }

    // Bio particles (abyss/rift).
    const biome = this.currentBiome;
    if ((biome.id === 'abyss' || biome.id === 'rift') && Math.random() < 0.05 * step) {
      this.bioParticles.push(this._bioPart(biome));
    }
    for (const p of this.bioParticles) {
      p.x += (p.vx - speed * 0.1) * step;
      p.y += p.vy * step;
      p.alpha -= 0.004 * step;
      p.pulse += 0.08 * step;
    }
    this.bioParticles = this.bioParticles.filter(p => p.alpha > 0 && p.x > -30);

    // Fish.
    if (Math.random() < 0.003 * step && this.fish.length < 4) {
      const dir = Math.random() < 0.7 ? -1 : 1;
      this.fish.push({
        x: dir < 0 ? this.W + 45 : -45,
        y: this.H * (0.15 + Math.random() * 0.6),
        vx: dir * (0.45 + Math.random() * 0.75),
        s: 8 + Math.random() * 11,
        wig: Math.random() * Math.PI * 2,
      });
    }
    for (const f of this.fish) {
      f.x += (f.vx - speed * 0.28) * step;
      f.y += Math.sin(time / 320 + f.wig) * 0.28 * step;
    }
    this.fish = this.fish.filter(f => f.x > -80 && f.x < this.W + 80);
  }

  draw(ctx, time, depthM) {
    const { W, H } = this;
    const t = this._biomeT;
    const bFrom = this._biomeFrom;
    const bTo = this._biomeTo;
    const mix = (k) => t < 1 ? lerpColor(bFrom[k], bTo[k], t) : bTo[k];

    // Water gradient.
    const darken = Math.min(0.4, depthM / 5000);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, mix('waterTop'));
    grad.addColorStop(0.45, mix('waterMid'));
    grad.addColorStop(1, mix('waterBot'));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    if (darken > 0) {
      ctx.fillStyle = `rgba(0,0,8,${darken})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Biome fog.
    const fogColor = t > 0.5 ? bTo.fogColor : bFrom.fogColor;
    if (fogColor && t > 0) {
      ctx.fillStyle = fogColor;
      ctx.globalAlpha = t;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    // Light rays (only in reef biome).
    const rayAlpha = 1 - Math.min(1, depthM / 1200);
    if (rayAlpha > 0.02) {
      for (const r of this.rays) {
        const rg = ctx.createLinearGradient(0, 0, 0, H * 0.75);
        rg.addColorStop(0, `rgba(120,210,255,${r.alpha * rayAlpha})`);
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
    }

    // Ridges.
    const ridgeColor = mix('ridgeFar');
    this._drawRidge(ctx, this.ridgeTop, this.scrollFar, true, ridgeColor);
    this._drawRidge(ctx, this.ridgeBot, this.scrollFar, false, ridgeColor);

    // Kelp (fades in abyss).
    const kelpAlpha = 1 - Math.min(1, depthM / 900);
    if (kelpAlpha > 0.05) {
      for (const k of this.kelp) {
        let kx = ((k.x - this.scrollMid) % (W * 2) + W * 2) % (W * 2) - W * 0.5;
        if (kx < -40 || kx > W + 40) continue;
        const sway = Math.sin(time / 920 + k.sway) * 13;
        ctx.save();
        ctx.strokeStyle = mix('kelp') || '#0a4438';
        ctx.lineWidth = k.w;
        ctx.lineCap = 'round';
        ctx.globalAlpha = kelpAlpha * 0.75;
        ctx.beginPath();
        ctx.moveTo(kx, H + 4);
        ctx.quadraticCurveTo(kx + sway * 0.4, H - k.h * 0.55, kx + sway, H - k.h);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Fish silhouettes.
    for (const f of this.fish) {
      ctx.save();
      const fishAlpha = this.currentBiome.id === 'abyss' ? 0.2 : 0.5;
      ctx.fillStyle = `rgba(10,40,60,${fishAlpha})`;
      ctx.translate(f.x, f.y);
      ctx.scale(f.vx > 0 ? 1 : -1, 1);
      ctx.beginPath();
      ctx.ellipse(0, 0, f.s, f.s * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-f.s * 0.8, 0);
      ctx.lineTo(-f.s * 1.55, -f.s * 0.5);
      ctx.lineTo(-f.s * 1.55, f.s * 0.5);
      ctx.closePath();
      ctx.fill();
      // Bioluminescent spots in abyss.
      if (this.currentBiome.id === 'abyss') {
        ctx.save();
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#60f0ff';
        ctx.fillStyle = 'rgba(100,240,255,0.8)';
        ctx.beginPath();
        ctx.arc(f.s * 0.3, 0, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    // Bioluminescent particles.
    for (const p of this.bioParticles) {
      ctx.save();
      const pulse = (Math.sin(time / 400 + p.pulse) + 1) / 2;
      ctx.globalAlpha = p.alpha * (0.6 + pulse * 0.4);
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.8 + pulse * 0.2), 0, Math.PI * 2);
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
    const phase = scroll % segW;
    const baseIdx = Math.floor(scroll / segW);
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-segW * 2, isTop ? -10 : H + 10);
    for (let i = -1; i <= Math.ceil(W / segW) + 2; i++) {
      const idx = (((baseIdx + i) % pts.length) + pts.length) % pts.length;
      ctx.lineTo(i * segW - phase, pts[idx]);
    }
    ctx.lineTo(W + segW * 2, isTop ? -10 : H + 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawVignette(ctx, biome) {
    const { W, H } = this;
    const glowAlpha = this._biomeT;
    // Standard dark vignette.
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,15,0.48)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);

    // Biome glow vignette (abyss/rift add colored edges).
    if (glowAlpha > 0 && biome?.ambientColor) {
      const ag = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.5, W / 2, H / 2, Math.max(W, H) * 0.78);
      ag.addColorStop(0, 'rgba(0,0,0,0)');
      ag.addColorStop(1, biome.ambientColor);
      ctx.globalAlpha = glowAlpha;
      ctx.fillStyle = ag;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }
}
