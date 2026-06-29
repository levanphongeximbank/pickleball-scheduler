let audioContext = null;
let soundEnabled = false;

function getAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return null;
    }
    audioContext = new AudioCtx();
  }

  return audioContext;
}

function playTone({ frequency, durationMs, type = "sine", gain = 0.04 }) {
  if (!soundEnabled) {
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) {
    return;
  }

  const oscillator = ctx.createOscillator();
  const volume = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  volume.gain.value = gain;
  oscillator.connect(volume);
  volume.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + durationMs / 1000);
}

export function setTournamentSoundEnabled(enabled) {
  soundEnabled = Boolean(enabled);
}

export function isTournamentSoundEnabled() {
  return soundEnabled;
}

export function playTickSound() {
  playTone({ frequency: 880, durationMs: 60, type: "square", gain: 0.025 });
}

export function playWhooshSound() {
  playTone({ frequency: 220, durationMs: 180, type: "triangle", gain: 0.03 });
}

export function playDingSound() {
  playTone({ frequency: 1046, durationMs: 220, type: "sine", gain: 0.045 });
}
