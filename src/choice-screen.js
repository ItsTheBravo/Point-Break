// Generic stacked-card choice overlay, used by Rest and Event nodes.
// options: [{ label, desc, color }]

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export class ChoiceScreen {
  constructor() {
    this.title = '';
    this.subtitle = '';
    this.options = [];
    this.onPick = null;
    this._openTime = 0;
    this._cards = [];
    this._hover = -1;
  }

  show(title, subtitle, options, onPick, now) {
    this.title = title;
    this.subtitle = subtitle;
    this.options = options;
    this.onPick = onPick;
    this._openTime = now;
    this._hover = -1;
  }

  handleMove(x, y) {
    this._hover = -1;
    for (let i = 0; i < this._cards.length; i++) {
      const c = this._cards[i];
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) this._hover = i;
    }
  }

  handleTap(x, y, now) {
    if (now - this._openTime < 450) return;
    for (let i = 0; i < this._cards.length; i++) {
      const c = this._cards[i];
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
        if (this.onPick) this.onPick(i);
        return;
      }
    }
  }

  draw(ctx, W, H, time) {
    const elapsed = time - this._openTime;
    const fadeIn = Math.min(1, elapsed / 300);
    const n = this.options.length;
    const cardW = Math.min(360, W - 36);
    const cardH = 88;
    const gap = 16;
    const totalH = n * cardH + (n - 1) * gap;
    const startY = (H - totalH) / 2 + 20;

    ctx.save();
    ctx.globalAlpha = fadeIn;
    ctx.fillStyle = 'rgba(1,5,12,0.84)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.font = "bold 24px 'Courier New', monospace";
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 5;
    ctx.strokeText(this.title, W / 2, startY - 64);
    ctx.fillStyle = '#e8f4f8';
    ctx.fillText(this.title, W / 2, startY - 64);

    if (this.subtitle) {
      ctx.font = "12px 'Courier New', monospace";
      ctx.fillStyle = 'rgba(156,195,224,0.85)';
      ctx.fillText(this.subtitle, W / 2, startY - 38);
    }

    this._cards = [];
    for (let i = 0; i < n; i++) {
      const opt = this.options[i];
      const delay = i * 110;
      const prog = Math.min(1, Math.max(0, (elapsed - delay) / 380));
      const ease = 1 - Math.pow(1 - prog, 3);
      const cx = (W - cardW) / 2;
      const cy = startY + i * (cardH + gap) + 40 * (1 - ease);
      const hover = this._hover === i;

      this._cards.push({ x: cx, y: cy, w: cardW, h: cardH });

      ctx.save();
      ctx.globalAlpha = fadeIn * ease;
      ctx.shadowBlur = hover ? 24 : 10;
      ctx.shadowColor = opt.color;
      ctx.fillStyle = hover ? 'rgba(15,32,58,0.98)' : 'rgba(8,20,38,0.95)';
      roundRect(ctx, cx, cy, cardW, cardH, 14);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = opt.color;
      ctx.lineWidth = hover ? 2.5 : 1.5;
      ctx.globalAlpha *= hover ? 1 : 0.7;
      roundRect(ctx, cx, cy, cardW, cardH, 14);
      ctx.stroke();
      ctx.globalAlpha = fadeIn * ease;

      ctx.textAlign = 'left';
      ctx.font = "bold 16px 'Courier New', monospace";
      ctx.fillStyle = opt.color;
      ctx.fillText(opt.label, cx + 18, cy + 32);
      ctx.font = "11px 'Courier New', monospace";
      ctx.fillStyle = 'rgba(180,210,235,0.85)';
      this._wrap(ctx, opt.desc, cx + 18, cy + 52, cardW - 36, 15);

      if (hover) {
        ctx.textAlign = 'right';
        ctx.font = "bold 11px 'Courier New', monospace";
        ctx.fillStyle = opt.color;
        ctx.fillText('TAP ▶', cx + cardW - 14, cy + 30);
      }
      ctx.restore();
    }

    ctx.restore();
  }

  _wrap(ctx, text, x, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '', curY = y;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, curY);
        line = word;
        curY += lineH;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, curY);
  }
}
