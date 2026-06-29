/* Animated gradient hero — paper.js-free vanilla canvas implementation.
   Subdivides on click (intotime.com mechanic). Mazunte sunset palette. */

(() => {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Mazunte sunset palette — muted enough to keep white text legible.
  const PALETTE_HEX = [
    '#F2E4CB', // cream
    '#E8C9A0', // sand
    '#D4924E', // amber
    '#B85B3F', // terracotta
    '#D88B86', // dusty pink
    '#7D4A3A', // clay
    '#3A6B85'  // dusty ocean
  ];

  const FADE_FRAMES = 240;     // ~4s at 60fps per color transition
  const MIN_AREA    = 0.004;   // fraction of canvas area below which we rejoin instead of split
  const SPLIT_LIMIT = 9;       // max tree depth — guards against pathological clicks

  // ── color helpers ────────────────────────────────────────────────

  const hexToRgb = h => {
    const n = parseInt(h.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };
  const rgbToCss = c =>
    `rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)})`;
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpColor = (a, b, t) => ({
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t)
  });
  const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  const PALETTE = PALETTE_HEX.map(hexToRgb);

  const pickRandom = (exclude = []) => {
    const pool = PALETTE.filter(c => !exclude.includes(c));
    return pool[Math.floor(Math.random() * pool.length)];
  };

  // ── rectangle / tree ─────────────────────────────────────────────

  class Rect {
    constructor(x, y, w, h, horizontal, depth, parent) {
      this.x = x; this.y = y; this.w = w; this.h = h;
      this.horizontal = horizontal;
      this.depth = depth;
      this.parent = parent || null;
      this.left = null;
      this.right = null;
      this.c0 = pickRandom();
      this.c1 = pickRandom([this.c0]);
      this.noteIndex = PALETTE.indexOf(this.c0);   // pitch for the chime spawned on click
      this.animateIndex = Math.random() < 0.5 ? 0 : 1;
      this._startFade();
    }

    _startFade() {
      this.animateIndex = 1 - this.animateIndex;
      this.source = this.animateIndex === 0 ? this.c0 : this.c1;
      this.goal   = pickRandom([this.c0, this.c1]);
      this.step   = 0;
    }

    isLeaf() { return !this.left; }

    update() {
      if (!this.isLeaf()) {
        this.left.update();
        this.right.update();
        return;
      }
      this.step++;
      const t = easeInOut(Math.min(this.step / FADE_FRAMES, 1));
      const c = lerpColor(this.source, this.goal, t);
      if (this.animateIndex === 0) this.c0 = c; else this.c1 = c;
      if (this.step >= FADE_FRAMES) this._startFade();
    }

    draw(ctx) {
      if (!this.isLeaf()) {
        this.left.draw(ctx);
        this.right.draw(ctx);
        return;
      }
      const ex = this.horizontal ? this.x + this.w : this.x;
      const ey = this.horizontal ? this.y : this.y + this.h;
      const g = ctx.createLinearGradient(this.x, this.y, ex, ey);
      g.addColorStop(0, rgbToCss(this.c0));
      g.addColorStop(1, rgbToCss(this.c1));
      ctx.fillStyle = g;
      ctx.fillRect(this.x, this.y, this.w, this.h);
    }

    hit(px, py) {
      if (!this.isLeaf()) {
        return this.left.hit(px, py) || this.right.hit(px, py);
      }
      return (px >= this.x && px <= this.x + this.w &&
              py >= this.y && py <= this.y + this.h) ? this : null;
    }

    split() {
      if (this.depth >= SPLIT_LIMIT) return false;
      const horizontal = this.w >= this.h;   // split along the longer axis for nicer shapes
      const nextDepth = this.depth + 1;
      if (horizontal) {
        const halfW = this.w / 2;
        this.left  = new Rect(this.x,         this.y, halfW, this.h, false, nextDepth, this);
        this.right = new Rect(this.x + halfW, this.y, halfW, this.h, false, nextDepth, this);
      } else {
        const halfH = this.h / 2;
        this.left  = new Rect(this.x, this.y,         this.w, halfH, true, nextDepth, this);
        this.right = new Rect(this.x, this.y + halfH, this.w, halfH, true, nextDepth, this);
      }
      return true;
    }

    rejoin() {
      this.left = null;
      this.right = null;
      this.c0 = pickRandom();
      this.c1 = pickRandom([this.c0]);
      this.noteIndex = PALETTE.indexOf(this.c0);
      this.animateIndex = Math.random() < 0.5 ? 0 : 1;
      this._startFade();
    }
  }

  // Walk every leaf under a node and run fn against it.
  const forEachLeaf = (node, fn) => {
    if (node.isLeaf()) fn(node);
    else { forEachLeaf(node.left, fn); forEachLeaf(node.right, fn); }
  };

  // ── canvas sizing & tree state ───────────────────────────────────

  let width = 0, height = 0;
  let root = null;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    width  = rect.width;
    height = rect.height;
    canvas.width  = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const rebuild = () => {
    resize();
    root = new Rect(0, 0, width, height, true, 0, null);

    // Recursively split every leaf until it reaches the target depth.
    // Depth 3 on a wide viewport ≈ 8 cells in a roughly 4×2 grid.
    const seedToDepth = (node, target) => {
      if (node.depth >= target) return;
      node.split();
      seedToDepth(node.left, target);
      seedToDepth(node.right, target);
    };
    seedToDepth(root, 3);

    // Asymmetric flourish: subdivide a random subset of leaves once more
    // so the grid feels designed instead of uniform.
    const leaves = [];
    forEachLeaf(root, l => leaves.push(l));
    // Fisher–Yates shuffle, then split ~60% of them.
    for (let i = leaves.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [leaves[i], leaves[j]] = [leaves[j], leaves[i]];
    }
    const extras = Math.floor(leaves.length * 0.6);
    for (let i = 0; i < extras; i++) leaves[i].split();
  };

  // ── audio (light chimes, click-spawned) ──────────────────────────
  //
  // No persistent drones. Each click spawns one (rejoin) or two (split)
  // chime voices that fade in slowly — matching the color animation —
  // and then fade out into the shared delay halo. Multiple clicks layer
  // into a soft chord; the texture goes to silence when you stop.
  //
  // Pitch comes from the rect's initial palette color (PALETTE_NOTES).

  // D minor pentatonic + extensions, spread across three octaves and
  // aligned to PALETTE order (cream → high airy, ocean/clay → low warm).
  const PALETTE_NOTES = [
    587.33,  // D5  — cream
    392.00,  // G4  — sand
    293.66,  // D4  — amber
    220.00,  // A3  — terracotta
    349.23,  // F4  — dusty pink
    146.83,  // D3  — clay
    174.61   // F3  — ocean
  ];

  let audioCtx = null;
  let masterGain = null;
  let delayBus = null;
  let waveGain = null;     // master ocean volume (ramps up on startAudio)
  let waveBodyGain = null; // low-passed swell
  let waveFoamGain = null; // high-passed crash hiss
  let audioOn = false;

  // ── Optional audio samples ───────────────────────────────────────
  // The script tries to load real recordings from /sounds/ on page
  // load. If they're present, the surf sample replaces the synthetic
  // wave layer and bird playback prefers samples over synthesis. If
  // a file is missing, that layer silently falls back to synthesis —
  // the site always works whether or not the samples exist.
  //   /sounds/surf.mp3                 — seamless surf loop (~15–30 s)
  //   /sounds/birds/bird-01.mp3 … 12.mp3 — short tropical bird clips
  let surfBuffer = null;       // AudioBuffer, set when sound decodes
  const birdBuffers = [];      // array of decoded bird AudioBuffers
  let surfSampleGain = null;   // gain node for the live sample player

  // Fetch ArrayBuffers eagerly (before user gesture). They wait in
  // memory until initAudio() runs and we have an AudioContext to
  // decode against.
  const fetchOrNull = (url) =>
    fetch(url).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null);

  const surfArrayPromise = fetchOrNull('sounds/surf.mp3');
  const birdArrayPromises = [];
  for (let i = 1; i <= 12; i++) {
    const name = `sounds/birds/bird-${String(i).padStart(2, '0')}.mp3`;
    birdArrayPromises.push(fetchOrNull(name));
  }

  const initAudio = () => {
    if (audioCtx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 1.0;   // chimes self-envelope, no master fade needed

    // Shared ambient delay halo — gives every chime a soft afterglow.
    delayBus = audioCtx.createGain();
    delayBus.gain.value = 0.30;

    const delay = audioCtx.createDelay(3);
    delay.delayTime.value = 0.55;

    const delayFb = audioCtx.createGain();
    delayFb.gain.value = 0.42;

    const delayLp = audioCtx.createBiquadFilter();
    delayLp.type = 'lowpass';
    delayLp.frequency.value = 1800;

    delayBus.connect(delay);
    delay.connect(delayLp);
    delayLp.connect(masterGain);
    delayLp.connect(delayFb);
    delayFb.connect(delay);

    const limiter = audioCtx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 8;
    limiter.ratio.value = 10;
    limiter.attack.value = 0.005;
    limiter.release.value = 0.3;

    masterGain.connect(limiter);
    limiter.connect(audioCtx.destination);

    // ── Ocean wave layer ───────────────────────────────────────────
    // One looped noise source split through two filters:
    //   • lowpass  → body  (the rumble/swell of the wave)
    //   • highpass → foam  (the hiss as it crashes & recedes)
    // Each filter's gain is envelope-scheduled in 5–9 second wave cycles
    // by scheduleWave(), so the surf swells → crests → recedes → brief
    // lull instead of running as a constant wash.

    const noiseLen = audioCtx.sampleRate * 2;
    const noiseBuf = audioCtx.createBuffer(1, noiseLen, audioCtx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) noiseData[i] = (Math.random() * 2 - 1) * 0.5;

    const waveSrc = audioCtx.createBufferSource();
    waveSrc.buffer = noiseBuf;
    waveSrc.loop = true;

    // Lower body cutoff + a touch of resonance → deeper Pacific rumble.
    const waveLp = audioCtx.createBiquadFilter();
    waveLp.type = 'lowpass';
    waveLp.frequency.value = 520;
    waveLp.Q.value = 0.7;

    // Foam slightly lower for a "wet" hiss instead of a thin sizzle.
    const waveHp = audioCtx.createBiquadFilter();
    waveHp.type = 'highpass';
    waveHp.frequency.value = 2600;
    waveHp.Q.value = 0.4;

    waveBodyGain = audioCtx.createGain();
    waveBodyGain.gain.value = 0;
    waveFoamGain = audioCtx.createGain();
    waveFoamGain.gain.value = 0;

    waveGain = audioCtx.createGain();
    waveGain.gain.value = 0;            // fades in on startAudio

    waveSrc.connect(waveLp).connect(waveBodyGain).connect(waveGain);
    waveSrc.connect(waveHp).connect(waveFoamGain).connect(waveGain);
    waveGain.connect(masterGain);

    waveSrc.start();

    // ── Decode any fetched sample ArrayBuffers ──────────────────
    // Surf: when it decodes, swap the synthetic wave layer for the
    // sampled loop (cross-faded over 3 s).
    surfArrayPromise.then(arrBuf => {
      if (!arrBuf) return;
      audioCtx.decodeAudioData(arrBuf.slice(0)).then(buf => {
        surfBuffer = buf;
        if (audioOn) swapToSurfSample();
      }).catch(() => {});
    });
    // Birds: each decoded buffer joins the pool. spawnBird() then
    // prefers samples over the synth call types.
    birdArrayPromises.forEach(p => {
      p.then(arrBuf => {
        if (!arrBuf) return;
        audioCtx.decodeAudioData(arrBuf.slice(0)).then(buf => {
          birdBuffers.push(buf);
        }).catch(() => {});
      });
    });
  };

  // Cross-fade from synthetic waves to the surf sample. Uses an
  // overlapping-voice loop so the boundary is hidden inside another
  // voice's hold phase — no audible "click" or repeat at the loop point.
  // Each voice plays the full buffer once with fade-in / hold / fade-out;
  // the next voice is scheduled to begin exactly when this one starts
  // fading out, so their envelopes sum to a constant across the seam.
  const swapToSurfSample = () => {
    if (!audioCtx || !surfBuffer || surfSampleGain) return;
    const now = audioCtx.currentTime;
    const D    = surfBuffer.duration;
    const fade = Math.min(D * 0.25, 4.0);   // crossfade region (≤ 25% of clip)

    surfSampleGain = audioCtx.createGain();
    surfSampleGain.gain.value = 0;
    surfSampleGain.connect(masterGain);

    const playOnce = (startTime) => {
      if (!audioCtx || !surfSampleGain) return;
      const src = audioCtx.createBufferSource();
      src.buffer = surfBuffer;

      const g = audioCtx.createGain();
      g.gain.setValueAtTime(0.0001, startTime);
      g.gain.linearRampToValueAtTime(1, startTime + fade);
      g.gain.setValueAtTime(1, startTime + D - fade);
      g.gain.linearRampToValueAtTime(0.0001, startTime + D);

      src.connect(g).connect(surfSampleGain);
      src.start(startTime);
      src.stop(startTime + D + 0.05);

      // Self-cleanup once this voice is finished.
      const disposeMs = ((startTime + D + 0.3) - audioCtx.currentTime) * 1000;
      setTimeout(() => {
        try { src.disconnect(); g.disconnect(); } catch (_) {}
      }, Math.max(0, disposeMs));

      // Schedule the next voice to begin at the start of this voice's
      // fade-out. Their gain envelopes sum to ≈ 1 across the overlap.
      const nextStart = startTime + D - fade;
      const queueMs = ((nextStart - audioCtx.currentTime) * 1000) - 150;
      setTimeout(() => {
        if (surfSampleGain) playOnce(nextStart);
      }, Math.max(0, queueMs));
    };

    playOnce(now);

    // Master surf gain fades in; synthetic wave layer fades out.
    surfSampleGain.gain.linearRampToValueAtTime(0.32, now + 3.0);
    waveGain.gain.cancelScheduledValues(now);
    waveGain.gain.setValueAtTime(waveGain.gain.value, now);
    waveGain.gain.linearRampToValueAtTime(0, now + 3.0);
  };

  // Play one randomly-chosen bird sample with slight pitch + pan + gain
  // variation so repeated plays don't feel identical. Caps duration at
  // ~4.5 s so long recordings (multi-bout songs) don't dominate.
  const spawnBirdSample = () => {
    if (!audioCtx || !audioOn || birdBuffers.length === 0) return;
    const buf = birdBuffers[Math.floor(Math.random() * birdBuffers.length)];
    const now = audioCtx.currentTime;

    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.92 + Math.random() * 0.18;     // ±~8 % pitch

    const MAX_DUR = 4.5;
    const playDur = Math.min(buf.duration / src.playbackRate.value, MAX_DUR);
    const peakGain = 0.22 + Math.random() * 0.22;             // distance variation

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(peakGain, now);
    // If we're cutting a long recording short, fade out the last 0.6 s
    // instead of clicking off.
    if (playDur >= MAX_DUR - 0.05) {
      gain.gain.setValueAtTime(peakGain, now + playDur - 0.6);
      gain.gain.linearRampToValueAtTime(0.0001, now + playDur);
    }

    src.connect(gain);
    let tail = gain;
    if (audioCtx.createStereoPanner) {
      const pan = audioCtx.createStereoPanner();
      pan.pan.value = (Math.random() - 0.5) * 0.85;
      gain.connect(pan);
      tail = pan;
    }
    tail.connect(masterGain);
    tail.connect(delayBus);                                    // canopy echo

    src.start(now);
    src.stop(now + playDur + 0.05);

    setTimeout(() => {
      try {
        src.disconnect();
        gain.disconnect();
        if (tail !== gain) tail.disconnect();
      } catch (_) {}
    }, (playDur + 0.3) * 1000);
  };

  // Schedule one wave cycle. Pacific swells = longer cycles, deeper body,
  // and occasionally a "set wave" that's noticeably bigger than the others.
  const scheduleWave = () => {
    if (!audioOn) return;
    const now = audioCtx.currentTime;

    // ~22 % chance of a big set wave — longer rise, bigger crest, longer foam.
    const big = Math.random() < 0.22;

    const RISE = big ? (5.0 + Math.random() * 2.5)   // 5.0–7.5 s build
                     : (3.2 + Math.random() * 2.2);  // 3.2–5.4 s build
    const HOLD = big ? (0.6 + Math.random() * 0.6)
                     : (0.4 + Math.random() * 0.5);
    const FALL = big ? (5.5 + Math.random() * 2.5)   // 5.5–8.0 s recede
                     : (3.8 + Math.random() * 2.2);  // 3.8–6.0 s recede
    const LULL = 1.0 + Math.random() * 2.8;          // 1.0–3.8 s between waves

    const bodyPeak = big ? (0.85 + Math.random() * 0.15) : (0.5 + Math.random() * 0.25);
    const foamPeak = big ? (0.9  + Math.random() * 0.15) : (0.45 + Math.random() * 0.35);

    // Body — slow swell, brief plateau, slow fall.
    waveBodyGain.gain.cancelScheduledValues(now);
    waveBodyGain.gain.setValueAtTime(waveBodyGain.gain.value, now);
    waveBodyGain.gain.linearRampToValueAtTime(bodyPeak,        now + RISE);
    waveBodyGain.gain.linearRampToValueAtTime(bodyPeak * 0.9,  now + RISE + HOLD);
    waveBodyGain.gain.linearRampToValueAtTime(0.05,            now + RISE + HOLD + FALL);

    // Foam — emerges later in the rise, peaks just past the crest, decays exp.
    waveFoamGain.gain.cancelScheduledValues(now);
    waveFoamGain.gain.setValueAtTime(Math.max(waveFoamGain.gain.value, 0.0001), now);
    waveFoamGain.gain.linearRampToValueAtTime(0.03,             now + RISE * 0.55);
    waveFoamGain.gain.linearRampToValueAtTime(foamPeak,         now + RISE + HOLD * 0.3);
    waveFoamGain.gain.exponentialRampToValueAtTime(0.0001,      now + RISE + HOLD + FALL);

    const cycle = RISE + HOLD + FALL + LULL;
    setTimeout(scheduleWave, cycle * 1000);
  };

  // ── Tropical birds ──────────────────────────────────────────────
  // Four call types, picked by weighted random per event:
  //   chatter — quick chips in sequence (kingbirds, flycatchers)
  //   warble  — sustained tone with vibrato (oropendolas, orioles)
  //   whistle — slow gliss between two pitches (motmots, quail)
  //   squawk  — filtered sawtooth glide (parrots, chachalacas)
  // All feed into the delay halo so they echo into the canopy.

  const playTone = (freq, dur, peak, type) => {
    if (!audioCtx || !audioOn) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g);
    g.connect(masterGain);
    g.connect(delayBus);
    osc.start(now);
    osc.stop(now + dur + 0.05);
    setTimeout(() => { try { osc.disconnect(); g.disconnect(); } catch (_) {} },
               (dur + 0.2) * 1000);
  };

  const spawnChatter = () => {
    const count    = 4 + Math.floor(Math.random() * 5);   // 4–8 chips
    const baseFreq = 2000 + Math.random() * 1600;
    const peak     = 0.020 + Math.random() * 0.008;
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        if (!audioOn) return;
        const f = baseFreq * (0.82 + Math.random() * 0.45);
        playTone(f, 0.045 + Math.random() * 0.05, peak, 'sine');
      }, i * (55 + Math.random() * 55));   // 55–110 ms between chips
    }
  };

  const spawnWarble = () => {
    if (!audioCtx || !audioOn) return;
    const now = audioCtx.currentTime;
    const freq = 1300 + Math.random() * 1100;
    const dur  = 0.45 + Math.random() * 0.55;             // 450–1000 ms

    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    // Vibrato — 5–8 Hz LFO on frequency, ±25–55 Hz depth.
    const vib = audioCtx.createOscillator();
    vib.type = 'sine';
    vib.frequency.value = 5 + Math.random() * 3;
    const vibDepth = audioCtx.createGain();
    vibDepth.gain.value = 25 + Math.random() * 30;
    vib.connect(vibDepth).connect(osc.frequency);

    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.022, now + 0.06);
    g.gain.setValueAtTime(0.022, now + dur - 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(g);
    g.connect(masterGain);
    g.connect(delayBus);

    osc.start(now);
    vib.start(now);
    osc.stop(now + dur + 0.05);
    vib.stop(now + dur + 0.05);
    setTimeout(() => {
      try { osc.disconnect(); vib.disconnect(); vibDepth.disconnect(); g.disconnect(); } catch (_) {}
    }, (dur + 0.2) * 1000);
  };

  const spawnWhistle = () => {
    if (!audioCtx || !audioOn) return;
    const now = audioCtx.currentTime;
    const f1 = 900 + Math.random() * 800;                 // 900–1700 Hz
    const f2 = f1 * (0.7 + Math.random() * 0.6);
    const dur = 0.4 + Math.random() * 0.4;

    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f1, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(f2, 200), now + dur);

    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.024, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(g);
    g.connect(masterGain);
    g.connect(delayBus);

    osc.start(now);
    osc.stop(now + dur + 0.05);
    setTimeout(() => { try { osc.disconnect(); g.disconnect(); } catch (_) {} },
               (dur + 0.2) * 1000);
  };

  const spawnSquawk = () => {
    if (!audioCtx || !audioOn) return;
    const now = audioCtx.currentTime;
    const f1 = 520 + Math.random() * 400;                 // 520–920 Hz (parrot-ish)
    const f2 = f1 * (0.65 + Math.random() * 0.5);
    const dur = 0.22 + Math.random() * 0.28;

    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f1, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(f2, 180), now + dur);

    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1600;
    lp.Q.value = 1.2;

    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.025, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(lp).connect(g);
    g.connect(masterGain);
    g.connect(delayBus);

    osc.start(now);
    osc.stop(now + dur + 0.05);
    setTimeout(() => {
      try { osc.disconnect(); lp.disconnect(); g.disconnect(); } catch (_) {}
    }, (dur + 0.2) * 1000);
  };

  const spawnBird = () => {
    // Mix real samples with synthesis. When samples are loaded, ~65% of
    // chirps use a recording; the rest fall through to a synth call so
    // the texture still has its existing voice.
    // (Whistle removed — sounded too synth-spacy.)
    if (birdBuffers.length > 0 && Math.random() < 0.65) {
      spawnBirdSample();
      return;
    }
    const r = Math.random();
    if      (r < 0.50) spawnChatter();
    else if (r < 0.85) spawnWarble();
    else               spawnSquawk();
  };

  const scheduleBird = () => {
    if (!audioOn) return;
    const delay = 12000 + Math.random() * 28000;   // 12–40 s between chirps
    setTimeout(() => {
      if (!audioOn) return;
      // Sometimes a quick double-chirp (two birds in quick succession)
      spawnBird();
      if (Math.random() < 0.35) {
        setTimeout(() => audioOn && spawnBird(), 250 + Math.random() * 400);
      }
      scheduleBird();
    }, delay);
  };

  // Wind chime voice. Three inharmonic sine partials at Chowning bell
  // ratios (1×, 2.756×, 5.404×) — fundamental rings longest, higher
  // partials decay faster, giving the metallic shimmer that fades into
  // pure tone. Each click is a soft strike, not a pad.
  const spawnChime = (noteIndex) => {
    if (!audioCtx || !audioOn) return;
    const freq = PALETTE_NOTES[noteIndex];
    if (!freq) return;
    const now = audioCtx.currentTime;

    const partials = [
      { ratio: 1.000, gain: 0.020, decay: 4.5 + Math.random() * 1.8 },
      { ratio: 2.756, gain: 0.011, decay: 2.4 + Math.random() * 1.2 },
      { ratio: 5.404, gain: 0.005, decay: 1.1 + Math.random() * 0.6 }
    ];

    const voiceGain = audioCtx.createGain();
    voiceGain.gain.value = 1.0;
    voiceGain.connect(masterGain);
    voiceGain.connect(delayBus);

    const nodes = [voiceGain];

    partials.forEach(p => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * p.ratio;

      const g = audioCtx.createGain();
      const attack = 0.02 + Math.random() * 0.04;         // 20–60 ms strike
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(p.gain, now + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);

      osc.connect(g).connect(voiceGain);
      osc.start(now);
      osc.stop(now + p.decay + 0.1);
      nodes.push(osc, g);
    });

    const maxDecay = Math.max(...partials.map(p => p.decay));
    setTimeout(() => {
      try { nodes.forEach(n => n.disconnect()); } catch (_) {}
    }, (maxDecay + 0.3) * 1000);
  };

  const startAudio = () => {
    if (audioOn) return;
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    audioOn = true;

    // Ocean fades in slowly so the soundscape arrives with the first click.
    const now = audioCtx.currentTime;
    waveGain.gain.cancelScheduledValues(now);
    waveGain.gain.setValueAtTime(0, now);
    waveGain.gain.linearRampToValueAtTime(0.045, now + 6.0);
    scheduleWave();

    // If the surf sample already decoded while we waited, swap to it
    // immediately (will cross-fade out the synthetic waves).
    if (surfBuffer) swapToSurfSample();

    // First bird chirp arrives 8–25 seconds after the first click.
    setTimeout(() => { if (audioOn) { spawnBird(); scheduleBird(); } },
               8000 + Math.random() * 17000);
  };

  // ── interaction ──────────────────────────────────────────────────

  canvas.addEventListener('click', e => {
    if (!root) return;

    // First click anywhere on the canvas also activates the soundscape.
    if (!audioOn) startAudio();

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const hit = root.hit(px, py);
    if (!hit) return;
    const totalArea = width * height;
    const area = (hit.w * hit.h) / totalArea;

    if (area > MIN_AREA && hit.depth < SPLIT_LIMIT) {
      hit.split();
      spawnChime(hit.left.noteIndex);
      spawnChime(hit.right.noteIndex);
    } else if (hit.parent) {
      hit.parent.rejoin();
      spawnChime(hit.parent.noteIndex);
    }
  });

  // Debounced resize — full rebuild keeps the layout from getting weird.
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(rebuild, 120);
  });

  // ── animation loop ───────────────────────────────────────────────

  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const tick = () => {
    root.update();
    root.draw(ctx);
    if (!reduced) requestAnimationFrame(tick);
  };

  rebuild();
  if (reduced) {
    // Draw once, no animation, for users who opt out.
    root.draw(ctx);
  } else {
    requestAnimationFrame(tick);
  }
})();
