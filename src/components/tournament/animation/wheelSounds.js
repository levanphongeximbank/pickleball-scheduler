import { prefersReducedMotion } from "./animationUtils.js";

let audioContext = null;
let tickTimer = null;

async function getAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }

  if (prefersReducedMotion()) {
    return null;
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioCtx();
  }

  if (audioContext.state === "suspended") {
    try {
      await audioContext.resume();
    } catch {
      return null;
    }
  }

  return audioContext;
}

function playTone({ frequency = 440, duration = 0.08, type = "sine", volume = 0.07, delay = 0 }) {
  getAudioContext().then((ctx) => {
    if (!ctx) {
      return;
    }

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const startAt = ctx.currentTime + delay;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
  });
}

export function stopSpinTicks() {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

export function startSpinTicks(durationMs = 2600) {
  stopSpinTicks();

  if (prefersReducedMotion()) {
    return;
  }

  const intervalMs = Math.max(70, Math.floor(durationMs / 28));
  let tickIndex = 0;

  tickTimer = setInterval(() => {
    tickIndex += 1;
    playTone({
      frequency: 520 + (tickIndex % 5) * 40,
      duration: 0.035,
      type: "triangle",
      volume: 0.045,
    });
  }, intervalMs);

  setTimeout(stopSpinTicks, durationMs + 80);
}

export function playWheelSpinStart() {
  playTone({ frequency: 280, duration: 0.12, type: "sawtooth", volume: 0.05 });
}

export function playWheelLand() {
  stopSpinTicks();
  playTone({ frequency: 523.25, duration: 0.1, type: "sine", volume: 0.09 });
  playTone({ frequency: 659.25, duration: 0.14, type: "sine", volume: 0.08, delay: 0.06 });
  playTone({ frequency: 783.99, duration: 0.18, type: "sine", volume: 0.06, delay: 0.12 });
}

export function playTeamPlaced() {
  playTone({ frequency: 392, duration: 0.07, type: "sine", volume: 0.06 });
  playTone({ frequency: 494, duration: 0.1, type: "sine", volume: 0.05, delay: 0.05 });
}
