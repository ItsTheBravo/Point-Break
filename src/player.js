import { TUNE, PAL } from './constants.js';

// Standalone narwhal renderer so the start screen and ghost trail can
// reuse it. Replace the body of this function with sprite blitting later.
export function drawNarwhal(ctx, { dashing = false, time = 0, tailPhase = 0, blink = false, alpha = 1, tint = null } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  const body = tint || (dashing ? PAL.narDash : PAL.narBody);

  if (dashing) {
    ctx.shadowBlur = 16;
    ctx.shadowColor = PAL.narDash;
  }

  // Tail (animated flap)
  const flap = Math.sin(tailPhase) * 7;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.quadraticCurveTo(-30, -4 + flap * 0.4, -36, -10 + flap);
  ctx.quadraticCurveTo(-30, 0, -36, 10 + flap);
  ctx.quadraticCurveTo(-30, 4 + flap * 0.4, -18, 0);
  ctx.closePath();
  ctx.fill();

  // Body
  ctx.beginPath();
  ctx.ellipse(0, 0, 25, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Belly
  ctx.fillStyle = PAL.narBelly;
  ctx.globalAlpha *= 0.85;
  ctx.beginPath();
  ctx.ellipse(3, 6, 16, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha /= 0.85;

  // Dorsal ridge
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-4, -14);
  ctx.quadraticCurveTo(4, -22, 12, -13);
  ctx.closePath();
  ctx.fill();

  // Side fin
  ctx.beginPath();
  ctx.moveTo(2, 6);
  ctx.quadraticCurveTo(-4, 16 + flap * 0.3, -10, 12);
  ctx.quadraticCurveTo(-4, 8, 2, 6);
  ctx.closePath();
  ctx.fill();

  // Tusk with spiral marks
  ctx.strokeStyle = dashing ? '#ffffff' : '#f3ecdc';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(20, -5);
  ctx.lineTo(46, -9);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const tx = 25 + i * 7;
    ctx.beginPath();
    ctx.moveTo(tx, -7.5 + i * -0.4);
    ctx.lineTo(tx + 3, -4.5 + i * -0.4);
    ctx.stroke();
  }

  // Eye (blinks)
  ctx.fillStyle = PAL.narEye;
  ctx.beginPath();
  if (blink) {
    ctx.ellipse(12, -4, 3.4, 0.8, 0, 0, Math.PI * 2);
  } else {
    ctx.arc(12, -4, 3.4, 0, Math.PI * 2);
  }
  ctx.fill();
  if (!blink) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(13.2, -5.2, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export class Player {
  constructor(x, y, stats) {
    this.x = x;
    this.baseX = x;
    this.y = y;
    this.vy = 0;
    this.r = 17; // circular hitbox
    this.stats = stats;
    this.health = stats.maxHealth;
    this.shield = stats.shield;

    this.angle = 0;
    this.scaleX = 1;
    this.scaleY = 1;
    this.tailPhase = 0;
    this.blinkTimer = 1500 + Math.random() * 3000;
    this.blinking = 0;

    this.isDashing = false;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.invincibleTimer = 0;
    this.hitFlashTimer = 0;
    this.ghosts = [];
    this._ghostClock = 0;
  }

  swim() {
    this.vy = this.stats.swimForce;
    this.scaleY = TUNE.swimSquash;
    this.scaleX = 1.18;
  }

  dash() {
    if (this.dashCooldownTimer > 0 || this.isDashing) return false;
    this.isDashing = true;
    this.dashTimer = this.stats.dashDuration;
    this.invincibleTimer = this.stats.dashDuration + 120;
    return true;
  }

  get dashReady() { return this.dashCooldownTimer <= 0 && !this.isDashing; }

  get dashFraction() {
    if (this.isDashing || this.dashCooldownTimer <= 0) return 1;
    return 1 - this.dashCooldownTimer / this.stats.dashCooldown;
  }

  get invincible() { return this.invincibleTimer > 0; }

  // Returns 'shield' | 'hit' | null
  takeDamage() {
    if (this.invincible) return null;
    if (this.shield > 0) {
      this.shield--;
      this.invincibleTimer = 1100;
      return 'shield';
    }
    this.health--;
    this.invincibleTimer = 1300;
    this.hitFlashTimer = 350;
    return 'hit';
  }

  update(dt, step, speed) {
    this.vy = Math.min(TUNE.maxFall, this.vy + TUNE.gravity * (this.stats.gravityMult || 1) * step);
    this.y += this.vy * step;

    // Tilt with velocity; level out while dashing.
    const targetAngle = this.isDashing ? 0 : Math.max(-0.45, Math.min(0.55, this.vy * 0.055));
    this.angle += (targetAngle - this.angle) * 0.16 * step;

    // Squash recovery.
    this.scaleX += (1 - this.scaleX) * 0.13 * step;
    this.scaleY += (1 - this.scaleY) * 0.13 * step;

    // Tail flaps faster at speed / while dashing.
    this.tailPhase += (0.16 + speed * 0.025 + (this.isDashing ? 0.35 : 0)) * step;

    // Forward lunge while dashing, ease back after.
    const targetX = this.baseX + (this.isDashing ? TUNE.dashForwardLunge : 0);
    this.x += (targetX - this.x) * 0.1 * step;

    // Blinking.
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinking = 140;
      this.blinkTimer = 1800 + Math.random() * 3200;
    }
    if (this.blinking > 0) this.blinking -= dt;

    if (this.isDashing) {
      this.dashTimer -= dt;
      this._ghostClock -= dt;
      if (this._ghostClock <= 0) {
        this.ghosts.push({ x: this.x, y: this.y, angle: this.angle, life: 1 });
        this._ghostClock = 36;
      }
      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.dashCooldownTimer = this.stats.dashCooldown;
      }
    }
    for (const g of this.ghosts) g.life -= 0.06 * step;
    this.ghosts = this.ghosts.filter(g => g.life > 0);

    if (this.dashCooldownTimer > 0) this.dashCooldownTimer = Math.max(0, this.dashCooldownTimer - dt);
    if (this.invincibleTimer > 0) this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);
    if (this.hitFlashTimer > 0) this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
  }

  draw(ctx, time) {
    // Dash afterimages.
    for (const g of this.ghosts) {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.angle);
      drawNarwhal(ctx, { dashing: true, alpha: g.life * 0.3, tint: PAL.narDash, tailPhase: this.tailPhase });
      ctx.restore();
    }

    const flashing = this.hitFlashTimer > 0 && Math.floor(this.hitFlashTimer / 70) % 2 === 0;
    const iframeBlink = !this.isDashing && this.invincibleTimer > 0 && Math.floor(this.invincibleTimer / 110) % 3 === 0;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.scale(this.scaleX, this.scaleY);
    drawNarwhal(ctx, {
      dashing: this.isDashing,
      time,
      tailPhase: this.tailPhase,
      blink: this.blinking > 0,
      alpha: flashing || iframeBlink ? 0.35 : 1,
    });
    ctx.restore();

    // Bubble shield.
    if (this.shield > 0) {
      ctx.save();
      const pulse = 1 + Math.sin(time / 250) * 0.04;
      ctx.strokeStyle = 'rgba(120,220,255,0.7)';
      ctx.fillStyle = 'rgba(120,220,255,0.08)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x + 4, this.y, 34 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}
