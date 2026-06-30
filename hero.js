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

  // (PALETTE_NOTES, BELL_NOTES, TUNINGS, BELL_MAP are defined below in
  // the Optional audio samples block — multiple tunings selectable
  // via URL hash, e.g. #tuning=lydian.)

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
  // wave layer, bird events use samples, and the wind chimes are
  // replaced by real vibraphone notes. If a file is missing, that
  // layer falls back to synthesis — site always works either way.
  //   /sounds/surf.mp3                  — seamless surf loop (~15–30 s)
  //   /sounds/birds/bird-01.mp3 … 12.mp3  — short tropical bird clips
  //   /sounds/bells/{B3,E4,Gb4,G4,Db5,E5,A5}.m4a — UofI vibraphone notes
  let surfBuffer = null;
  const birdBuffers = [];
  const bellBuffers = {};      // note name → AudioBuffer
  let surfSampleGain = null;

  // Available vibraphone notes (UofI MIS, ≈ chromatic B3–E6) and their
  // 12-TET frequencies. Each palette pitch is realized by playing the
  // closest sample with a small playbackRate shift to hit the exact
  // target — this lets us swap tuning systems without re-downloading.
  const BELL_NOTES = {
    'B3':  246.94, 'C4':  261.63, 'D4':  293.66, 'E4':  329.63,
    'F4':  349.23, 'Gb4': 369.99, 'G4':  391.99, 'A4':  440.00,
    'B4':  493.88, 'C5':  523.25, 'Db5': 554.37, 'D5':  587.33,
    'E5':  659.25, 'F5':  698.46, 'Gb5': 739.99, 'G5':  783.99,
    'A5':  880.00, 'Bb5': 932.33, 'B5':  987.77, 'C6':  1046.50,
    'D6':  1174.66, 'E6': 1318.51
  };

  // Tuning presets — each is the seven palette pitches in the order
  // [cream, sand, amber, terracotta, dusty pink, clay, ocean].
  // Pick one at runtime via URL hash: e.g.  #tuning=lydian
  const TUNINGS = {
    // Overtones 8/11/12/13/18/22/30 of a 30 Hz sub-audio fundamental.
    // Microtonal weirdness on 11th/13th/22nd — bright and uplifting.
    harmonic: [900, 660, 540, 360, 390, 330, 240],

    // Just-intonation C major over two octaves — clean wedding bells.
    just:     [1318.51, 1046.50, 783.99, 587.33, 659.25, 392.00, 261.63],

    // C Lydian — same as major but with raised 4th (F#, the tritone).
    // Brightest of the diatonic modes; slightly otherworldly.
    lydian:   [1318.51,  987.77, 880.00, 587.33, 739.99, 392.00, 261.63],

    // Wendy Carlos α scale — 78-cent steps, no octave equivalence,
    // designed to maximise major-sounding harmonies in weird intervals.
    alpha:    [1010.6,  806.8,  644.1,  392.0,  491.6,  327.5,  261.63],

    // Indonesian Pelog — ceremonial gamelan tuning, 7-note irregular
    // spacing; exotic but rooted, often used in temple music.
    pelog:    [ 906,    784,    726,    578,    498,    265,    247  ]
  };

  const tuningName = ((location.hash.match(/tuning=(\w+)/) || [])[1] || 'just').toLowerCase();
  const PALETTE_NOTES = TUNINGS[tuningName] || TUNINGS.just;

  // For each palette target, pick the available bell whose 12-TET pitch
  // is closest in cents — minimises the playbackRate shift so the
  // vibraphone timbre is preserved.
  const BELL_NAMES_LIST = Object.keys(BELL_NOTES);
  const BELL_MAP = PALETTE_NOTES.map(target => {
    let bestName = BELL_NAMES_LIST[0];
    let bestCents = Math.abs(1200 * Math.log2(target / BELL_NOTES[bestName]));
    for (const n of BELL_NAMES_LIST) {
      const c = Math.abs(1200 * Math.log2(target / BELL_NOTES[n]));
      if (c < bestCents) { bestName = n; bestCents = c; }
    }
    return { name: bestName, base: BELL_NOTES[bestName] };
  });

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
  // Fetch ALL bells so any tuning works at runtime — the active subset
  // is determined by BELL_MAP, but having the full chromatic set lets
  // a tuning hash-swap take effect immediately on reload.
  const bellArrayPromises = {};
  BELL_NAMES_LIST.forEach(name => {
    bellArrayPromises[name] = fetchOrNull(`sounds/bells/${name}.m4a`);
  });

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
    // Bells: each note decoded into bellBuffers keyed by note name.
    // spawnChime() prefers real samples over the synth fallback.
    Object.entries(bellArrayPromises).forEach(([name, p]) => {
      p.then(arrBuf => {
        if (!arrBuf) return;
        audioCtx.decodeAudioData(arrBuf.slice(0)).then(buf => {
          bellBuffers[name] = buf;
        }).catch(() => {});
      });
    });
  };

  // Play one bell sample, pitch-shifted via playbackRate to the
  // exact palette frequency. Velocity-scaled like the synth bells.
  const spawnBellSample = (buf, rate) => {
    if (!audioCtx || !audioOn) return;
    const now = audioCtx.currentTime;
    const v = 0.7 + Math.random() * 0.3;

    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;

    const gain = audioCtx.createGain();
    const peak = 0.30 * v;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.005);

    // Vibraphone sustains naturally for several seconds — let it ring
    // but cap at 5.5 s with a graceful tail.
    const natDur = buf.duration / rate;
    const dur = Math.min(natDur, 5.5);
    if (dur >= 5.0) {
      gain.gain.setValueAtTime(peak, now + dur - 0.6);
      gain.gain.linearRampToValueAtTime(0.0001, now + dur);
    }

    // Same dry/wet split as the synth bells: mostly direct, plus a
    // send to the shared delay halo.
    const dryGain = audioCtx.createGain();
    dryGain.gain.value = 0.85;

    src.connect(gain);
    gain.connect(dryGain).connect(masterGain);
    gain.connect(delayBus);

    src.start(now);
    src.stop(now + dur + 0.05);

    setTimeout(() => {
      try { src.disconnect(); gain.disconnect(); dryGain.disconnect(); } catch (_) {}
    }, (dur + 0.3) * 1000);
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
  // Sample-only. Each event picks a random recording from birdBuffers
  // (CC BY-SA 4.0 xeno-canto uploads in /sounds/birds/). If samples
  // haven't loaded yet — or the directory is empty — this is a no-op
  // and the chirp just doesn't happen.
  const spawnBird = () => {
    if (birdBuffers.length === 0) return;
    spawnBirdSample();
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

  // Church-handbell voice — hand-cast bronze bell struck by a felt/
  // leather clapper. Pure harmonic partials (1×, 1.5×, 2×, 3×, 4×) —
  // the perfect-5th quint at 1.5× is what gives handbells their
  // characteristic sweet ring. Clean strike (no wooden transient),
  // moderate decays (3–5 s on the fundamental). Tighter velocity
  // range than outdoor chimes — handbell ringers play with control.
  // Slightly drier mix (more direct, less halo) for an indoor feel.
  const spawnChime = (noteIndex) => {
    if (!audioCtx || !audioOn) return;
    const freq = PALETTE_NOTES[noteIndex];
    if (!freq) return;
    const now = audioCtx.currentTime;

    // Prefer real vibraphone samples when loaded — pitch-shift via
    // playbackRate to hit the exact Harmonic Series Mode target.
    const mapping = BELL_MAP[noteIndex];
    if (mapping && bellBuffers[mapping.name]) {
      spawnBellSample(bellBuffers[mapping.name], freq / mapping.base);
      return;
    }

    const v = 0.7 + Math.random() * 0.3;   // controlled strike intensity

    const partials = [
      { ratio: 1.000, gain: 0.013 * v,  decay: 3.8 + Math.random() * 1.5 },  // fundamental
      { ratio: 1.500, gain: 0.009 * v,  decay: 3.2 + Math.random() * 1.2 },  // quint (perfect 5th) — handbell signature
      { ratio: 2.000, gain: 0.007 * v,  decay: 2.5 + Math.random() * 1.0 },  // octave (nominal)
      { ratio: 3.000, gain: 0.004 * v,  decay: 1.5 + Math.random() * 0.5 },  // 12th
      { ratio: 4.000, gain: 0.002 * v,  decay: 1.0 + Math.random() * 0.4 }   // 2 octaves
    ];

    const voiceGain = audioCtx.createGain();
    voiceGain.gain.value = 1.0;

    // Drier than outdoor wind chimes — handbells are typically played
    // indoors, so the direct sound dominates with a touch of room.
    const dryGain = audioCtx.createGain();
    dryGain.gain.value = 0.85;
    voiceGain.connect(dryGain).connect(masterGain);
    voiceGain.connect(delayBus);

    const nodes = [voiceGain, dryGain];

    partials.forEach(p => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * p.ratio;

      const g = audioCtx.createGain();
      const attack = 0.005 + Math.random() * 0.007;       // 5–12 ms — quick clapper strike
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
