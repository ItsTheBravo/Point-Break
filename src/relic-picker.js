import { RARITY } from './relics.js';
import { PAL } from './constants.js';

// Canvas coords for the 3 cards.
const CARD_W = 170;
const CARD_H = 220;
const CARD_RADIUS = 14;

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

function drawIcon(ctx, iconId, cx, cy, s, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (iconId) {
    case 'heart':
      ctx.beginPath();
      ctx.moveTo(0, s * 0.45);
      ctx.bezierCurveTo(-s, -s * 0.5, -s * 0.5, -s * 1.2, 0, -s * 0.45);
      ctx.bezierCurveTo(s * 0.5, -s * 1.2, s, -s * 0.5, 0, s * 0.45);
      ctx.closePath();
      ctx.fill();
      break;
    case 'star':
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const ao = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const ai = ao + (2 * Math.PI) / 5;
        if (i === 0) ctx.moveTo(Math.cos(ao) * s, Math.sin(ao) * s);
        else ctx.lineTo(Math.cos(ao) * s, Math.sin(ao) * s);
        ctx.lineTo(Math.cos(ai) * s * 0.4, Math.sin(ai) * s * 0.4);
      }
      ctx.closePath();
      ctx.fill();
      break;
    case 'gem':
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.8, -s * 0.2);
      ctx.lineTo(s * 0.5, s * 0.9);
      ctx.lineTo(-s * 0.5, s * 0.9);
      ctx.lineTo(-s * 0.8, -s * 0.2);
      ctx.closePath();
      ctx.fill();
      break;
    case 'bolt':
      ctx.beginPath();
      ctx.moveTo(s * 0.2, -s);
      ctx.lineTo(-s * 0.5, s * 0.1);
      ctx.lineTo(0, s * 0.1);
      ctx.lineTo(-s * 0.2, s);
      ctx.lineTo(s * 0.5, -s * 0.1);
      ctx.lineTo(0, -s * 0.1);
      ctx.closePath();
      ctx.fill();
      break;
    case 'wave':
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        const oy = (i - 1) * s * 0.55;
        const ri = s * (1 - i * 0.2);
        ctx.beginPath();
        ctx.arc(0, oy, ri, -Math.PI * 0.7, Math.PI * 0.7);
        ctx.stroke();
      }
      break;
    case 'drop':
      ctx.beginPath();
      ctx.moveTo(0, s);
      ctx.bezierCurveTo(s * 0.8, s * 0.3, s * 0.8, -s * 0.5, 0, -s);
      ctx.bezierCurveTo(-s * 0.8, -s * 0.5, -s * 0.8, s * 0.3, 0, s);
      ctx.closePath();
      ctx.fill();
      break;
    case 'ghost':
      ctx.beginPath();
      ctx.arc(0, -s * 0.2, s * 0.7, Math.PI, 0);
      ctx.lineTo(s * 0.7, s * 0.8);
      ctx.quadraticCurveTo(s * 0.35, s * 0.4, 0, s * 0.8);
      ctx.quadraticCurveTo(-s * 0.35, s * 0.4, -s * 0.7, s * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(-s * 0.25, -s * 0.3, s * 0.15, 0, Math.PI * 2);
      ctx.arc(s * 0.25, -s * 0.3, s * 0.15, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'lightning':
      for (let i = 0; i < 3; i++) {
        const x0 = (i - 1) * s * 0.6;
        ctx.beginPath();
        ctx.moveTo(x0 + s * 0.15, -s);
        ctx.lineTo(x0 - s * 0.15, 0);
        ctx.lineTo(x0 + s * 0.05, 0);
        ctx.lineTo(x0 - s * 0.15, s);
        ctx.stroke();
      }
      break;
    case 'ring':
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * s * 0.7, Math.sin(a) * s * 0.7, s * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'twin':
      ctx.globalAlpha *= 0.9;
      ctx.beginPath();
      ctx.ellipse(-s * 0.5, 0, s * 0.55, s * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha *= 0.45;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(s * 0.5, 0, s * 0.55, s * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    default:
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.8, 0, Math.PI * 2);
      ctx.fill();
  }
  ctx.restore();
}

export class RelicPicker {
  constructor() {
    this.choices = [];
    this.onPick = null;
    this.openTime = 0;
    this._hoverIdx = -1;
    this._cards = [];
  }

  show(choices, onPick, now) {
    this.choices = choices;
    this.onPick = onPick;
    this.openTime = now;
    this._hoverIdx = -1;
  }

  handleTap(x, y, now) {
    if (now - this.openTime < 500) return; // guard against instant close
    for (let i = 0; i < this._cards.length; i++) {
      const c = this._cards[i];
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
        if (this.onPick) this.onPick(this.choices[i]);
        return;
      }
    }
  }

  handleMove(x, y) {
    this._hoverIdx = -1;
    for (let i = 0; i < this._cards.length; i++) {
      const c = this._cards[i];
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
        this._hoverIdx = i;
      }
    }
  }

  draw(ctx, W, H, now) {
    const elapsed = now - this.openTime;
    const n = this.choices.length;
    const totalW = n * CARD_W + (n - 1) * 18;
    const startX = (W - totalW) / 2;
    const cardY = (H - CARD_H) / 2;

    // Overlay
    ctx.save();
    ctx.fillStyle = 'rgba(1,5,12,0.78)';
    ctx.fillRect(0, 0, W, H);

    // Header
    ctx.textAlign = 'center';
    const headAlpha = Math.min(1, elapsed / 300);
    ctx.globalAlpha = headAlpha;
    ctx.font = "bold 13px 'Courier New', monospace";
    ctx.fillStyle = 'rgba(156,195,224,0.8)';
    ctx.fillText('RELIC DISCOVERED — CHOOSE ONE', W / 2, cardY - 32);
    ctx.font = "11px 'Courier New', monospace";
    ctx.fillStyle = 'rgba(100,140,170,0.7)';
    ctx.fillText('(lost on death)', W / 2, cardY - 14);
    ctx.globalAlpha = 1;

    this._cards = [];
    for (let i = 0; i < n; i++) {
      const relic = this.choices[i];
      const rarity = RARITY[relic.rarity];
      const cx = startX + i * (CARD_W + 18);

      // Slide in from top with staggered delay.
      const delay = i * 100;
      const progress = Math.min(1, Math.max(0, (elapsed - delay) / 420));
      const ease = 1 - Math.pow(1 - progress, 3);
      const slideY = cardY - 60 * (1 - ease);
      const alpha = ease;

      this._cards.push({ x: cx, y: Math.round(slideY), w: CARD_W, h: CARD_H });

      const hover = this._hoverIdx === i;
      const liftY = hover ? -8 : 0;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(0, liftY);

      // Glow
      ctx.save();
      ctx.shadowBlur = hover ? 28 : 14;
      ctx.shadowColor = rarity.glow;
      ctx.fillStyle = hover ? 'rgba(15,30,55,0.98)' : 'rgba(8,20,38,0.95)';
      roundRect(ctx, cx, slideY, CARD_W, CARD_H, CARD_RADIUS);
      ctx.fill();
      ctx.restore();

      // Border
      ctx.strokeStyle = rarity.color;
      ctx.lineWidth = hover ? 2.5 : 1.5;
      ctx.globalAlpha = alpha * (hover ? 1 : 0.65);
      roundRect(ctx, cx, slideY, CARD_W, CARD_H, CARD_RADIUS);
      ctx.stroke();
      ctx.globalAlpha = alpha;

      // Rarity label
      ctx.font = "bold 10px 'Courier New', monospace";
      ctx.textAlign = 'center';
      ctx.fillStyle = rarity.color;
      ctx.fillText(rarity.label, cx + CARD_W / 2, slideY + 18);

      // Icon
      const iconColor = hover ? '#ffffff' : rarity.color;
      ctx.save();
      ctx.shadowBlur = hover ? 16 : 8;
      ctx.shadowColor = rarity.glow;
      drawIcon(ctx, relic.icon, cx + CARD_W / 2, slideY + 70, 22, iconColor);
      ctx.restore();

      // Name
      ctx.font = "bold 15px 'Courier New', monospace";
      ctx.fillStyle = hover ? '#ffffff' : '#e8f4f8';
      ctx.fillText(relic.name, cx + CARD_W / 2, slideY + 130);

      // Description (word-wrapped)
      ctx.font = "11px 'Courier New', monospace";
      ctx.fillStyle = 'rgba(180,210,235,0.85)';
      this._wrapText(ctx, relic.desc, cx + CARD_W / 2, slideY + 152, CARD_W - 20, 15);

      // Tap hint
      if (hover) {
        ctx.font = "bold 10px 'Courier New', monospace";
        ctx.fillStyle = rarity.color;
        ctx.fillText('[ TAP TO PICK ]', cx + CARD_W / 2, slideY + CARD_H - 12);
      }

      ctx.restore();
    }

    ctx.restore();
  }

  _wrapText(ctx, text, cx, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    let curY = y;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, cx, curY);
        line = word;
        curY += lineH;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, cx, curY);
  }
}
