import { ROOM_ICONS, availableNext } from './floor-data.js';
import { PAL } from './constants.js';

const NODE_R = 30;
const NODE_BOSS_R = 38;

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Compute pixel positions for every node in the floor.
function computeLayout(floorDef, W, H) {
  const layers = floorDef.layers;
  const n = layers.length;
  const topPad = 100, botPad = 140;
  const usableH = H - topPad - botPad;
  const layerSpacing = usableH / (n - 1);

  const positions = layers.map((layer, li) => {
    const y = H - botPad - li * layerSpacing;
    const count = layer.length;
    return layer.map((_, ni) => {
      const fraction = count === 1 ? 0.5 : ni / (count - 1);
      // Spread nodes across 30%–70% of width.
      const x = W * 0.28 + fraction * W * 0.44;
      return { x, y };
    });
  });
  return positions;
}

export class FloorMapScreen {
  constructor() {
    this._tapRects = []; // [{layer,idx,x,y,r}]
    this._hoverLayer = -1;
    this._hoverIdx   = -1;
    this._openTime   = 0;
  }

  open(now) {
    this._openTime = now;
    this._hoverLayer = -1;
    this._hoverIdx   = -1;
  }

  handleMove(x, y, mapState) {
    const avail = availableNext(mapState);
    this._hoverLayer = -1;
    this._hoverIdx   = -1;
    for (const rect of this._tapRects) {
      const isAvail = avail.some(a => a.layer === rect.layer && a.idx === rect.idx);
      if (!isAvail) continue;
      const dx = x - rect.x, dy = y - rect.y;
      if (dx * dx + dy * dy < rect.r * rect.r * 2.2) {
        this._hoverLayer = rect.layer;
        this._hoverIdx   = rect.idx;
      }
    }
  }

  // Returns {layer, idx} if a valid available node was tapped, else null.
  handleTap(x, y, mapState, now) {
    if (now - this._openTime < 400) return null;
    const avail = availableNext(mapState);
    for (const rect of this._tapRects) {
      const isAvail = avail.some(a => a.layer === rect.layer && a.idx === rect.idx);
      if (!isAvail) continue;
      const dx = x - rect.x, dy = y - rect.y;
      if (dx * dx + dy * dy < (rect.r + 12) ** 2) {
        return { layer: rect.layer, idx: rect.idx };
      }
    }
    return null;
  }

  draw(ctx, W, H, mapState, time, cycleN) {
    const { floor } = mapState;
    const elapsed = time - this._openTime;
    const fadeIn = Math.min(1, elapsed / 350);

    // ── Background overlay ──
    ctx.save();
    ctx.globalAlpha = fadeIn;

    ctx.fillStyle = 'rgba(2,8,18,0.88)';
    ctx.fillRect(0, 0, W, H);

    // ── Header ──
    ctx.textAlign = 'center';
    ctx.font = "bold 13px 'Courier New', monospace";
    ctx.fillStyle = 'rgba(140,185,220,0.8)';
    const loopLabel = cycleN > 0 ? ` · LOOP ${cycleN + 1}` : '';
    ctx.fillText(`FLOOR ${floor.floorNum} OF 3${loopLabel}`, W / 2, 36);
    ctx.font = "bold 26px 'Courier New', monospace";
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 5;
    ctx.strokeText(floor.name, W / 2, 66);
    ctx.fillStyle = ROOM_ICONS.boss.color;
    ctx.fillText(floor.name, W / 2, 66);

    const positions = computeLayout(floor, W, H);
    const avail = availableNext(mapState);
    this._tapRects = [];

    // ── Connection lines ──
    for (let li = 0; li < floor.connections.length; li++) {
      for (const [fi, ti] of floor.connections[li]) {
        const from = positions[li][fi];
        const to   = positions[li + 1][ti];
        const visited = mapState.visited.has(`${li},${fi}`) && mapState.visited.has(`${li+1},${ti}`);
        const current = mapState.currentLayer === li && mapState.currentIdx === fi;
        const isReachable = avail.some(a => a.layer === li + 1 && a.idx === ti) &&
                            mapState.currentLayer === li && mapState.currentIdx === fi;

        ctx.save();
        if (visited) {
          ctx.strokeStyle = 'rgba(57,230,255,0.55)';
          ctx.lineWidth = 2.5;
        } else if (isReachable) {
          ctx.strokeStyle = `rgba(57,230,255,${0.35 + Math.sin(time / 300) * 0.15})`;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
        } else {
          ctx.strokeStyle = 'rgba(60,80,110,0.4)';
          ctx.lineWidth = 1.5;
        }
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    // ── Nodes ──
    for (let li = 0; li < floor.layers.length; li++) {
      for (let ni = 0; ni < floor.layers[li].length; ni++) {
        const room = floor.layers[li][ni];
        const pos  = positions[li][ni];
        const icon = ROOM_ICONS[room.type];
        const isBoss = room.type === 'boss';
        const r = isBoss ? NODE_BOSS_R : NODE_R;
        const isCurrent  = mapState.currentLayer === li && mapState.currentIdx === ni;
        const isVisited  = mapState.visited.has(`${li},${ni}`);
        const isAvail    = avail.some(a => a.layer === li && a.idx === ni);
        const isHover    = this._hoverLayer === li && this._hoverIdx === ni;

        this._tapRects.push({ layer: li, idx: ni, x: pos.x, y: pos.y, r });

        // Staggered slide-in.
        const delay = (li * 80 + ni * 40);
        const nodeAlpha = Math.min(1, Math.max(0, (elapsed - delay) / 280));
        ctx.save();
        ctx.globalAlpha *= nodeAlpha;

        // Glow for current/available.
        if (isCurrent || isAvail) {
          ctx.save();
          const glowPulse = 0.6 + Math.sin(time / 220) * 0.35;
          ctx.shadowBlur = isHover ? 36 : isBoss ? 30 : 18;
          ctx.shadowColor = isBoss ? '#ff3b60' : isAvail ? icon.color : PAL.cyan;
          ctx.globalAlpha *= glowPulse;
          ctx.fillStyle = 'transparent';
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r + 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Node fill.
        const fillAlpha = isVisited && !isCurrent ? 0.35 : 1;
        ctx.fillStyle = isCurrent ? PAL.cyan :
          isAvail ? 'rgba(14,40,70,0.95)' :
          isVisited ? 'rgba(8,22,40,0.7)' : 'rgba(8,22,40,0.85)';
        ctx.strokeStyle = isAvail ? icon.color : isVisited ? 'rgba(57,230,255,0.5)' : 'rgba(50,75,110,0.5)';
        ctx.lineWidth = isCurrent || isHover ? 3 : 1.8;
        ctx.globalAlpha *= fillAlpha;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.globalAlpha /= fillAlpha;

        // Hover scale.
        if (isHover) ctx.translate(pos.x, pos.y), ctx.scale(1.08, 1.08), ctx.translate(-pos.x, -pos.y);

        // Room icon text.
        ctx.textAlign = 'center';
        const iconColor = isCurrent ? '#1a3040' : isAvail ? icon.color : isVisited ? 'rgba(57,230,255,0.45)' : 'rgba(80,110,150,0.7)';
        ctx.font = `bold ${isBoss ? 22 : 18}px 'Courier New', monospace`;
        ctx.fillStyle = iconColor;
        ctx.fillText(icon.emoji, pos.x, pos.y + 1);
        ctx.font = `bold 9px 'Courier New', monospace`;
        ctx.fillStyle = isAvail ? `rgba(180,210,240,0.9)` : `rgba(80,110,150,0.6)`;
        ctx.fillText(icon.label, pos.x, pos.y + r + 13);

        // Narwhal cursor at current room.
        if (isCurrent) {
          const bob = Math.sin(time / 380) * 4;
          ctx.font = `14px 'Courier New', monospace`;
          ctx.fillStyle = PAL.cyan;
          ctx.fillText('▼', pos.x, pos.y - r - 8 + bob);
        }

        // Checkmark for visited non-current.
        if (isVisited && !isCurrent) {
          ctx.font = `10px 'Courier New', monospace`;
          ctx.fillStyle = 'rgba(57,230,255,0.6)';
          ctx.fillText('✓', pos.x + r * 0.6, pos.y - r * 0.6);
        }

        ctx.restore();
      }
    }

    // ── Instruction ──
    const pulse = 0.6 + Math.sin(time / 350) * 0.3;
    ctx.globalAlpha = fadeIn * pulse;
    ctx.font = "bold 13px 'Courier New', monospace";
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9cc3e0';
    ctx.fillText('TAP A ROOM TO DIVE', W / 2, H - 40);

    ctx.restore();
  }
}
