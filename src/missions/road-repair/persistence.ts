import { Result, Schema } from 'effect';
import { SnapshotDecodeError } from '../../runtime/storage.ts';
import { defaultTuning, phases as truckPhases } from './domain/dump-truck.ts';
import type { Tuning } from './domain/dump-truck.ts';
import { accessModes, resumeRoad, stages, HAUL_EXIT, HAUL_START, ROLLER_LEFT, ROLLER_RIGHT } from './domain/road.ts';
import type { RoadState, EntryStage } from './domain/road.ts';
import { DAMAGE_PATTERNS } from './domain/round.ts';

export interface RoadSnapshot { key: string; state: RoadState; tuning: Tuning; targetStage: EntryStage }
const finite = Schema.Number.check(Schema.isFinite());
const nonnegative = finite.check(Schema.isGreaterThanOrEqualTo(0));
const between = (minimum: number, maximum: number) => finite.check(Schema.isBetween({ minimum, maximum }));
const count = (maximum: number) => between(0, maximum).check(Schema.isInt());
const piece = count(2), pieces = Schema.Array(piece).pipe(Schema.mutable);
const coordinate = finite.check(Schema.isBetween({ minimum: -30, maximum: 30, exclusiveMinimum: true, exclusiveMaximum: true }));
const point = Schema.Struct({ x: coordinate, y: coordinate, z: coordinate });
const round = Schema.Struct({ pattern: Schema.Literals(DAMAGE_PATTERNS), layout: Schema.Literals([0, 1]) });
const excavatorFields = {
  action: Schema.Literals(['entering', 'ready', 'dragging', 'scooping', 'carrying', 'carrying-drag', 'unloading', 'returning', 'complete']),
  elapsed: nonnegative, cleared: count(3), bucket: point, target: point, from: point,
  control: Schema.Literals(['none', 'pointer', 'tap']),
};
const cargoFields = { delivered: pieces, carried: Schema.NullOr(piece), aimed: Schema.NullOr(piece) };
const excavator = Schema.Struct({ ...excavatorFields, ...cargoFields });
const hauler = Schema.Struct({ action: Schema.Literals(['ready', 'dragging', 'leaving', 'complete']), x: between(HAUL_EXIT, HAUL_START), elapsed: nonnegative });
const stateFields = {
  phase: Schema.Literals(['excavator', 'haul-away', 'dump-truck', 'roller', 'traffic', 'complete']),
  access: Schema.Literals(accessModes), elapsed: nonnegative,
  truck: Schema.Struct({ phase: Schema.Literals(truckPhases), elapsed: nonnegative, dragPx: nonnegative, fromTilt: nonnegative }),
  roller: Schema.Struct({ action: Schema.Literals(['entering', 'ready', 'dragging', 'settling', 'flattening', 'complete']), elapsed: nonnegative, x: between(ROLLER_LEFT, ROLLER_RIGHT), passes: count(2) }),
  hauler,
};
const current = Schema.Struct({ ...stateFields, version: Schema.Literal(1), round, excavator });
const snapshot = Schema.Struct({ key: Schema.String, state: current,
  tuning: Schema.Struct({ dragThreshold: between(30, 140), dumpTilt: between(0.69, 1.23), dumpDuration: between(1, 3) }),
  targetStage: Schema.optional(Schema.Unknown),
});
const decodeSnapshot = Schema.decodeUnknownResult(snapshot);
const decodeNormalized = Schema.decodeUnknownResult(current);

function cargoIssue(e: typeof excavator.Type): string | undefined {
  const loaded = ['scooping', 'carrying', 'carrying-drag', 'unloading'].includes(e.action);
  if (loaded && e.cleared === 3) return 'excavator: completed cargo cannot remain in the bucket';
  if (e.action === 'complete' && e.cleared !== 3) return 'excavator: completion requires all three pieces';
  if (e.delivered.length !== e.cleared || new Set(e.delivered).size !== e.delivered.length
    || (loaded ? e.carried == null || e.delivered.includes(e.carried) : e.carried !== null)) return 'excavator: cargo ownership contradicts cleared count or bucket action';
}
function stateIssue(state: typeof current.Type): string | undefined {
  const e = state.excavator, h = state.hauler, r = state.roller;
  const cargo = cargoIssue(e); if (cargo) return cargo;
  if (state.phase !== 'excavator' && (e.action !== 'complete' || e.cleared !== 3)) return 'phase: excavation must finish before the next vehicle';
  if (state.phase === 'haul-away' ? state.access !== 'working' || h.action === 'complete'
    : state.phase === 'excavator' ? h.action !== 'ready' || h.x !== HAUL_START : h.action !== 'complete') return 'hauler: cargo or access contradicts mission phase';
  if (['roller', 'traffic', 'complete'].includes(state.phase) && state.truck.phase !== 'complete') return 'truck: filling must finish before rolling';
  if (['traffic', 'complete'].includes(state.phase) && (r.action !== 'complete' || r.passes !== 2)) return 'roller: traffic requires both passes';
  if ((r.action === 'entering' && r.passes !== 0) || (r.action === 'settling' && r.passes !== 1)
    || (['flattening', 'complete'].includes(r.action) ? r.passes !== 2 : r.passes === 2)) return 'roller: pass count contradicts action';
}

/** Only the current complete format is accepted; recovery releases transient input. */
export function decodeRoadSnapshot(value: unknown, snapshotKey: string) {
  const fail = (stage: SnapshotDecodeError['stage'], cause: unknown) => Result.fail(new SnapshotDecodeError({ key: snapshotKey, stage, cause }));
  try {
    const decoded = decodeSnapshot(value);
    if (Result.isFailure(decoded)) return fail('schema', decoded.failure);
    const data = decoded.success, candidate = data.state;
    if (data.key !== snapshotKey) return fail('invariant', new Error('Snapshot key does not match'));
    const cargo = cargoIssue(candidate.excavator);
    if (cargo) return fail('invariant', new Error(cargo));
    const tuning: Tuning = { ...data.tuning, dragTilt: defaultTuning.dragTilt };
    // The pure recovery function only cancels transient input.
    const resumed = resumeRoad(candidate, tuning);
    const checked = decodeNormalized(resumed);
    if (Result.isFailure(checked)) return fail('resume', checked.failure);
    const issue = stateIssue(checked.success);
    if (issue) return fail('invariant', new Error(issue));
    const targetStage = stages.includes(data.targetStage as EntryStage) ? data.targetStage as EntryStage : checked.success.phase;
    return Result.succeed({ state: checked.success, tuning, targetStage });
  } catch (cause) { return fail('resume', cause); }
}
