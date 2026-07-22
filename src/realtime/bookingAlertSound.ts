let sharedAudioContext: AudioContext | null = null;
let unlocked = false;
let primedAudio: HTMLAudioElement | null = null;

const BEEP_URL = "/sounds/booking-beep.wav";

function getAudioContext() {
  const AudioCtx =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioCtx) return null;

  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new AudioCtx();
  }

  return sharedAudioContext;
}

function getHtmlAudio() {
  if (!primedAudio) {
    primedAudio = new Audio(BEEP_URL);
    primedAudio.preload = "auto";
  }
  return primedAudio;
}

async function playHtmlBeep() {
  try {
    const audio = getHtmlAudio();
    audio.currentTime = 0;
    audio.volume = 1;
    await audio.play();
  } catch {
    // Ignore HTML audio failures (autoplay / missing file).
  }
}

function playOscillatorBeep(context: AudioContext) {
  const playTone = (startAt: number, frequency: number, duration = 0.18) => {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = frequency;
    gainNode.gain.setValueAtTime(0.001, startAt);
    gainNode.gain.linearRampToValueAtTime(0.22, startAt + 0.015);
    gainNode.gain.linearRampToValueAtTime(0.001, startAt + duration);
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
  };

  const now = context.currentTime;
  playTone(now, 880);
  playTone(now + 0.24, 1240);
}

/** Unlock audio after first user gesture (required by browsers). */
export async function unlockBookingAlertAudio() {
  const context = getAudioContext();
  if (context && context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      // Ignore unlock failures until a later interaction.
    }
  }

  try {
    const audio = getHtmlAudio();
    audio.volume = 0.001;
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 1;
  } catch {
    // Ignore.
  }

  unlocked = true;
}

export async function playBookingAlertBeep() {
  if (!unlocked) {
    await unlockBookingAlertAudio();
  }

  // Prefer HTML audio file — most reliable across browsers / Electron.
  try {
    await playHtmlBeep();
    return;
  } catch {
    // Fall through.
  }

  const context = getAudioContext();
  if (!context) return;

  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      return;
    }
  }

  try {
    playOscillatorBeep(context);
  } catch {
    // Ignore oscillator failures.
  }
}
