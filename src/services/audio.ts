export type AudioCueMode = "speech" | "tone";

const playTone = async (durationSeconds = 0.12): Promise<void> => {
  if (typeof window === "undefined" || !("AudioContext" in window)) {
    throw new Error("Browser audio is unavailable.");
  }
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    context.currentTime + durationSeconds,
  );
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + durationSeconds);
  await new Promise<void>((resolve) => {
    oscillator.addEventListener("ended", () => resolve(), { once: true });
  });
  await context.close();
};

export const playAudioCue = async (
  label: string,
  spoken: boolean,
): Promise<AudioCueMode> => {
  if (
    spoken &&
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  ) {
    const utterance = new SpeechSynthesisUtterance(label);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
    return "speech";
  }
  await playTone();
  return "tone";
};

export const primeAudio = (): Promise<void> => playTone(0.06);
