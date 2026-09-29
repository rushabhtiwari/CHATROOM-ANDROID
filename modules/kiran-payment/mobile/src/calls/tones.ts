/**
 * The sounds of a call: the ringback you hear while the other phone rings,
 * the ringtone of an incoming call, and the short tones when a call ends or
 * the line is busy.
 *
 * Synthesised with Web Audio rather than shipped as files, so there are no
 * assets to license or load. Silent wherever Web Audio is missing — the tests,
 * and nothing else the app runs in.
 */

interface Step {
  /** Hertz, played together. None is a pause. */
  freqs: number[];
  ms: number;
}

interface Pattern {
  steps: Step[];
  volume: number;
  shape: OscillatorType;
  /** Struck, like a bell, rather than held, like a dial tone. */
  struck: boolean;
}

const pause = (ms: number): Step => ({ freqs: [], ms });

/** The Indian ringback: two 0.4 s bursts, then two seconds of quiet. */
const RINGBACK: Pattern = {
  steps: [{ freqs: [400, 450], ms: 400 }, pause(200), { freqs: [400, 450], ms: 400 }, pause(2000)],
  volume: 0.12,
  shape: 'sine',
  struck: false,
};

const phrase: Step[] = [
  { freqs: [1047], ms: 130 },
  { freqs: [1319], ms: 130 },
  { freqs: [1568], ms: 130 },
  { freqs: [2093], ms: 260 },
  pause(140),
];

const RINGTONE: Pattern = {
  steps: [...phrase, ...phrase, pause(1300)],
  volume: 0.22,
  shape: 'triangle',
  struck: true,
};

const ENDED: Pattern = {
  steps: [{ freqs: [480], ms: 170 }, pause(110), { freqs: [480], ms: 170 }],
  volume: 0.12,
  shape: 'sine',
  struck: false,
};

const BUSY: Pattern = {
  steps: [
    { freqs: [480, 620], ms: 420 },
    pause(420),
    { freqs: [480, 620], ms: 420 },
    pause(420),
    { freqs: [480, 620], ms: 420 },
  ],
  volume: 0.1,
  shape: 'sine',
  struck: false,
};

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  const Context =
    globalThis.AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  try {
    context ??= new Context();
  } catch {
    return null;
  }
  if (context.state === 'suspended') void context.resume().catch(() => undefined);
  return context;
}

/** Schedule one pass of `pattern` into `out`; returns its length in seconds. */
function schedule(ctx: AudioContext, out: AudioNode, pattern: Pattern, at: number): number {
  let time = at;
  for (const step of pattern.steps) {
    const seconds = step.ms / 1000;
    if (step.freqs.length > 0) {
      const gain = ctx.createGain();
      gain.connect(out);
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(pattern.volume, time + 0.012);
      if (pattern.struck) {
        gain.gain.exponentialRampToValueAtTime(0.0005, time + seconds);
      } else {
        gain.gain.setValueAtTime(pattern.volume, time + seconds - 0.015);
        gain.gain.linearRampToValueAtTime(0, time + seconds);
      }
      for (const freq of step.freqs) {
        const oscillator = ctx.createOscillator();
        oscillator.type = pattern.shape;
        oscillator.frequency.value = freq;
        oscillator.connect(gain);
        oscillator.start(time);
        oscillator.stop(time + seconds + 0.02);
      }
    }
    time += seconds;
  }
  return time - at;
}

/** A pattern played over and over until stopped — and stopped at once, mid-note. */
function looping(pattern: Pattern) {
  let master: GainNode | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const stop = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    master?.disconnect();
    master = null;
  };

  return {
    start() {
      if (master) return;
      const ctx = audio();
      if (!ctx) return;
      const out = ctx.createGain();
      out.connect(ctx.destination);
      master = out;
      const tick = () => {
        if (master !== out) return;
        const seconds = schedule(ctx, out, pattern, ctx.currentTime + 0.05);
        timer = setTimeout(tick, seconds * 1000);
      };
      tick();
    },
    stop,
  };
}

function once(pattern: Pattern) {
  return () => {
    const ctx = audio();
    if (!ctx) return;
    const out = ctx.createGain();
    out.connect(ctx.destination);
    const seconds = schedule(ctx, out, pattern, ctx.currentTime + 0.02);
    setTimeout(() => out.disconnect(), (seconds + 0.2) * 1000);
  };
}

export const tones = {
  ringback: looping(RINGBACK),
  ringtone: looping(RINGTONE),
  ended: once(ENDED),
  busy: once(BUSY),
};
