import { fireLines, fireVoiceSource } from '../src/missions/fire-rescue/domain/narration.ts';
import { voiceSource } from '../src/runtime/voice-script.ts';
import { voicePlan as road } from '../src/missions/road-repair/domain/narration.ts';
import { voicePlan as house } from '../src/missions/house-build/domain/narration.ts';

export const voiceRegistry = [
  { mission: 'fire-rescue', lines: fireLines, source: fireVoiceSource },
  ...[road, house].map(plan => ({
    mission: plan.mission, lines: plan.lines, source: id => voiceSource(plan, id),
  })),
].map(item => ({ ...item, manifestPath: `src/missions/${item.mission}/voice-assets.json` }));
