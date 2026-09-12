// Browser audio must be resumed inside a real pointer gesture, including on iPad.
export function createAudio() {
  let context: AudioContext | undefined;
  let muted = false;
  return {
    unlock() {
      context ??= new AudioContext();
      return context.state === 'suspended' ? context.resume() : Promise.resolve();
    },
    setMuted(value: boolean) { muted = value; },
    play(kind: 'grab' | 'dump' | 'scoop' | 'compact' | 'horn' | 'complete') {
      if (!context || context.state !== 'running' || muted) return;
      const cues = { grab: [330], dump: [196, 147], scoop: [294, 392], compact: [220, 330], horn: [392, 494], complete: [523, 659, 784] };
      const tones = cues[kind];
      tones.forEach((frequency, index) => {
        const oscillator = context!.createOscillator();
        const gain = context!.createGain();
        const start = context!.currentTime + index * 0.13;
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.07, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
        oscillator.connect(gain).connect(context!.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.25);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
    },
    async dispose() {
      if (context && context.state !== 'closed') await context.close();
    },
  };
}
