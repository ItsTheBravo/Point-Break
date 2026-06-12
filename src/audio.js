import { Storage } from './storage.js';

// All SFX are synthesized with WebAudio — no asset files needed.
class SoundSystem {
  constructor() {
    this.ctx = null;
    this.muted = Storage.get('muted', false);
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    Storage.set('muted', this.muted);
    return this.muted;
  }

  _tone({ f0 = 440, f1 = f0, dur = 0.1, type = 'sine', vol = 0.2, delay = 0 }) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noise({ dur = 0.15, vol = 0.15, freq = 1200, delay = 0 }) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt).connect(g).connect(this.ctx.destination);
    src.start(t);
  }

  vibrate(pattern) {
    if (this.muted) return;
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  // ── Game events ────────────────────────────────────────────────
  swim() {
    this._tone({ f0: 320, f1: 520, dur: 0.09, type: 'sine', vol: 0.12 });
    this._noise({ dur: 0.06, vol: 0.05, freq: 900 });
  }

  dash() {
    this._tone({ f0: 180, f1: 880, dur: 0.22, type: 'sawtooth', vol: 0.14 });
    this._noise({ dur: 0.25, vol: 0.12, freq: 2400 });
    this.vibrate(18);
  }

  shatter() {
    this._noise({ dur: 0.22, vol: 0.22, freq: 3200 });
    this._tone({ f0: 900, f1: 300, dur: 0.16, type: 'square', vol: 0.08 });
    this.vibrate(28);
  }

  hurt() {
    this._tone({ f0: 220, f1: 80, dur: 0.28, type: 'sawtooth', vol: 0.22 });
    this._noise({ dur: 0.2, vol: 0.15, freq: 700 });
    this.vibrate(70);
  }

  shieldPop() {
    this._tone({ f0: 600, f1: 200, dur: 0.18, type: 'triangle', vol: 0.18 });
    this.vibrate(40);
  }

  pearl(combo) {
    // Pitch climbs with combo for a satisfying streak feel.
    const step = Math.min(combo, 16);
    const f = 660 * Math.pow(1.05946, step);
    this._tone({ f0: f, f1: f * 1.5, dur: 0.11, type: 'sine', vol: 0.16 });
  }

  milestone() {
    this._tone({ f0: 523, dur: 0.12, type: 'triangle', vol: 0.16 });
    this._tone({ f0: 659, dur: 0.12, type: 'triangle', vol: 0.16, delay: 0.1 });
    this._tone({ f0: 784, dur: 0.2, type: 'triangle', vol: 0.16, delay: 0.2 });
    this.vibrate([20, 40, 20]);
  }

  death() {
    this._tone({ f0: 300, f1: 50, dur: 0.7, type: 'sawtooth', vol: 0.2 });
    this._noise({ dur: 0.5, vol: 0.18, freq: 500 });
    this.vibrate([90, 50, 120]);
  }

  buy() {
    this._tone({ f0: 700, f1: 1050, dur: 0.1, type: 'sine', vol: 0.16 });
    this._tone({ f0: 1050, f1: 1400, dur: 0.14, type: 'sine', vol: 0.14, delay: 0.08 });
    this.vibrate(22);
  }

  deny() {
    this._tone({ f0: 200, f1: 150, dur: 0.14, type: 'square', vol: 0.1 });
  }

  tap() {
    this._tone({ f0: 500, f1: 450, dur: 0.05, type: 'sine', vol: 0.07 });
  }
}

export const Sound = new SoundSystem();
