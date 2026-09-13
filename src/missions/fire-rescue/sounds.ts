const cues = { depart: [392, 523, 392, 523], connected: [330, 440, 523], out: [523, 659], resident: [392, 494, 587], cat: [880, 660], arrived: [440, 554, 659], complete: [392, 494, 587, 784, 988] } as const;
export type FireCue = keyof typeof cues;

// One context owns the short cues and the low, continuous water sound.
export function createFireAudio() {
  let context: AudioContext | undefined, noise: AudioBufferSourceNode | undefined, water: GainNode | undefined;
  let muted = false, spraying = false;
  function sync() {
    if (context && water) water.gain.setTargetAtTime(spraying && !muted ? 0.025 : 0, context.currentTime, 0.08);
  }
  return {
    unlock() {
      if (!context) {
        context = new AudioContext();
        const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate), data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        noise = context.createBufferSource(); noise.buffer = buffer; noise.loop = true;
        const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1600;
        water = context.createGain(); water.gain.value = 0;
        noise.connect(filter).connect(water).connect(context.destination); noise.start(); sync();
      }
      return context.state === 'suspended' ? context.resume() : Promise.resolve();
    },
    setMuted(value: boolean) { muted = value; sync(); },
    setSpraying(value: boolean) { if (spraying !== value) { spraying = value; sync(); } },
    play(cue: FireCue) {
      if (!context || context.state !== 'running' || muted) return;
      cues[cue].forEach((hz, i) => {
        const tone = context!.createOscillator(), gain = context!.createGain(), start = context!.currentTime + i * (cue === 'cat' ? 0.32 : 0.14);
        tone.type = cue === 'cat' ? 'triangle' : 'sine'; tone.frequency.setValueAtTime(hz, start);
        if (cue === 'cat') tone.frequency.exponentialRampToValueAtTime(hz * 0.72, start + 0.28);
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(cue === 'cat' ? 0.035 : 0.055, start + 0.04); gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
        tone.connect(gain).connect(context!.destination); tone.start(start); tone.stop(start + 0.32);
        tone.onended = () => { tone.disconnect(); gain.disconnect(); };
      });
    },
    async dispose() { noise?.stop(); noise?.disconnect(); water?.disconnect(); if (context && context.state !== 'closed') await context.close(); },
  };
}
