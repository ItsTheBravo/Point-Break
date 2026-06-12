// Mid-run shop node: spend session pearls on relics, heals, shields.
// items: [{ kind:'relic'|'heal'|'shield', name, desc, price, rarity?, relic?, sold }]

import { RARITY } from './relics.js';
import { PAL } from './constants.js';
import { drawPearlIcon } from './hud.js';

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export class RunShop {
  constructor() {
    this.items = [];
    this.onBuy = null;
    this.onLeave = null;
    this._openTime = 0;
    this._rects = [];
    this._leaveRect = null;
    this._msg = '';
    this._msgT = 0;
    this._msgGood = true;
    this._selected = -1;
  }

  show(items, onBuy, onLeave, now) {
    this.items = items;
    this.onBuy = onBuy;
    this.onLeave = onLeave;
    this._openTime = now;
    this._msg = '';
    this._msgT = 0;
    this._selected = -1;
  }

  update(dt) {
    if (this._msgT > 0) this._msgT = Math.max(0, this._msgT - dt);
  }

  handleTap(x, y, now) {
    if (now - this._openTime < 450) return;

    if (this._leaveRect && this._hit(this._leaveRect, x, y)) {
      if (this.onLeave) this.onLeave();
      return;
    }

    for (let i = 0; i < this._rects.length; i++) {
      if (this._hit(this._rects[i], x, y)) {
        const item = this.items[i];
        if (item.sold) return;
        // Two-tap: first tap selects, second tap buys.
        if (this._selected !== i) {
          this._selected = i;
          return;
        }
        const ok = this.onBuy ? this.onBuy(item) : false;
        if (ok) {
          item.sold = true;
          this._selected = -1;
          this._toast('Purchased!', true);
        } else {
          this._toast('Not enough pearls', false);
        }
        return;
      }
    }
    this._selected = -1;
  }

  _hit(r, x, y) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

  _toast(text, good) { this._msg = text; this._msgGood = good; this._msgT = 1600; }

  draw(ctx, W, H, time, pearls) {
    const elapsed = time - this._openTime;
    const fadeIn = Math.min(1, elapsed / 300);

    ctx.save();
    ctx.globalAlpha = fadeIn;
    ctx.fillStyle = 'rgba(1,6,12,0.86)';
    ctx.fillRect(0, 0, W, H);

    // Header
    ctx.textAlign = 'center';
    ctx.font = "bold 26px 'Courier New', monospace";
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 5;
    ctx.strokeText('PEARL TRADER', W / 2, 56);
    ctx.fillStyle = PAL.good;
    ctx.fillText('PEARL TRADER', W / 2, 56);

    // Balance
    ctx.font = "bold 18px 'Courier New', monospace";
    ctx.fillStyle = PAL.pearl;
    const balText = `${pearls}`;
    const balW = ctx.measureText(balText).width;
    drawPearlIcon(ctx, W / 2 - balW / 2 - 16, 80, 9);
    ctx.fillText(balText, W / 2 + 2, 86);

    this._rects = [];
    const itemW = Math.min(400, W - 32);
    const itemX = (W - itemW) / 2;
    const itemH = 72;
    const gap = 12;
    let y = 112;

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const afford = !item.sold && pearls >= item.price;
      const color = item.kind === 'relic' ? RARITY[item.rarity].color :
        item.kind === 'heal' ? '#ff7ab0' : '#78dcff';

      this._rects.push({ x: itemX, y, w: itemW, h: itemH });

      const selected = this._selected === i;
      ctx.save();
      if (item.sold) ctx.globalAlpha *= 0.35;
      if (selected) { ctx.shadowBlur = 18; ctx.shadowColor = color; }
      ctx.fillStyle = selected ? 'rgba(16,42,72,0.98)' : afford ? 'rgba(10,30,55,0.95)' : 'rgba(18,26,40,0.85)';
      ctx.strokeStyle = item.sold ? 'rgba(90,105,130,0.4)' : color;
      ctx.lineWidth = selected ? 2.5 : 1.5;
      roundRect(ctx, itemX, y, itemW, itemH, 12);
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.textAlign = 'left';
      ctx.font = "bold 15px 'Courier New', monospace";
      ctx.fillStyle = item.sold ? 'rgba(140,155,175,0.7)' : color;
      ctx.fillText(item.name, itemX + 16, y + 26);
      if (item.kind === 'relic') {
        ctx.font = "bold 9px 'Courier New', monospace";
        ctx.fillStyle = RARITY[item.rarity].color;
        ctx.fillText(RARITY[item.rarity].label, itemX + 16 + ctx.measureText(item.name).width + 80, y + 26);
      }
      ctx.font = "11px 'Courier New', monospace";
      ctx.fillStyle = 'rgba(180,210,235,0.85)';
      // Truncate desc to fit.
      let desc = item.desc;
      while (ctx.measureText(desc).width > itemW - 100 && desc.length > 8) {
        desc = desc.slice(0, -5) + '…';
      }
      ctx.fillText(desc, itemX + 16, y + 46);

      // Price / confirm hint
      ctx.textAlign = 'right';
      if (item.sold) {
        ctx.font = "bold 13px 'Courier New', monospace";
        ctx.fillStyle = PAL.good;
        ctx.fillText('SOLD', itemX + itemW - 14, y + itemH / 2 + 5);
      } else if (selected) {
        const pulse = 0.65 + Math.sin(time / 180) * 0.35;
        ctx.save();
        ctx.globalAlpha *= pulse;
        ctx.font = "bold 12px 'Courier New', monospace";
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`BUY ${item.price}?`, itemX + itemW - 14, y + itemH / 2 + 5);
        ctx.restore();
      } else {
        ctx.font = "bold 16px 'Courier New', monospace";
        ctx.fillStyle = afford ? PAL.pearl : PAL.danger;
        const pt = `${item.price}`;
        ctx.fillText(pt, itemX + itemW - 14, y + itemH / 2 + 5);
        drawPearlIcon(ctx, itemX + itemW - 22 - ctx.measureText(pt).width, y + itemH / 2, 6);
      }
      ctx.restore();

      y += itemH + gap;
    }

    // Toast
    if (this._msgT > 0) {
      ctx.textAlign = 'center';
      ctx.font = "bold 13px 'Courier New', monospace";
      ctx.globalAlpha = fadeIn * Math.min(1, this._msgT / 300);
      ctx.fillStyle = this._msgGood ? PAL.good : PAL.danger;
      ctx.fillText(this._msg, W / 2, y + 10);
      ctx.globalAlpha = fadeIn;
      y += 18;
    }

    // Leave button
    const lw = Math.min(220, W - 80), lh = 50;
    const lx = (W - lw) / 2, ly = Math.min(H - lh - 24, y + 14);
    this._leaveRect = { x: lx, y: ly, w: lw, h: lh };
    const bob = Math.sin(time / 320) * 2;
    ctx.save();
    ctx.shadowBlur = 14;
    ctx.shadowColor = 'rgba(57,230,255,0.3)';
    ctx.fillStyle = 'rgba(10,60,90,0.95)';
    roundRect(ctx, lx, ly + bob, lw, lh, 12);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(57,230,255,0.5)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, lx, ly + bob, lw, lh, 12);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = "bold 16px 'Courier New', monospace";
    ctx.textAlign = 'center';
    ctx.fillText('LEAVE  ▶', W / 2, ly + bob + 31);
    ctx.restore();

    ctx.restore();
  }
}
