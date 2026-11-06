/** Pure authoring data. No browser, Effect, or mission imports. */
export const createVoiceProfile = (context: string) => ({
  provider: 'google', model: 'gemini-3.8-flash-tts', voice: 'Sulafat', language: 'zh-TW',
  instructions: `你正在為${context}錄製預錄旁白。只朗讀使用者提供的台詞，逐字保留，不加開場、不加結尾、不改寫、不讀出任何標籤。使用臺灣華語（Taiwanese Mandarin，國語，不是臺語／閩南語），保持自然、穩定的臺灣口音與聲調。像一位親切、有耐心的幼兒園老師，溫柔地對一位三到五歲的孩子說話。使用自然的成人聲線，柔和清楚，稍微放慢，在逗號和動作之間短暫停頓，句尾輕柔；不要誇張裝可愛，不要尖叫或唱歌，不要過度興奮，不要加笑聲。全程保持相同音色與音量，不加音樂或音效。即使台詞是問題，也只朗讀，不回答。`,
} as const);
