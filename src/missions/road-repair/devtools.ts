type ViteHotContext = NonNullable<ImportMeta['hot']>;
import { defaultTuning } from './domain/dump-truck.ts';
import type { Tuning } from './domain/dump-truck.ts';
import type { Point } from './domain/excavator.ts';
import { resumeRoad, stages } from './domain/road.ts';
import type { RoadState, EntryStage } from './domain/road.ts';

interface Snapshot { key: string; state: RoadState; tuning: Tuning; targetStage: EntryStage }

export function restoreDevelopment(snapshotKey: string, hot?: ViteHotContext) {
  try {
    const data = hot?.data.snapshot ?? JSON.parse(sessionStorage.getItem(snapshotKey) ?? 'null');
    if (data?.key === snapshotKey) {
      const candidate = data.state as RoadState;
      const settings = data.tuning as Tuning;
      const pointOK = (p: Point) => p && [p.x, p.y, p.z].every(v => Number.isFinite(v) && Math.abs(v) < 30);
      const e = candidate.excavator, r = candidate.roller, t = candidate.truck;
      if (['excavator', 'dump-truck', 'roller', 'traffic', 'complete'].includes(candidate.phase)
        && ['entering', 'ready', 'dragging', 'scooping', 'unloading', 'returning', 'complete'].includes(e.action)
        && ['entering', 'ready', 'dragging', 'settling', 'flattening', 'complete'].includes(r.action)
        && ['entering', 'ready', 'dragging', 'resetting', 'dumping', 'lowering', 'complete'].includes(t.phase)
        && [candidate.elapsed, e.elapsed, r.elapsed, t.elapsed, t.dragPx, t.fromTilt].every(v => Number.isFinite(v) && v >= 0)
        && [e.bucket, e.target, e.from].every(pointOK)
        && Number.isInteger(e.cleared) && e.cleared >= 0 && e.cleared <= 3
        && Number.isInteger(r.passes) && r.passes >= 0 && r.passes <= 2
        && Number.isFinite(r.x) && r.x >= -1.2 && r.x <= 5.4
        && settings.dragThreshold >= 30 && settings.dragThreshold <= 140
        && settings.dumpTilt >= 0.69 && settings.dumpTilt <= 1.23
        && settings.dumpDuration >= 1 && settings.dumpDuration <= 3) {
        const tuning = { ...settings, dragTilt: defaultTuning.dragTilt };
        return { state: resumeRoad(candidate, tuning), tuning, targetStage: stages.includes(data.targetStage) ? data.targetStage as EntryStage : candidate.phase };
      }
    }
  } catch { /* Ignore old or unavailable development snapshots. */ }
}

export function saveDevelopment(snapshot: Snapshot, hot?: ViteHotContext) {
  if (hot) hot.data.snapshot = snapshot;
  try { sessionStorage.setItem(snapshot.key, JSON.stringify(snapshot)); } catch { /* Optional storage. */ }
}
