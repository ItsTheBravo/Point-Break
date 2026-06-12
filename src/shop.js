import { PAL } from './constants.js';
import { UPGRADES, getLevels, upgradeCost, buyUpgrade, getTotalPearls, getChallengeRating } from './storage.js';
import { drawPearlIcon } from './hud.js';
import { Sound } from './audio.js';

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawIcon(ctx, id, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (id) {
    case 'heart':
      ctx.beginPath();
      ctx.moveTo(0, s * 0.4);
      ctx.bezierCurveTo(-s, -s * 0.5, -s * 0.5, -s * 1.2, 0, -s * 0.45);
      ctx.bezierCurveTo(s * 0.5, -s * 1.2, s, -s * 0.5, 0, s * 0.4);
      ctx.closePath();
      ctx.fill();
      break;
    case 'bolt':
      ctx.beginPath();
      ctx.moveTo(s * 0.2, -s);
      ctx.lineTo(-s * 0.5, s * 0.15);
      ctx.lineTo(0, s * 0.15);
      ctx.lineTo(-s * 0.2, s);
      ctx.lineTo(s * 0.5, -s * 0.15);
      ctx.lineTo(0, -s * 0.15);
      ctx.closePath();
      ctx.fill();
      break;
    case 'arrow':
      ctx.beginPath();
      ctx.moveTo(-s, 0);
      ctx.lineTo(s * 0.4, 0);
      ctx.moveTo(0, -s * 0.5);
      ctx.lineTo(s * 0.6, 0);
      ctx.lineTo(0, s * 0.5);
      ctx.stroke();
      break;
    case 'magnet':
      ctx.beginPath();
      ctx.arc(0, -s * 0.15, s * 0.6, Math.PI, 0);
      ctx.moveTo(-s * 0.6, -s * 0.15); ctx.lineTo(-s * 0.6, s * 0.5);
      ctx.moveTo(s * 0.6, -s * 0.15); ctx.lineTo(s * 0.6, s * 0.5);
      ctx.stroke();
      break;
    case 'gem':
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, -s * 0.3);
      ctx.lineTo(s * 0.7, -s * 0.3);
      ctx.lineTo(s * 0.4, s * 0.7);
      ctx.lineTo(-s * 0.4, s * 0.7);
      ctx.closePath();
      ctx.fill();
      break;
    case 'shield':
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.7, -s * 0.5);
      ctx.lineTo(s * 0.7, s * 0.2);
      ctx.quadraticCurveTo(s * 0.7, s * 0.8, 0, s);
      ctx.quadraticCurveTo(-s * 0.7, s * 0.8, -s * 0.7, s * 0.2);
      ctx.lineTo(-s * 0.7, -s * 0.5);
      ctx.closePath();
      ctx.fill();
      break;
  }
  ctx.restore();
}

export class Shop {
  constructor() {
    this.onRestart = null;
    this.runM = 0;
    this.runPearls = 0;
    this.bestM = 0;
    this.isNewBest = false;
    this.bestCombo = 0;
    this.message = '';
    this.messageTimer = 0;
    this.messageGood = true;
    this.openedAt = 0;
    this._rows = [];
    this._playRect = null;
    this._pulse = {};
  }

  show(runM, runPearls, bestM, isNewBest, bestCombo, now) {
    this.runM = runM;
    this.runPearls = runPearls;
    this.bestM = bestM;
    this.isNewBest = isNewBest;
    this.bestCombo = bestCombo;
    this.message = '';
    this.messageTimer = 0;
    this.openedAt = now;
  }

  update(dt) {
    if (this.messageTimer > 0) this.messageTimer = Math.max(0, this.messageTimer - dt);
    for (const k of Object.keys(this._pulse)) {
      this._pulse[k] -= dt;
      if (this._pulse[k] <= 0) delete this._pulse[k];
    }
  }

  handleTap(x, y, now) {
    // Ignore accidental taps right after the shop opens.
    if (now - this.openedAt < 350) return;

    if (this._playRect && this._hit(this._playRect, x, y)) {
      Sound.tap();
      if (this.onRestart) this.onRestart();
      return;
    }

    for (const row of this._rows) {
      if (this._hit(row.rect, x, y)) {
        const res = buyUpgrade(row.id);
        if (res.ok) {
          Sound.buy();
          this._pulse[row.id] = 400;
          this._msg('Upgraded!', true);
        } else if (res.reason === 'maxed') {
          Sound.deny();
          this._msg('Already maxed out', false);
        } else {
          Sound.deny();
          this._msg('Not enough pearls', false);
        }
        return;
      }
    }
  }

  _hit(r, x, y) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  _msg(text, good) {
    this.message = text;
    this.messageGood = good;
    this.messageTimer = 1800;
  }

  draw(ctx, W, H, time) {
    const levels = getLevels();
    const pearls = getTotalPearls();

    // Dim + panel
    ctx.save();
    ctx.fillStyle = 'rgba(2,8,16,0.82)';
    ctx.fillRect(0, 0, W, H);

    const panelW = Math.min(440, W - 24);
    const panelX = (W - panelW) / 2;
    const panelY = 16;
    const panelH = H - 32;

    ctx.fillStyle = 'rgba(7,24,40,0.96)';
    ctx.strokeStyle = 'rgba(57,230,255,0.25)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, panelX, panelY, panelW, panelH, 18);
    ctx.fill();
    ctx.stroke();

    let y = panelY + 38;
    ctx.textAlign = 'center';

    // Header
    ctx.font = "bold 26px 'Courier New', monospace";
    ctx.fillStyle = '#e8f4f8';
    ctx.fillText('RUN COMPLETE', W / 2, y);
    y += 24;

    if (this.isNewBest) {
      const flash = 0.7 + Math.sin(time / 150) * 0.3;
      ctx.font = "bold 16px 'Courier New', monospace";
      ctx.fillStyle = `rgba(255,216,102,${flash})`;
      ctx.fillText('★ NEW BEST! ★', W / 2, y);
      y += 20;
    }

    ctx.font = "13px 'Courier New', monospace";
    ctx.fillStyle = '#9cc3e0';
    ctx.fillText(`${this.runM}m swum  ·  best ${this.bestM}m  ·  combo x${this.bestCombo}`, W / 2, y);
    y += 18;

    // Challenge rating indicator — shows players the difficulty bonus their upgrades impose.
    const cr = getChallengeRating();
    if (cr > 0) {
      const pips = Math.round(cr / 0.30 * 5);
      const filled = '●'.repeat(pips) + '○'.repeat(5 - pips);
      const pct = Math.round(cr * 100);
      ctx.font = "11px 'Courier New', monospace";
      ctx.fillStyle = cr >= 0.20 ? '#ff9540' : cr >= 0.10 ? '#ffd866' : '#9cc3e0';
      ctx.fillText(`CHALLENGE  ${filled}  +${pct}% harder`, W / 2, y);
    }
    y += 16;

    // Pearl balance
    ctx.font = "bold 20px 'Courier New', monospace";
    ctx.fillStyle = PAL.pearl;
    const balText = `${pearls}`;
    const balW = ctx.measureText(balText).width;
    drawPearlIcon(ctx, W / 2 - balW / 2 - 16, y - 7, 9);
    ctx.fillText(balText, W / 2 + 2, y);
    if (this.runPearls > 0) {
      ctx.font = "12px 'Courier New', monospace";
      ctx.fillStyle = PAL.good;
      ctx.fillText(`+${this.runPearls} banked (half of unspent)`, W / 2, y + 16);
    }
    y += 30;

    // Upgrade rows
    const playH = 54;
    const msgH = 24;
    const availH = panelY + panelH - y - playH - msgH - 20;
    const rowH = Math.max(46, Math.min(60, Math.floor(availH / UPGRADES.length) - 6));
    const rowGap = Math.max(4, Math.min(8, Math.floor((availH - rowH * UPGRADES.length) / UPGRADES.length)));
    const rowW = panelW - 28;
    const rowX = panelX + 14;

    this._rows = [];
    for (let i = 0; i < UPGRADES.length; i++) {
      const upg = UPGRADES[i];
      const level = levels[upg.id] || 0;
      const maxed = level >= upg.maxLevel;
      const cost = maxed ? 0 : upgradeCost(upg, level);
      const afford = !maxed && pearls >= cost;
      const ry = y + i * (rowH + rowGap);
      this._rows.push({ id: upg.id, rect: { x: rowX, y: ry, w: rowW, h: rowH } });

      const pulse = this._pulse[upg.id] > 0 ? Math.sin((400 - this._pulse[upg.id]) / 400 * Math.PI) : 0;

      ctx.save();
      if (pulse > 0) {
        ctx.shadowBlur = 14 * pulse;
        ctx.shadowColor = PAL.good;
      }
      ctx.fillStyle = maxed ? 'rgba(40,90,60,0.45)' : afford ? 'rgba(12,60,95,0.85)' : 'rgba(28,38,52,0.7)';
      ctx.strokeStyle = maxed ? 'rgba(80,210,140,0.4)' : afford ? 'rgba(57,230,255,0.45)' : 'rgba(90,105,130,0.3)';
      ctx.lineWidth = 1;
      roundRect(ctx, rowX, ry, rowW, rowH, 10);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      const iconColor = maxed ? PAL.good : afford ? PAL.cyan : 'rgba(140,155,175,0.8)';
      drawIcon(ctx, upg.icon, rowX + 24, ry + rowH / 2, 10, iconColor);

      ctx.textAlign = 'left';
      ctx.font = "bold 14px 'Courier New', monospace";
      ctx.fillStyle = maxed ? '#a9f0c8' : '#e8f4f8';
      ctx.fillText(upg.name, rowX + 44, ry + 19);
      ctx.font = "11px 'Courier New', monospace";
      ctx.fillStyle = '#8fb3d1';
      ctx.fillText(upg.desc, rowX + 44, ry + 34);

      // Level pips
      for (let l = 0; l < upg.maxLevel; l++) {
        ctx.fillStyle = l < level ? PAL.good : 'rgba(255,255,255,0.16)';
        ctx.beginPath();
        ctx.arc(rowX + 48 + l * 13, ry + rowH - 9, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cost
      ctx.textAlign = 'right';
      if (maxed) {
        ctx.font = "bold 12px 'Courier New', monospace";
        ctx.fillStyle = PAL.good;
        ctx.fillText('MAX', rowX + rowW - 12, ry + rowH / 2 + 4);
      } else {
        ctx.font = "bold 15px 'Courier New', monospace";
        ctx.fillStyle = afford ? PAL.pearl : PAL.danger;
        const ct = `${cost}`;
        ctx.fillText(ct, rowX + rowW - 12, ry + rowH / 2 + 5);
        drawPearlIcon(ctx, rowX + rowW - 20 - ctx.measureText(ct).width, ry + rowH / 2, 6);
      }
    }

    y += UPGRADES.length * (rowH + rowGap) + 6;

    // Toast message
    if (this.messageTimer > 0) {
      ctx.textAlign = 'center';
      ctx.font = "bold 13px 'Courier New', monospace";
      ctx.globalAlpha = Math.min(1, this.messageTimer / 350);
      ctx.fillStyle = this.messageGood ? PAL.good : PAL.danger;
      ctx.fillText(this.message, W / 2, y + 8);
      ctx.globalAlpha = 1;
    }

    // Play button
    const pw = Math.min(240, panelW - 60);
    const px = (W - pw) / 2;
    const py = panelY + panelH - playH - 14;
    this._playRect = { x: px, y: py, w: pw, h: playH };
    const bob = Math.sin(time / 300) * 2;
    ctx.save();
    ctx.shadowBlur = 16;
    ctx.shadowColor = 'rgba(61,242,166,0.35)';
    ctx.fillStyle = 'rgba(16,150,92,0.95)';
    roundRect(ctx, px, py + bob, pw, playH, 14);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(120,255,190,0.5)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, px, py + bob, pw, playH, 14);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = "bold 19px 'Courier New', monospace";
    ctx.textAlign = 'center';
    ctx.fillText('▶  DIVE AGAIN', W / 2, py + bob + 34);
    ctx.restore();

    ctx.restore();
  }
}
