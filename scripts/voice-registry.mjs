import { fireLines, fireVoiceSource } from '../src/missions/fire-rescue/domain/narration.ts';
import { voiceSource } from '../src/runtime/voice-script.ts';
import { voicePlan as road } from '../src/missions/road-repair/domain/narration.ts';
import { voicePlan as house } from '../src/missions/house-build/domain/narration.ts';

import { voicePlan as traffic } from '../src/missions/traffic-rescue/domain/narration.ts';
import { voicePlan as port } from '../src/missions/port-cargo/domain/narration.ts';
import { voicePlan as mountain } from '../src/missions/mountain-clearance/domain/narration.ts';

import { voicePlan as transit } from '../src/missions/passenger-transfer/domain/narration.ts';

import { voicePlan as police } from '../src/missions/police-patrol/domain/narration.ts';

export const voiceRegistry = [
  { mission: 'fire-rescue', lines: fireLines, source: fireVoiceSource },
  ...[road, house, traffic, port, mountain, transit, police].map(plan => ({
    mission: plan.mission, lines: plan.lines, source: id => voiceSource(plan, id),
  })),
].map(item => ({ ...item, manifestPath: `src/missions/${item.mission}/voice-assets.json` }));
