import { PAL, TUNE } from './constants.js';
import { RELICS, RARITY } from './relics.js';

function drawHeart(ctx, x, y, s, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, s * 0.35);
  ctx.bezierCurveTo(-s, -s * 0.45, -s * 0.5, -s * 1.1, 0, -s * 0.4);
  ctx.bezierCurveTo(s * 0.5, -s * 1.1, s, -s * 0.45, 0, s * 0.35);
  ctx.closePath();
  if (filled) { ctx.fillStyle = PAL.danger; ctx.fill(); }
  else { ctx.globalAlpha *= 0.28; ctx.strokeStyle = PAL.danger; ctx.lineWidth = 1.5; ctx.stroke(); }
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

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export class HUD {
  constructor() {
    this.hintAlpha = 1;
    this.swims = 0;
    this.muteRect = null;
    this._lowHealthPulse = 0;
  }

  notifySwim() { this.swims++; }
  update(step, player) {
    if (this.swims > 5) this.hintAlpha = Math.max(0, this.hintAlpha - 0.008 * step);
    if (player && player.health <= 1) {
      this._lowHealthPulse += step * 0.08;
    } else {
      this._lowHealthPulse = 0;
    }
  }

  draw(ctx, W, H, player, sessionPearls, distM, bestM, combo, comboTimerFrac, muted, time, activeRelics, roomInfo = null) {
    const pad = 12;

    // ── Hearts ──
    const hbW = player.stats.maxHealth * 24 + player.shield * 24 + 16;
    ctx.save();
    ctx.fillStyle = PAL.hudBg;
    roundRect(ctx, pad, pad, hbW, 32, 9);
    ctx.fill();
    for (let i = 0; i < player.stats.maxHealth; i++) {
      drawHeart(ctx, pad + 20 + i * 24, pad + 17, 9, i < player.health);
    }
    for (let i = 0; i < player.shield; i++) {
      const sx = pad + 20 + player.stats.maxHealth * 24 + i * 24;
      const sPulse = 1 + Math.sin(time / 250) * 0.04;
      ctx.strokeStyle = 'rgba(120,220,255,0.8)';
      ctx.fillStyle = 'rgba(120,220,255,0.15)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx, pad + 16, 8 * sPulse, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    // Low-health red vignette pulse (Binding of Isaac style).
    if (this._lowHealthPulse > 0) {
      const p = (Math.sin(this._lowHealthPulse * 4) + 1) / 2;
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, `rgba(180,20,20,${p * 0.22})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();

    // ── Distance / Room info, top-center ──
    ctx.save();
    ctx.textAlign = 'center';
    if (roomInfo) {
      const mainLabel = roomInfo.isTreasure ? `${roomInfo.roomDistM}s` : `${roomInfo.roomDistM}m`;
      ctx.font = "bold 20px 'Courier New', monospace";
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 4;
      ctx.strokeText(mainLabel, W / 2, pad + 22);
      ctx.fillStyle = roomInfo.isTreasure ? '#ffd866' : '#cfe8ff';
      ctx.fillText(mainLabel, W / 2, pad + 22);
      ctx.font = "bold 10px 'Courier New', monospace";
      ctx.fillStyle = 'rgba(140,185,220,0.8)';
      ctx.fillText(`FLOOR ${roomInfo.floorNum}  ·  ${roomInfo.roomLabel}`, W / 2, pad + 38);
    } else {
      ctx.font = "bold 22px 'Courier New', monospace";
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 4;
      ctx.strokeText(`${distM}m`, W / 2, pad + 24);
      ctx.fillStyle = '#cfe8ff';
      ctx.fillText(`${distM}m`, W / 2, pad + 24);
      if (bestM > 0 && distM < bestM) {
        ctx.font = "11px 'Courier New', monospace";
        ctx.fillStyle = 'rgba(180,210,235,0.55)';
        ctx.fillText(`best ${bestM}m`, W / 2, pad + 40);
      }
    }
    ctx.restore();

    // ── Pearls, top right ──
    ctx.save();
    ctx.fillStyle = PAL.hudBg;
    roundRect(ctx, W - 114 - pad, pad, 114, 32, 9);
    ctx.fill();
    drawPearlIcon(ctx, W - 114 - pad + 17, pad + 16, 8);
    ctx.font = "bold 17px 'Courier New', monospace";
    ctx.fillStyle = PAL.pearl;
    ctx.textAlign = 'left';
    ctx.fillText(`${sessionPearls}`, W - 114 - pad + 32, pad + 22);
    ctx.restore();

    // ── Combo meter, under distance ──
    if (combo > 0) {
      ctx.save();
      const cw = 130, cx = (W - cw) / 2, cy = pad + 48;
      ctx.fillStyle = PAL.hudBg;
      roundRect(ctx, cx, cy, cw, 22, 7); ctx.fill();
      const tier = combo >= TUNE.comboTier3 ? 3 : combo >= TUNE.comboTier2 ? 2 : 1;
      const tierColor = tier === 3 ? '#ff7ad9' : tier === 2 ? PAL.gold : PAL.cyan;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      roundRect(ctx, cx + 5, cy + 14, cw - 10, 4, 2); ctx.fill();
      ctx.fillStyle = tierColor;
      roundRect(ctx, cx + 5, cy + 14, (cw - 10) * comboTimerFrac, 4, 2); ctx.fill();
      ctx.font = "bold 11px 'Courier New', monospace";
      ctx.fillStyle = tierColor; ctx.textAlign = 'left';
      ctx.fillText(`×${tier}  COMBO ${combo}`, cx + 7, cy + 11);
      ctx.restore();
    }

    // ── Dash button, bottom left ──
    const dbR = 36, dbX = pad + dbR + 6, dbY = H - pad - dbR - 6;
    ctx.save();
    const ready = player.dashReady;
    const dpulse = ready ? 1 + Math.sin(time / 190) * 0.055 : 1;
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = ready ? 'rgba(57,230,255,0.15)' : 'rgba(100,110,120,0.12)';
    ctx.beginPath(); ctx.arc(dbX, dbY, dbR * dpulse, 0, Math.PI * 2); ctx.fill();
    if (ready) { ctx.shadowBlur = 12; ctx.shadowColor = PAL.cyan; }
    ctx.strokeStyle = ready ? PAL.cyan : 'rgba(140,150,160,0.7)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(dbX, dbY, dbR * dpulse, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * player.dashFraction);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = ready ? PAL.cyan : 'rgba(160,170,180,0.7)';
    ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(dbX - 13, dbY + 9); ctx.lineTo(dbX + 14, dbY - 8); ctx.stroke();
    ctx.font = "bold 10px 'Courier New', monospace"; ctx.textAlign = 'center';
    ctx.fillStyle = ready ? PAL.cyan : 'rgba(150,160,170,0.8)';
    ctx.fillText(ready ? 'DASH' : '...', dbX, dbY + dbR + 15);
    ctx.restore();

    // ── Relic strip (bottom, above dash/swim zones) ──
    if (activeRelics && activeRelics.length > 0) {
      const relicSize = 26;
      const relicPad = 5;
      const totalW = activeRelics.length * (relicSize + relicPad) - relicPad;
      const rx = (W - totalW) / 2;
      const ry = H - relicSize - 22;
      ctx.save();
      ctx.globalAlpha = 0.88;
      for (let i = 0; i < activeRelics.length; i++) {
        const r = activeRelics[i];
        const rarity = RARITY[r.rarity];
        const bx = rx + i * (relicSize + relicPad);
        ctx.fillStyle = 'rgba(5,14,28,0.85)';
        ctx.strokeStyle = rarity.color;
        ctx.lineWidth = 1.2;
        roundRect(ctx, bx, ry, relicSize, relicSize, 6);
        ctx.fill(); ctx.stroke();
        // Simple coloured dot as placeholder icon.
        ctx.fillStyle = rarity.color;
        ctx.beginPath();
        ctx.arc(bx + relicSize / 2, ry + relicSize / 2, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ── Swim hint, bottom right ──
    if (this.hintAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = this.hintAlpha * (0.45 + Math.sin(time / 360) * 0.18);
      const hx = W - pad - 44, hy = H - pad - 50;
      ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      for (let i = 0; i < 2; i++) {
        const oy = i * 14 + Math.sin(time / 310) * 3;
        ctx.beginPath();
        ctx.moveTo(hx - 12, hy + oy + 8); ctx.lineTo(hx, hy + oy - 4); ctx.lineTo(hx + 12, hy + oy + 8);
        ctx.stroke();
      }
      ctx.font = "bold 10px 'Courier New', monospace";
      ctx.textAlign = 'center'; ctx.fillStyle = '#bfe8ff';
      ctx.fillText('TAP TO SWIM', hx, hy + 42);
      ctx.restore();
    }

    // ── Faint center divider ──
    if (this.hintAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = this.hintAlpha * 0.09;
      ctx.strokeStyle = '#fff'; ctx.setLineDash([5, 11]);
      ctx.beginPath(); ctx.moveTo(W / 2, H * 0.22); ctx.lineTo(W / 2, H * 0.9); ctx.stroke();
      ctx.restore();
    }

    this.drawMute(ctx, W, muted);
  }

  drawMute(ctx, W, muted) {
    const s = 32, x = W - s - 10, y = 56;
    this.muteRect = { x: x - 6, y: y - 6, w: s + 12, h: s + 12 };
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = PAL.hudBg;
    roundRect(ctx, x, y, s, s, 8); ctx.fill();
    ctx.fillStyle = muted ? 'rgba(160,170,180,0.9)' : '#cfe8ff';
    ctx.beginPath();
    ctx.moveTo(x + 7, y + 12); ctx.lineTo(x + 12, y + 12); ctx.lineTo(x + 18, y + 7);
    ctx.lineTo(x + 18, y + 25); ctx.lineTo(x + 12, y + 20); ctx.lineTo(x + 7, y + 20);
    ctx.closePath(); ctx.fill();
    if (muted) {
      ctx.strokeStyle = PAL.danger; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x + 21, y + 10); ctx.lineTo(x + 28, y + 22); ctx.stroke();
    } else {
      ctx.strokeStyle = '#cfe8ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x + 20, y + 16, 5.5, -0.9, 0.9); ctx.stroke();
    }
    ctx.restore();
  }

  inMute(x, y) {
    const r = this.muteRect;
    return r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }
}
