import { PAL } from './constants.js';
import { drawIcon } from './relic-picker.js';
import { classLock } from './unlocks.js';

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export const CLASSES = [
  {
    id: 'drifter',
    name: 'DRIFTER',
    tagline: 'Balanced · No disadvantages',
    desc: 'A clean slate. No tricks, no weaknesses. Starts with extra pearls to spend at the first shop.',
    color: PAL.cyan,
    icon: 'wave',
    startingRelicIds: [],
    statMods: {},
    startPearls: 25,
    startShield: 0,
    statLines: ['+25 starting pearls', 'Balanced stats'],
  },
  {
    id: 'berserker',
    name: 'BERSERKER',
    tagline: 'Aggressive · Smash everything',
    desc: 'Built for impact. Two starting relics that reward dashing through danger.',
    color: '#ff9540',
    icon: 'bolt',
    startingRelicIds: ['berserker_shell', 'thirsty_tusk'],
    statMods: { dashCooldown: 0.75 },
    startPearls: 0,
    startShield: 0,
    statLines: ['Dash cooldown −25%', 'Starts: Berserker Shell + Thirsty Tusk'],
  },
  {
    id: 'warden',
    name: 'WARDEN',
    tagline: 'Tank · Soak up the damage',
    desc: 'Built like a reef wall. Extra health and a shield mean mistakes are survivable.',
    color: '#ff7ab0',
    icon: 'heart',
    startingRelicIds: ['golden_hull'],
    statMods: { maxHealth: 2 },
    startPearls: 0,
    startShield: 1,
    statLines: ['+2 max HP, +1 starting shield', 'Starts: Golden Hull'],
  },
  {
    id: 'pearl_diver',
    name: 'PEARL DIVER',
    tagline: 'Economy · Pearls run the show',
    desc: 'Treasure rooms feel twice as rich. Built-in magnet and pearl bonuses compound fast.',
    color: '#ffd866',
    icon: 'drop',
    startingRelicIds: ['pearl_cascade'],
    statMods: { magnetRadius: 120, pearlValue: 1.35 },
    startPearls: 30,
    startShield: 0,
    statLines: ['Magnet +120, Pearl value +35%', 'Starts: Pearl Cascade + 30 pearls'],
  },
  {
    id: 'phantom',
    name: 'PHANTOM',
    tagline: 'Ghost · Phase through walls',
    desc: 'Fragile but untouchable mid-dash. Two evasion relics and a blistering cooldown.',
    color: '#c084fc',
    icon: 'ghost',
    startingRelicIds: ['void_passage', 'phantom_twin'],
    statMods: { maxHealth: -1, dashCooldown: 0.65 },
    startPearls: 10,
    startShield: 0,
    statLines: ['−1 max HP, dash cooldown −35%', 'Starts: Void Passage + Phantom Twin'],
  },
];

export class ClassSelect {
  constructor() {
    this._cards = [];
    this._selected = -1;
    this._hover = -1;
    this._openTime = 0;
    this.onPick = null;
  }

  open(onPick, now) {
    this.onPick = onPick;
    this._openTime = now;
    this._selected = -1;
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
    if (now - this._openTime < 400) return;
    for (let i = 0; i < this._cards.length; i++) {
      const c = this._cards[i];
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
        if (classLock(CLASSES[i].id)) { this._selected = -1; return; }
        if (this._selected === i) {
          if (this.onPick) this.onPick(CLASSES[i]);
        } else {
          this._selected = i;
        }
        return;
      }
    }
    this._selected = -1;
  }

  // Keyboard shortcut: pick class by 1-5 index (first press selects, second confirms).
  handleKey(idx) {
    if (idx < 0 || idx >= CLASSES.length) return;
    if (classLock(CLASSES[idx].id)) return;
    if (this._selected === idx) {
      if (this.onPick) this.onPick(CLASSES[idx]);
    } else {
      this._selected = idx;
    }
  }

  draw(ctx, W, H, time) {
    const elapsed = time - this._openTime;
    const fadeIn = Math.min(1, elapsed / 380);

    ctx.save();
    ctx.globalAlpha = fadeIn;
    ctx.fillStyle = 'rgba(2,8,18,0.92)';
    ctx.fillRect(0, 0, W, H);

    // Header
    ctx.textAlign = 'center';
    ctx.font = "bold 12px 'Courier New', monospace";
    ctx.fillStyle = 'rgba(140,185,220,0.75)';
    ctx.fillText('NEW RUN', W / 2, 30);
    ctx.font = "bold 26px 'Courier New', monospace";
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 5;
    ctx.strokeText('CHOOSE YOUR CLASS', W / 2, 60);
    ctx.fillStyle = '#e8f4f8';
    ctx.fillText('CHOOSE YOUR CLASS', W / 2, 60);
    ctx.font = "11px 'Courier New', monospace";
    ctx.fillStyle = 'rgba(156,195,224,0.65)';
    ctx.fillText('Each class shapes your whole run', W / 2, 80);

    const n = CLASSES.length;
    const gap = 10;
    const cardW = Math.min(400, W - 32);
    const availH = H - 130 - 44; // header + footer
    const cardH = Math.min(82, Math.max(62, Math.floor((availH - gap * (n - 1)) / n)));
    const totalH = n * cardH + (n - 1) * gap;
    const startY = 96 + Math.max(0, (availH - totalH) / 2);

    this._cards = [];

    for (let i = 0; i < n; i++) {
      const cls = CLASSES[i];
      const lock = classLock(cls.id);
      const delay = i * 60;
      const prog = Math.min(1, Math.max(0, (elapsed - delay) / 280));
      const ease = 1 - Math.pow(1 - prog, 3);
      const cx = (W - cardW) / 2;
      const cy = startY + i * (cardH + gap) + 28 * (1 - ease);

      this._cards.push({ x: cx, y: cy, w: cardW, h: cardH });

      const selected = !lock && this._selected === i;
      const hover = !lock && (this._hover === i || selected);
      const cardAlpha = fadeIn * ease * (lock ? 0.55 : 1);

      ctx.save();
      ctx.globalAlpha = cardAlpha;

      // Card background + glow
      if (hover) { ctx.shadowBlur = 26; ctx.shadowColor = cls.color; }
      ctx.fillStyle = selected ? 'rgba(16,42,74,0.99)' :
        hover ? 'rgba(12,32,58,0.97)' : 'rgba(8,20,38,0.94)';
      roundRect(ctx, cx, cy, cardW, cardH, 14);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = cls.color;
      ctx.lineWidth = hover ? 2.5 : 1.5;
      ctx.globalAlpha = cardAlpha * (hover ? 1 : 0.5);
      roundRect(ctx, cx, cy, cardW, cardH, 14);
      ctx.stroke();
      ctx.globalAlpha = cardAlpha;

      // Class icon
      const iconX = cx + 42;
      const iconY = cy + cardH / 2;
      ctx.save();
      ctx.shadowBlur = hover ? 22 : 10;
      ctx.shadowColor = cls.color;
      drawIcon(ctx, cls.icon, iconX, iconY, hover ? 17 : 14,
        lock ? 'rgba(110,130,155,0.8)' : hover ? '#ffffff' : cls.color);
      ctx.restore();

      // Name
      ctx.textAlign = 'left';
      ctx.font = "bold 15px 'Courier New', monospace";
      ctx.fillStyle = lock ? 'rgba(130,150,175,0.85)' : hover ? '#ffffff' : cls.color;
      ctx.fillText(cls.name, cx + 74, cy + cardH * 0.35);

      // Locked: show the unlock requirement instead of stats.
      if (lock) {
        ctx.font = "10px 'Courier New', monospace";
        ctx.fillStyle = 'rgba(150,170,195,0.8)';
        ctx.fillText('LOCKED — ' + lock.hint, cx + 74, cy + cardH * 0.35 + 15);
        ctx.textAlign = 'right';
        ctx.font = "bold 13px 'Courier New', monospace";
        ctx.fillStyle = 'rgba(150,170,195,0.7)';
        ctx.fillText('🔒', cx + cardW - 14, cy + cardH / 2 + 5);
        ctx.restore();
        continue;
      }

      // Show desc when selected, tagline otherwise
      if (selected) {
        ctx.font = "10px 'Courier New', monospace";
        ctx.fillStyle = 'rgba(220,240,255,0.92)';
        const words = cls.desc.split(' ');
        let line = '', drawY = cy + cardH * 0.35 + 15;
        for (const w of words) {
          const test = line ? line + ' ' + w : w;
          if (ctx.measureText(test).width > cardW - 86 && line) {
            ctx.fillText(line, cx + 74, drawY); line = w; drawY += 13;
          } else line = test;
          if (drawY > cy + cardH - 8) { ctx.fillText(line + '…', cx + 74, drawY); line = ''; break; }
        }
        if (line) ctx.fillText(line, cx + 74, drawY);
      } else {
        ctx.font = "10px 'Courier New', monospace";
        ctx.fillStyle = 'rgba(180,210,235,0.75)';
        ctx.fillText(cls.tagline, cx + 74, cy + cardH * 0.35 + 15);
        ctx.font = "9px 'Courier New', monospace";
        ctx.fillStyle = hover ? 'rgba(220,240,255,0.88)' : 'rgba(130,175,215,0.6)';
        ctx.fillText(cls.statLines[0], cx + 74, cy + cardH * 0.35 + 29);
      }

      // Relic badge (top right), hidden when selected showing confirm hint
      if (selected) {
        const pulse = 0.65 + Math.sin(time / 180) * 0.35;
        ctx.save();
        ctx.globalAlpha *= pulse;
        ctx.textAlign = 'right';
        ctx.font = "bold 11px 'Courier New', monospace";
        ctx.fillStyle = '#ffffff';
        ctx.fillText('TAP AGAIN TO DIVE ▶', cx + cardW - 14, cy + cardH / 2 + 5);
        ctx.restore();
      } else {
        ctx.textAlign = 'right';
        if (cls.startingRelicIds.length > 0) {
          ctx.font = "bold 9px 'Courier New', monospace";
          ctx.fillStyle = 'rgba(255,216,102,0.65)';
          const badge = `★ ${cls.startingRelicIds.length} RELIC${cls.startingRelicIds.length > 1 ? 'S' : ''}`;
          ctx.fillText(badge, cx + cardW - 12, cy + 20);
        }
        if (hover) {
          ctx.font = "10px 'Courier New', monospace";
          ctx.fillStyle = cls.color;
          ctx.fillText('TAP ▶', cx + cardW - 12, cy + cardH / 2 + 5);
        }
      }

      ctx.restore();
    }

    // Footer instruction
    const pulse = 0.5 + Math.sin(time / 420) * 0.3;
    ctx.globalAlpha = fadeIn * pulse;
    ctx.textAlign = 'center';
    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.fillStyle = '#9cc3e0';
    ctx.fillText('TAP TO INSPECT  ·  TAP AGAIN TO START', W / 2, H - 20);

    ctx.restore();
  }
}
