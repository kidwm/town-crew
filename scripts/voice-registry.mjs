import { fireLines, fireVoiceSource } from '../src/missions/fire-rescue/domain/narration.ts';

// Only missions with narration in this release belong to the offline asset gate.
export const voiceRegistry = [
  { mission: 'fire-rescue', lines: fireLines, source: fireVoiceSource, manifestPath: 'src/missions/fire-rescue/voice-assets.json' },
];
