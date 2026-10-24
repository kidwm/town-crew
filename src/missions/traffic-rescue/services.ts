import { Context, Effect, Layer } from 'effect';
import * as progress from '../../app/progress.ts';
import type { ProgressStore } from '../../app/progress.ts';
import { createDevelopmentStore, loadDevelopment, saveDevelopment } from '../../app/development.ts';
import type { DevelopmentStore } from '../../app/development.ts';
import { createMissionPersistence } from '../../app/mission-persistence.ts';
import { sessionStorageBoundary } from '../../runtime/storage.ts';
import type { StorageBoundary } from '../../runtime/storage.ts';
import { closeMissionAudio } from '../../runtime/mission-lifecycle.ts';
import { decodeTrafficSnapshot } from './persistence.ts';
import { chooseColors, PALETTE } from './domain/traffic.ts';
import type { createTrafficAudio } from './session.ts';

export function createTrafficPersistence(
  store: ProgressStore = progress,
  storage: StorageBoundary = sessionStorageBoundary,
  development: DevelopmentStore = createDevelopmentStore(storage),
) {
  let lastColors: [number, number] | undefined;
  const colorKey = 'town-crew:traffic:last-colors:v1';
  function rememberColors(colors: [number, number]) {
    lastColors = [...colors]; storage.writeJson(colorKey, lastColors);
  }
  return {
    ...createMissionPersistence('traffic-rescue', decodeTrafficSnapshot, store, development),
    rememberColors,
    newColors() {
      if (!lastColors) {
        const colors = storage.readJson(colorKey);
        if (Array.isArray(colors) && colors.length === 2 && colors.every(c => Number.isInteger(c) && c >= 0 && c < PALETTE.length)) lastColors = colors as [number, number];
      }
      const colors = chooseColors(lastColors); rememberColors(colors); return colors;
    },
  };
}
// Reused across visits/HMR; the audio Layer below is built within each mission scope.
export const trafficPersistence = createTrafficPersistence(progress, sessionStorageBoundary, { loadDevelopment, saveDevelopment });
export class TrafficPersistence extends Context.Service<TrafficPersistence, ReturnType<typeof createTrafficPersistence>>()('town-crew/TrafficPersistence') {}
export const TrafficPersistenceLive = Layer.succeed(TrafficPersistence, trafficPersistence);
export type TrafficAudioService = ReturnType<typeof createTrafficAudio>;
export class TrafficAudio extends Context.Service<TrafficAudio, TrafficAudioService>()('town-crew/TrafficAudio') {}
export const trafficAudioLayer = (make: () => TrafficAudioService) => Layer.effect(TrafficAudio,
  Effect.acquireRelease(Effect.sync(make), audio => closeMissionAudio('traffic-rescue', audio)),
);
