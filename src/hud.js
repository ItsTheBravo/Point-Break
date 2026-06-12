import { PAL, TUNE } from './constants.js';

function drawHeart(ctx, x, y, s, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, s * 0.35);
  ctx.bezierCurveTo(-s, -s * 0.45, -s * 0.5, -s * 1.1, 0, -s * 0.4);
  ctx.bezierCurveTo(s * 0.5, -s * 1.1, s, -s * 0.45, 0, s * 0.35);
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = PAL.danger;
    ctx.fill();
  } else {
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = PAL.danger;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPearlIcon(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.6, PAL.pearl);
  g.addColorStop(1, '#e0bd6e');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export class HUD {
  constructor() {
    this.hintAlpha = 1;
    this.swims = 0;
    this.muteRect = null;
  }

  notifySwim() { this.swims++; }

  update(step) {
    if (this.swims > 4) {
      this.hintAlpha = Math.max(0, this.hintAlpha - 0.01 * step);
    }
  }

  draw(ctx, W, H, player, sessionPearls, distM, bestM, combo, comboTimerFrac, muted, time) {
    const pad = 12;

    // ── Hearts + shield ──
    ctx.save();
    ctx.fillStyle = PAL.hudBg;
    const hbW = player.stats.maxHealth * 24 + player.shield * 24 + 18;
    this._round(ctx, pad, pad, hbW, 32, 9);
    ctx.fill();
    for (let i = 0; i < player.stats.maxHealth; i++) {
      drawHeart(ctx, pad + 20 + i * 24, pad + 17, 9, i < player.health);
    }
    for (let i = 0; i < player.shield; i++) {
      const sx = pad + 20 + player.stats.maxHealth * 24 + i * 24;
      ctx.strokeStyle = 'rgba(120,220,255,0.9)';
      ctx.fillStyle = 'rgba(120,220,255,0.2)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx, pad + 16, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // ── Distance, top center ──
    ctx.save();
    ctx.font = "bold 22px 'Courier New', monospace";
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    const distText = `${distM}m`;
    ctx.strokeText(distText, W / 2, pad + 24);
    ctx.fillStyle = '#cfe8ff';
    ctx.fillText(distText, W / 2, pad + 24);
    if (bestM > 0 && distM < bestM) {
      ctx.font = "11px 'Courier New', monospace";
      ctx.fillStyle = 'rgba(180,210,235,0.6)';
      ctx.fillText(`best ${bestM}m`, W / 2, pad + 40);
    }
    ctx.restore();

    // ── Pearls, top right (below mute) ──
    ctx.save();
    ctx.fillStyle = PAL.hudBg;
    this._round(ctx, W - 108 - pad, pad, 108, 32, 9);
    ctx.fill();
    drawPearlIcon(ctx, W - 108 - pad + 18, pad + 16, 8);
    ctx.font = "bold 17px 'Courier New', monospace";
    ctx.fillStyle = PAL.pearl;
    ctx.textAlign = 'left';
    ctx.fillText(`${sessionPearls}`, W - 108 - pad + 33, pad + 22);
    ctx.restore();

    // ── Combo meter under the distance counter ──
    if (combo > 0) {
      ctx.save();
      const cw = 120, cx = (W - cw) / 2, cy = pad + 46;
      ctx.fillStyle = PAL.hudBg;
      this._round(ctx, cx, cy, cw, 22, 7);
      ctx.fill();
      const tier = combo >= TUNE.comboTier3 ? 3 : combo >= TUNE.comboTier2 ? 2 : 1;
      const tierColor = tier === 3 ? '#ff7ad9' : tier === 2 ? PAL.gold : PAL.cyan;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      this._round(ctx, cx + 5, cy + 14, cw - 10, 4, 2);
      ctx.fill();
      ctx.fillStyle = tierColor;
      this._round(ctx, cx + 5, cy + 14, (cw - 10) * comboTimerFrac, 4, 2);
      ctx.fill();
      ctx.font = "bold 11px 'Courier New', monospace";
      ctx.fillStyle = tierColor;
      ctx.textAlign = 'left';
      ctx.fillText(`COMBO ${combo}  x${tier}`, cx + 6, cy + 11);
      ctx.restore();
    }

    // ── Dash button, bottom left ──
    const dbR = 34;
    const dbX = pad + dbR + 6;
    const dbY = H - pad - dbR - 6;
    ctx.save();
    const ready = player.dashReady;
    const pulse = ready ? 1 + Math.sin(time / 200) * 0.05 : 1;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = ready ? 'rgba(57,230,255,0.16)' : 'rgba(100,110,120,0.14)';
    ctx.beginPath();
    ctx.arc(dbX, dbY, dbR * pulse, 0, Math.PI * 2);
    ctx.fill();
    // Cooldown arc
    ctx.strokeStyle = ready ? PAL.cyan : 'rgba(140,150,160,0.7)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(dbX, dbY, dbR * pulse, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * player.dashFraction);
    ctx.stroke();
    // Tusk glyph
    ctx.strokeStyle = ready ? PAL.cyan : 'rgba(160,170,180,0.8)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(dbX - 12, dbY + 8);
    ctx.lineTo(dbX + 13, dbY - 7);
    ctx.stroke();
    ctx.font = "bold 10px 'Courier New', monospace";
    ctx.textAlign = 'center';
    ctx.fillStyle = ready ? PAL.cyan : 'rgba(150,160,170,0.8)';
    ctx.fillText(ready ? 'DASH' : '...', dbX, dbY + dbR + 14);
    ctx.restore();

    // ── Swim hint, bottom right (fades out once learned) ──
    if (this.hintAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = this.hintAlpha * (0.5 + Math.sin(time / 350) * 0.15);
      const hx = W - pad - 44, hy = H - pad - 46;
      ctx.strokeStyle = '#bfe8ff';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      for (let i = 0; i < 2; i++) {
        const oy = i * 14 + Math.sin(time / 300) * 3;
        ctx.beginPath();
        ctx.moveTo(hx - 12, hy + oy + 8);
        ctx.lineTo(hx, hy + oy - 4);
        ctx.lineTo(hx + 12, hy + oy + 8);
        ctx.stroke();
      }
      ctx.font = "bold 10px 'Courier New', monospace";
      ctx.textAlign = 'center';
      ctx.fillStyle = '#bfe8ff';
      ctx.fillText('TAP TO SWIM', hx, hy + 40);
      ctx.restore();
    }

    // ── Faint center divider for tap zones ──
    if (this.hintAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = this.hintAlpha * 0.1;
      ctx.strokeStyle = '#fff';
      ctx.setLineDash([6, 10]);
      ctx.beginPath();
      ctx.moveTo(W / 2, H * 0.25);
      ctx.lineTo(W / 2, H * 0.9);
      ctx.stroke();
      ctx.restore();
    }

    this.drawMute(ctx, W, muted);
  }

  drawMute(ctx, W, muted) {
    const s = 34, x = W - s - 10, y = 56;
    this.muteRect = { x: x - 6, y: y - 6, w: s + 12, h: s + 12 };
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = PAL.hudBg;
    this._round(ctx, x, y, s, s, 8);
    ctx.fill();
    // Speaker glyph
    ctx.fillStyle = muted ? 'rgba(160,170,180,0.9)' : '#cfe8ff';
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 14);
    ctx.lineTo(x + 13, y + 14);
    ctx.lineTo(x + 19, y + 9);
    ctx.lineTo(x + 19, y + 25);
    ctx.lineTo(x + 13, y + 20);
    ctx.lineTo(x + 8, y + 20);
    ctx.closePath();
    ctx.fill();
    if (muted) {
      ctx.strokeStyle = PAL.danger;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + 22, y + 11);
      ctx.lineTo(x + 29, y + 23);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#cfe8ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 20, y + 17, 6, -0.9, 0.9);
      ctx.stroke();
    }
    ctx.restore();
  }

  inMute(x, y) {
    const r = this.muteRect;
    return r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  _round(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
