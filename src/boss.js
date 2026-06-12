import { PAL } from './constants.js';

// ── Shared projectile ─────────────────────────────────────────────────────

class Projectile {
  constructor(x, y, vx, vy, r, color, glowColor) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.r = r;
    this.color = color;
    this.glowColor = glowColor || color;
    this.gone = false;
    this.age = 0;
  }

  update(step, dt) {
    this.x += this.vx * step;
    this.y += this.vy * step;
    this.age += dt;
  }

  // Returns 'boss' if dashable hit, 'player' if collided while not dashing, null otherwise.
  check(player) {
    if (this.gone) return null;
    const dx = player.x - this.x, dy = player.y - this.y;
    if (dx * dx + dy * dy < (player.r + this.r) ** 2) {
      this.gone = true;
      return player.isDashing ? 'boss' : 'player';
    }
    return null;
  }

  get offscreen() { return this.x < -this.r - 20; }

  draw(ctx, time) {
    if (this.gone) return;
    const pulse = 0.75 + Math.sin(time / 130 + this.x) * 0.2;
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = this.glowColor;
    ctx.globalAlpha *= pulse;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
    // Bright core
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha *= 0.55;
    ctx.beginPath();
    ctx.arc(this.x - this.r * 0.3, this.y - this.r * 0.3, this.r * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Base class ─────────────────────────────────────────────────────────────

class Boss {
  constructor(name, W, H, maxHp) {
    this.name = name;
    this.W = W; this.H = H;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.phase = 'enter';
    this.phaseTimer = 0;
    this.defeated = false;
    this.defeatTimer = 0;
    this.hitFlash = 0;
    this.projectiles = [];
  }

  _hit(g) {
    if (this.hp <= 0 || this.defeated) return;
    this.hp--;
    this.hitFlash = 320;
    g.Sound.shatter();
    g.shake.add(0.5);
    g.flash.trigger('#ffffff', 0.22);
    g.floaters.add(this.W * 0.6, this.H * 0.4, this.hp > 0 ? '-1 HP!' : 'DEAD!', {
      color: this.hp > 0 ? '#ff5252' : '#ffd866', size: 22,
    });
    if (this.hp <= 0) {
      this.defeated = true;
      this.defeatTimer = 2200;
      this.phase = 'dying';
      g.Sound.death();
      g.shake.add(0.9);
      g.flash.trigger('#ffd866', 0.38);
      for (let i = 0; i < 6; i++) {
        setTimeout(() => {
          if (g.particles) g.particles.emit(
            this.W * 0.5 + Math.random() * 140,
            this.H * 0.25 + Math.random() * this.H * 0.45,
            { count: 20, color: '#ffd866', speed: 4.5, spread: Math.PI * 2, radius: 4 }
          );
        }, i * 220);
      }
    }
  }

  _updateProjectiles(step, dt, player, g) {
    for (const p of this.projectiles) {
      p.update(step, dt);
      const result = p.check(player);
      if (result === 'boss') {
        this._hit(g);
        g._fireRelicHook('onReflect', p);
        player.invincibleTimer = Math.max(player.invincibleTimer, 900);
        g.particles.emit(p.x, p.y, { count: 12, color: p.glowColor, speed: 3.5, spread: Math.PI * 2, radius: 3 });
      } else if (result === 'player' && !player.invincible) {
        g._applyDamage(false);
        g.particles.emit(p.x, p.y, { count: 8, color: p.color, speed: 2.5, spread: Math.PI * 2, radius: 2.5 });
      }
    }
    this.projectiles = this.projectiles.filter(p => !p.gone && !p.offscreen);
  }

  drawHPBar(ctx, W, H) {
    const bw = Math.min(280, W * 0.65);
    const bx = (W - bw) / 2, by = H - 56;
    const bh = 14;
    ctx.fillStyle = 'rgba(10,20,35,0.85)';
    ctx.strokeStyle = 'rgba(255,60,80,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    this._rr(ctx, bx - 2, by - 2, bw + 4, bh + 4, 8); ctx.fill(); ctx.stroke();
    const pct = Math.max(0, this.hp / this.maxHp);
    const grad = ctx.createLinearGradient(bx, 0, bx + bw * pct, 0);
    grad.addColorStop(0, '#ff2040'); grad.addColorStop(1, '#ff7060');
    ctx.fillStyle = grad;
    ctx.beginPath();
    this._rr(ctx, bx, by, bw * pct, bh, 6); ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.fillStyle = 'rgba(255,200,200,0.9)';
    ctx.fillText(this.name.toUpperCase(), W / 2, by - 8);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2;
    for (let i = 1; i < this.maxHp; i++) {
      const tx = bx + (i / this.maxHp) * bw;
      ctx.beginPath(); ctx.moveTo(tx, by); ctx.lineTo(tx, by + bh); ctx.stroke();
    }
    // "DASH PROJECTILES" hint
    ctx.font = "9px 'Courier New', monospace";
    ctx.fillStyle = 'rgba(57,230,255,0.6)';
    ctx.fillText('DASH ← PROJECTILES TO REFLECT', W / 2, by + bh + 13);
  }

  _rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
}

// ── The Orca ───────────────────────────────────────────────────────────────
// Patrols right side, fires sonar pulses leftward in spread patterns.
// Dash through the glowing orbs to reflect them and deal damage.

export class OrcaBoss extends Boss {
  constructor(W, H) {
    super('The Orca', W, H, 3);
    this.x = W + 180;
    this.y = H / 2;
    this.targetY = H / 2;
    this.bodyW = 175; this.bodyH = 95;
    this._fireCooldown = 1600;
    this._enterT = 0;
    this.jawAngle = 0;
    this._jawDir = 1;
    this.warnBand = null;  // { y, h, life }
  }

  update(dt, step, player, g) {
    if (this.hitFlash > 0) this.hitFlash -= dt;

    // Enter slide-in
    if (this.phase === 'enter') {
      this.x -= 3.2 * step;
      if (this.x <= this.W * 0.72) { this.x = this.W * 0.72; this.phase = 'battle'; }
      return;
    }
    if (this.phase === 'dying') {
      this.x += 1.8 * step;
      this.defeatTimer -= dt;
      return;
    }

    // Patrol
    this.y += (this.targetY - this.y) * 0.022 * step;
    if (Math.abs(this.y - this.targetY) < 12) {
      this.targetY = g.H * (0.18 + Math.random() * 0.64);
    }

    // Jaw animate
    this.jawAngle += this._jawDir * 0.008 * step;
    if (this.jawAngle > 0.28 || this.jawAngle < 0) this._jawDir *= -1;

    // Fire sonar spread
    this._fireCooldown -= dt;
    if (this._fireCooldown <= 0) {
      this._fireCooldown = 2400 - (3 - this.hp) * 350;
      const spd = 3.8 + (3 - this.hp) * 0.6;
      const spread = [-0.55, 0, 0.55];
      for (const angle of spread) {
        const vx = -spd * Math.cos(angle);
        const vy = spd * Math.sin(angle) * 0.7;
        this.projectiles.push(new Projectile(
          this.x - 10, this.y, vx, vy, 16, PAL.cyan, 'rgba(57,230,255,0.9)'
        ));
      }
      // Warn band at player's current row
      this.warnBand = { y: player.y - 40, h: 80, life: 600 };
      g.Sound.shieldPop?.();
    }

    // Warn band decay
    if (this.warnBand) {
      this.warnBand.life -= dt;
      if (this.warnBand.life <= 0) this.warnBand = null;
    }

    this._updateProjectiles(step, dt, player, g);
  }

  draw(ctx, time, W, H) {
    // Warn band
    if (this.warnBand) {
      const a = Math.max(0, this.warnBand.life / 600) * 0.12;
      ctx.fillStyle = `rgba(57,230,255,${a})`;
      ctx.fillRect(0, this.warnBand.y, W, this.warnBand.h);
    }

    // Projectiles
    for (const p of this.projectiles) p.draw(ctx, time);

    if (this.x > W + this.bodyW + 10) return;
    const flash = this.hitFlash > 0 && Math.floor(this.hitFlash / 60) % 2 === 0;
    const dyingA = this.phase === 'dying' ? Math.max(0, this.defeatTimer / 2200) : 1;

    ctx.save();
    ctx.globalAlpha *= dyingA;
    ctx.translate(this.x, this.y);

    // Tail flukes
    for (const dir of [-1, 1]) {
      ctx.fillStyle = flash ? '#fff' : '#18222c';
      ctx.beginPath();
      ctx.moveTo(-this.bodyW * 0.42, 0);
      ctx.quadraticCurveTo(-this.bodyW * 0.72, dir * this.bodyH * 0.52, -this.bodyW * 0.64, dir * this.bodyH * 0.92);
      ctx.quadraticCurveTo(-this.bodyW * 0.5, dir * this.bodyH * 0.22, -this.bodyW * 0.42, 0);
      ctx.closePath(); ctx.fill();
    }

    // Dorsal fin
    ctx.fillStyle = flash ? '#fff' : '#18222c';
    ctx.beginPath();
    ctx.moveTo(this.bodyW * 0.05, -this.bodyH * 0.5);
    ctx.quadraticCurveTo(this.bodyW * 0.2, -this.bodyH * 1.08, this.bodyW * 0.36, -this.bodyH * 0.5);
    ctx.closePath(); ctx.fill();

    // Body
    ctx.save();
    if (flash) { ctx.shadowBlur = 22; ctx.shadowColor = '#fff'; }
    ctx.fillStyle = flash ? '#fff' : '#18222c';
    ctx.beginPath();
    ctx.ellipse(0, 0, this.bodyW * 0.52, this.bodyH * 0.47, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Belly
    ctx.fillStyle = 'rgba(235,245,255,0.82)';
    ctx.beginPath();
    ctx.ellipse(this.bodyW * 0.1, this.bodyH * 0.12, this.bodyW * 0.3, this.bodyH * 0.27, 0, 0, Math.PI * 2);
    ctx.fill();

    // Jaws
    ctx.save();
    ctx.translate(this.bodyW * 0.48, 0);
    ctx.fillStyle = flash ? '#fff' : '#10181e';
    for (const [sign, rot] of [[-1, -this.jawAngle], [1, this.jawAngle]]) {
      ctx.save(); ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(this.bodyW * 0.26, sign * this.bodyH * 0.1, this.bodyW * 0.2, sign * this.bodyH * 0.34);
      ctx.quadraticCurveTo(0, sign * this.bodyH * 0.24, 0, 0);
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.restore();

    // Eye
    ctx.save();
    ctx.shadowBlur = 12; ctx.shadowColor = PAL.cyan;
    ctx.fillStyle = PAL.cyan;
    ctx.beginPath(); ctx.arc(this.bodyW * 0.32, -this.bodyH * 0.2, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0a1820';
    ctx.beginPath(); ctx.arc(this.bodyW * 0.33, -this.bodyH * 0.21, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.restore();
    if (!this.defeated) this.drawHPBar(ctx, W, H);
  }
}

// ── The Angler ─────────────────────────────────────────────────────────────
// Ceiling-mounted. Fires bioluminescent lure-bombs that home slightly.
// Sweep electric current bands horizontally — swim above or below.
// Dash through the lure projectiles to reflect them.

export class AnglerBoss extends Boss {
  constructor(W, H) {
    super('The Angler', W, H, 4);
    this.bodyX = W * 0.82;
    this.bodyY = H * 0.08;
    this.x = this.bodyX; // alias for drawHPBar centering
    this._fireCooldown = 1800;
    this._currentBand = null;  // { y, h, life, maxLife }
    this._bandCooldown = 3200;
    this.lureLine = { x: W * 0.82, y: H * 0.08 };
  }

  update(dt, step, player, g) {
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.phase === 'dying') { this.defeatTimer -= dt; return; }

    // Fire homing bombs
    this._fireCooldown -= dt;
    if (this._fireCooldown <= 0) {
      this._fireCooldown = 2200 - (4 - this.hp) * 280;
      const count = 1 + Math.floor((4 - this.hp) / 2);
      for (let i = 0; i < count; i++) {
        const offY = (i - (count - 1) / 2) * 55;
        const vx = -(3.2 + (4 - this.hp) * 0.5);
        const vy = (player.y + offY - this.bodyY) / g.W * 2;
        this.projectiles.push(new Projectile(
          this.bodyX - 25, this.bodyY + 60 + offY * 0.5,
          vx, vy, 14, '#ffd866', '#ffaa00'
        ));
      }
    }

    // Electric current sweep
    this._bandCooldown -= dt;
    if (this._bandCooldown <= 0 && !this._currentBand) {
      this._bandCooldown = 3800 - (4 - this.hp) * 400;
      const bh = g.H * 0.22;
      const fromTop = Math.random() < 0.5;
      const by = fromTop ? 0 : g.H - bh;
      this._currentBand = { y: by, h: bh, life: 1400, maxLife: 1400, warn: 700, fromTop };
      g.floaters.add(g.W * 0.45, g.H / 2, fromTop ? '↑ DODGE!' : '↓ DODGE!', { color: '#ffaa00', size: 16 });
    }
    if (this._currentBand) {
      this._currentBand.life -= dt;
      // Check player collision when active (after warn)
      if (this._currentBand.life < this._currentBand.maxLife - this._currentBand.warn) {
        if (!player.invincible) {
          const inBand = player.y + player.r > this._currentBand.y &&
                         player.y - player.r < this._currentBand.y + this._currentBand.h;
          if (inBand) g._applyDamage(false);
        }
      }
      if (this._currentBand.life <= 0) this._currentBand = null;
    }

    this._updateProjectiles(step, dt, player, g);
  }

  draw(ctx, time, W, H) {
    const flash = this.hitFlash > 0 && Math.floor(this.hitFlash / 60) % 2 === 0;
    const dyingA = this.phase === 'dying' ? Math.max(0, this.defeatTimer / 2200) : 1;
    ctx.save();
    ctx.globalAlpha *= dyingA;

    // Electric band
    if (this._currentBand) {
      const b = this._currentBand;
      const active = b.life < b.maxLife - b.warn;
      const a = active ? 0.28 : 0.1 + 0.08 * Math.sin(time / 80);
      ctx.fillStyle = `rgba(255,180,0,${a})`;
      ctx.fillRect(0, b.y, W, b.h);
      if (active) {
        ctx.strokeStyle = `rgba(255,200,0,${a * 1.8})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 8]);
        ctx.beginPath(); ctx.moveTo(0, b.y); ctx.lineTo(W, b.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, b.y + b.h); ctx.lineTo(W, b.y + b.h); ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Lure string + projectile hints
    for (const p of this.projectiles) {
      ctx.save();
      ctx.strokeStyle = 'rgba(80,50,120,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(this.bodyX - 10, this.bodyY + 60);
      ctx.quadraticCurveTo(this.bodyX - 20, (this.bodyY + p.y) / 2, p.x, p.y);
      ctx.stroke();
      ctx.restore();
      p.draw(ctx, time);
    }

    // Body at top-right
    ctx.save();
    ctx.translate(this.bodyX, this.bodyY);
    ctx.fillStyle = flash ? '#fff' : '#1a0830';
    ctx.beginPath();
    ctx.ellipse(0, -25, 52, 78, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eye
    ctx.save();
    ctx.shadowBlur = 14; ctx.shadowColor = '#ffd866';
    ctx.fillStyle = '#ffd866';
    ctx.beginPath(); ctx.arc(-10, -35, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a0000';
    ctx.beginPath(); ctx.arc(-9, -35, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Antennae lure
    ctx.strokeStyle = 'rgba(100,80,160,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(5, -80); ctx.lineTo(0, 60); ctx.stroke();
    ctx.save();
    ctx.shadowBlur = 18; ctx.shadowColor = '#ffd866';
    ctx.fillStyle = '#ffd866';
    ctx.beginPath(); ctx.arc(0, 68, 10, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.restore();

    ctx.restore();
    if (!this.defeated) this.drawHPBar(ctx, W, H);
  }
}

// ── The Kraken ─────────────────────────────────────────────────────────────
// Fires ink volleys from the right. Every 3 volleys, a glowing core
// appears at centre-right — dash it for a hit.

export class KrakenBoss extends Boss {
  constructor(W, H) {
    super('The Kraken', W, H, 5);
    this.x = W * 0.8;
    this.arms = [];
    this._armCooldown = 700;
    this._salvoCount = 0;
    this._vulnerable = false;
    this._vulnTimer = 0;
    this._coreX = W * 0.62;
    this._coreY = H * 0.5;
  }

  update(dt, step, player, g) {
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.phase === 'dying') { this.defeatTimer -= dt; return; }

    // Arms from right + top/bottom
    this._armCooldown -= dt;
    if (this._armCooldown <= 0) {
      this._armCooldown = 1500 - (5 - this.hp) * 160;
      this._launchSalvo(g);
      this._salvoCount++;

      if (this._salvoCount % 3 === 0) {
        this._vulnerable = true;
        this._vulnTimer = 1600;
        this._coreX = g.W * 0.58 + Math.random() * g.W * 0.1;
        this._coreY = g.H * 0.3 + Math.random() * g.H * 0.4;
        g.floaters.add(g.W * 0.5, g.H * 0.45, 'WEAK POINT! DASH!', { color: PAL.cyan, size: 15 });
      }
    }

    if (this._vulnerable) {
      this._vulnTimer -= dt;
      if (this._vulnTimer <= 0) { this._vulnerable = false; }
      else if (player.isDashing) {
        const dx = player.x - this._coreX, dy = player.y - this._coreY;
        if (dx * dx + dy * dy < (player.r + 38) ** 2) {
          this._vulnerable = false;
          this._hit(g);
          player.invincibleTimer = Math.max(player.invincibleTimer, 1100);
          g.particles.emit(this._coreX, this._coreY, { count: 22, color: PAL.cyan, speed: 4, spread: Math.PI * 2, radius: 3.5 });
        }
      }
    }

    for (const arm of this.arms) {
      arm.life -= dt;
      arm.extendT = Math.min(1, arm.extendT + dt / 480);
      const ret = Math.max(0, (arm.life - arm.maxLife * 0.38) / (arm.maxLife * 0.62));
      arm.reach = arm.maxReach * arm.extendT * ret;

      const tipX = arm.fromRight ? g.W - arm.reach : arm.x;
      const tipY = arm.fromRight ? arm.y : (arm.fromTop ? arm.reach : g.H - arm.reach);

      if (!arm.hit && !player.invincible) {
        const dx = player.x - tipX, dy = player.y - tipY;
        if (dx * dx + dy * dy < (player.r + 20) ** 2) {
          arm.hit = true;
          if (!player.isDashing) g._applyDamage(false);
        }
      }
    }
    this.arms = this.arms.filter(a => a.life > 0);

    this._updateProjectiles(step, dt, player, g);
  }

  _launchSalvo(g) {
    // Ink blobs from right side
    const count = 1 + Math.floor((5 - this.hp) / 2);
    for (let i = 0; i < count; i++) {
      const vy = (Math.random() - 0.5) * 2.5;
      this.projectiles.push(new Projectile(
        g.W + 20, g.H * 0.2 + Math.random() * g.H * 0.6,
        -(2.8 + (5 - this.hp) * 0.4), vy,
        20, '#400808', 'rgba(255,60,20,0.8)'
      ));
    }
    // Arm from top or bottom
    const fromTop = Math.random() < 0.5;
    this.arms.push({
      x: g.W * 0.15 + Math.random() * g.W * 0.4,
      y: g.H * 0.3 + Math.random() * g.H * 0.4,
      fromTop, fromRight: false,
      maxReach: g.H * (0.32 + Math.random() * 0.22),
      reach: 0, extendT: 0,
      maxLife: 1900, life: 1900, hit: false,
    });
  }

  draw(ctx, time, W, H) {
    const flash = this.hitFlash > 0 && Math.floor(this.hitFlash / 60) % 2 === 0;
    const dyingA = this.phase === 'dying' ? Math.max(0, this.defeatTimer / 2200) : 1;
    ctx.save();
    ctx.globalAlpha *= dyingA;

    // Tentacle arms
    for (const arm of this.arms) {
      const tipY = arm.fromTop ? arm.reach : H - arm.reach;
      const startY = arm.fromTop ? 0 : H;
      ctx.save();
      ctx.shadowBlur = 10; ctx.shadowColor = flash ? '#fff' : 'rgba(255,60,20,0.6)';
      ctx.strokeStyle = flash ? '#fff' : '#2a0808';
      ctx.lineWidth = 26; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(arm.x, startY);
      ctx.quadraticCurveTo(arm.x + Math.sin(time / 180) * 28, (startY + tipY) / 2, arm.x, tipY);
      ctx.stroke();
      // Suction rings
      ctx.strokeStyle = '#601010'; ctx.lineWidth = 2;
      for (let s = 1; s < 5; s++) {
        const ty = startY + (tipY - startY) * (s / 5);
        ctx.beginPath(); ctx.arc(arm.x + Math.sin(time / 200) * 4, ty, 7, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = flash ? '#fff' : '#400808';
      ctx.beginPath(); ctx.arc(arm.x, tipY, 15, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // Ink projectiles
    for (const p of this.projectiles) p.draw(ctx, time);

    // Vulnerable core
    if (this._vulnerable) {
      const pulse = 0.6 + Math.sin(time / 95) * 0.38;
      const timeLeft = this._vulnTimer / 1600;
      ctx.save();
      ctx.shadowBlur = 28; ctx.shadowColor = PAL.cyan;
      ctx.strokeStyle = `rgba(57,230,255,${pulse})`;
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(this._coreX, this._coreY, 36, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(this._coreX, this._coreY, 36 * timeLeft, 0, Math.PI * 2 * timeLeft); ctx.stroke();
      ctx.fillStyle = `rgba(57,230,255,${pulse * 0.18})`;
      ctx.beginPath(); ctx.arc(this._coreX, this._coreY, 36, 0, Math.PI * 2); ctx.fill();
      ctx.font = "bold 11px 'Courier New', monospace"; ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(57,230,255,${pulse})`;
      ctx.fillText('CORE', this._coreX, this._coreY + 4);
      ctx.restore();
    }

    // Kraken body silhouette at right edge
    ctx.save();
    ctx.translate(W * 0.88, H * 0.45);
    ctx.fillStyle = flash ? '#fff' : '#1a0408';
    ctx.beginPath();
    ctx.ellipse(0, 0, 65, 90, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eye
    ctx.save();
    ctx.shadowBlur = 16; ctx.shadowColor = '#ff4020';
    ctx.fillStyle = '#ff4020';
    ctx.beginPath(); ctx.arc(-15, -20, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#200000';
    ctx.beginPath(); ctx.arc(-12, -20, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.restore();

    ctx.restore();
    if (!this.defeated) this.drawHPBar(ctx, W, H);
  }
}

export function createBoss(bossName, W, H) {
  if (bossName === 'The Orca')   return new OrcaBoss(W, H);
  if (bossName === 'The Angler') return new AnglerBoss(W, H);
  if (bossName === 'The Kraken') return new KrakenBoss(W, H);
  return new OrcaBoss(W, H);
}
