import { PAL } from './constants.js';
import { drawNarwhal } from './player.js';
import { drawPearlIcon } from './hud.js';
import { getTotalPearls, getBestM, getBestClassicM } from './storage.js';

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export class StartScreen {
  constructor() {
    this._classicRect = null;
    this._rogueRect   = null;
  }

  hitClassic(x, y) {
    const r = this._classicRect;
    return r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  hitRogue(x, y) {
    const r = this._rogueRect;
    return r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  draw(ctx, W, H, time) {
    const bob = Math.sin(time / 600) * 9;

    ctx.save();
    ctx.fillStyle = 'rgba(2,8,16,0.55)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';

    // Title
    const titleSize = Math.min(30, W * 0.07);
    ctx.font = `bold ${titleSize * 0.65}px 'Courier New', monospace`;
    ctx.fillStyle = 'rgba(156,195,224,0.9)';
    ctx.fillText('ROGUELIKE', W / 2, H * 0.20 + bob * 0.4);

    ctx.font = `bold ${titleSize}px 'Courier New', monospace`;
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText('FLAPPY NARWHAL', W / 2, H * 0.20 + titleSize + 4 + bob * 0.4);
    ctx.fillStyle = PAL.cyan;
    ctx.fillText('FLAPPY NARWHAL', W / 2, H * 0.20 + titleSize + 4 + bob * 0.4);

    // Hero narwhal
    ctx.save();
    ctx.translate(W / 2, H * 0.42 + bob);
    ctx.scale(1.7, 1.7);
    ctx.rotate(Math.sin(time / 800) * 0.06);
    drawNarwhal(ctx, { time, tailPhase: time / 140 });
    ctx.restore();

    // ── Mode buttons ──
    const btnW = Math.min(160, (W - 60) / 2);
    const btnH = 60;
    const gap  = 18;
    const totalBtnW = btnW * 2 + gap;
    const btnY = H * 0.61;
    const classicX = (W - totalBtnW) / 2;
    const rogueX   = classicX + btnW + gap;

    this._classicRect = { x: classicX, y: btnY, w: btnW, h: btnH };
    this._rogueRect   = { x: rogueX,   y: btnY, w: btnW, h: btnH };

    // Classic button
    const classicPulse = 0.85 + Math.sin(time / 340) * 0.12;
    ctx.save();
    ctx.shadowBlur = 14; ctx.shadowColor = 'rgba(255,216,102,0.3)';
    ctx.fillStyle = 'rgba(28,18,6,0.94)';
    roundRect(ctx, classicX, btnY, btnW, btnH, 12); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(255,216,102,${classicPulse})`;
    ctx.lineWidth = 1.8;
    roundRect(ctx, classicX, btnY, btnW, btnH, 12); ctx.stroke();
    ctx.fillStyle = '#ffd866';
    ctx.font = "bold 15px 'Courier New', monospace";
    ctx.fillText('CLASSIC', classicX + btnW / 2, btnY + 23);
    ctx.font = "10px 'Courier New', monospace";
    ctx.fillStyle = 'rgba(255,216,102,0.65)';
    ctx.fillText('endless · hi-score', classicX + btnW / 2, btnY + 39);
    const cbest = getBestClassicM();
    if (cbest > 0) {
      ctx.font = "9px 'Courier New', monospace";
      ctx.fillStyle = 'rgba(255,216,102,0.5)';
      ctx.fillText(`best ${cbest}m`, classicX + btnW / 2, btnY + 53);
    }
    ctx.restore();

    // Roguelike button
    const roguePulse = 0.85 + Math.sin(time / 340 + 1.2) * 0.12;
    ctx.save();
    ctx.shadowBlur = 14; ctx.shadowColor = 'rgba(57,230,255,0.3)';
    ctx.fillStyle = 'rgba(6,18,28,0.94)';
    roundRect(ctx, rogueX, btnY, btnW, btnH, 12); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(57,230,255,${roguePulse})`;
    ctx.lineWidth = 1.8;
    roundRect(ctx, rogueX, btnY, btnW, btnH, 12); ctx.stroke();
    ctx.fillStyle = PAL.cyan;
    ctx.font = "bold 15px 'Courier New', monospace";
    ctx.fillText('ROGUELIKE', rogueX + btnW / 2, btnY + 23);
    ctx.font = "10px 'Courier New', monospace";
    ctx.fillStyle = 'rgba(57,230,255,0.65)';
    ctx.fillText('classes · relics', rogueX + btnW / 2, btnY + 39);
    const rbest = getBestM();
    if (rbest > 0) {
      ctx.font = "9px 'Courier New', monospace";
      ctx.fillStyle = 'rgba(57,230,255,0.5)';
      ctx.fillText(`best ${rbest}m`, rogueX + btnW / 2, btnY + 53);
    }
    ctx.restore();

    // Controls
    ctx.font = "11px 'Courier New', monospace";
    ctx.fillStyle = 'rgba(156,195,224,0.6)';
    ctx.fillText('LEFT tap = dash   ·   RIGHT tap = swim up', W / 2, btnY + btnH + 22);

    // Saved pearls
    const pearls = getTotalPearls();
    if (pearls > 0) {
      ctx.font = "12px 'Courier New', monospace";
      const pText = `${pearls}`;
      const pW = ctx.measureText(pText).width;
      ctx.fillStyle = 'rgba(207,232,255,0.75)';
      drawPearlIcon(ctx, W / 2 - pW / 2 - 11, btnY + btnH + 40, 6);
      ctx.fillText(pText, W / 2 + 3, btnY + btnH + 44);
    }

    ctx.restore();
  }
}
