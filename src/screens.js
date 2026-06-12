import { PAL } from './constants.js';
import { drawNarwhal } from './player.js';
import { drawPearlIcon } from './hud.js';
import { getTotalPearls, getBestM } from './storage.js';

export class StartScreen {
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
    ctx.fillText('ROGUELIKE', W / 2, H * 0.24 + bob * 0.4);

    ctx.font = `bold ${titleSize}px 'Courier New', monospace`;
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText('FLAPPY NARWHAL', W / 2, H * 0.24 + titleSize + 4 + bob * 0.4);
    ctx.fillStyle = PAL.cyan;
    ctx.fillText('FLAPPY NARWHAL', W / 2, H * 0.24 + titleSize + 4 + bob * 0.4);

    // Hero narwhal
    ctx.save();
    ctx.translate(W / 2, H * 0.45 + bob);
    ctx.scale(1.7, 1.7);
    ctx.rotate(Math.sin(time / 800) * 0.06);
    drawNarwhal(ctx, { time, tailPhase: time / 140 });
    ctx.restore();

    // Tap to start (pulsing)
    const pulse = 0.6 + Math.sin(time / 280) * 0.35;
    ctx.font = "bold 17px 'Courier New', monospace";
    ctx.fillStyle = `rgba(232,244,248,${pulse})`;
    ctx.fillText('TAP TO DIVE', W / 2, H * 0.62);

    // Controls reminder
    ctx.font = "12px 'Courier New', monospace";
    ctx.fillStyle = 'rgba(156,195,224,0.75)';
    ctx.fillText('LEFT tap = tusk dash   ·   RIGHT tap = swim up', W / 2, H * 0.68);

    // Saved progress
    const best = getBestM();
    const pearls = getTotalPearls();
    if (best > 0 || pearls > 0) {
      ctx.font = "13px 'Courier New', monospace";
      const text = `best ${best}m   ·    ${pearls}`;
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(207,232,255,0.85)';
      ctx.fillText(text, W / 2, H * 0.76);
      // Pearl icon sits just before the count.
      const countW = ctx.measureText(`${pearls}`).width;
      drawPearlIcon(ctx, W / 2 + tw / 2 - countW - 11, H * 0.76 - 4, 6);
    }

    ctx.restore();
  }
}
