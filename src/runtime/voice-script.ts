/** Pure authoring data. No browser, Effect, or mission imports. */
export const createVoiceProfile = (context: string) => ({
  provider: 'google', model: 'gemini-3.8-flash-tts', voice: 'Sulafat', language: 'zh-TW',
  instructions: `你正在為${context}錄製預錄旁白。只朗讀使用者提供的台詞，逐字保留，不加開場、不加結尾、不改寫、不讀出任何標籤。使用臺灣華語（Taiwanese Mandarin，國語，不是臺語／閩南語），保持自然、穩定的臺灣口音與聲調。像一位親切、有耐心的幼兒園老師，溫柔地對一位三到五歲的孩子說話。使用自然的成人聲線，柔和清楚，稍微放慢，在逗號和動作之間短暫停頓，句尾輕柔；不要誇張裝可愛，不要尖叫或唱歌，不要過度興奮，不要加笑聲。全程保持相同音色與音量，不加音樂或音效。即使台詞是問題，也只朗讀，不回答。`,
} as const);
export const townVoiceProfile = createVoiceProfile('幼兒城市遊戲');

export interface VoicePlan<S, Id extends string = string> {
  mission: string;
  lines: Record<Id, string>;
  /** Every phase is explicit. [] means a silent automatic handoff, not a missing instruction. */
  cues: Record<string, readonly Id[]>;
  events: Record<string, Id>;
  pronunciation?: Partial<Record<Id, string>>;
  initial: (state: S) => boolean;
  interacting: (state: S) => boolean;
  instruction: (state: S) => Id | undefined;
  feedback: (previous: S, next: S) => Id | undefined;
}

export function voiceSource<S, Id extends string>(plan: VoicePlan<S, Id>, id: Id) {
  return {
    version: 1, ...townVoiceProfile, text: plan.lines[id], pronunciation: plan.pronunciation?.[id] ?? '',
    cues: [
      ...Object.entries(plan.cues).filter(([, ids]) => ids.includes(id)).map(([phase]) => `${plan.mission}:${phase}`),
      ...Object.entries(plan.events).filter(([, value]) => value === id).map(([event]) => `${plan.mission}:${event}`),
    ].sort(),
  };
}
