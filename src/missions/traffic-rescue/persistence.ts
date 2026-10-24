import { Schema } from 'effect';
import { between, createSnapshotDecoder, integer } from '../../runtime/snapshot.ts';
import { resumeTraffic, stages, PALETTE, DEBRIS } from './domain/traffic.ts';
import type { TrafficState } from './domain/traffic.ts';

const flagPair = Schema.Tuple([Schema.Boolean, Schema.Boolean]).pipe(Schema.mutable);
const tow = Schema.Literals(['flatbed', 'wheel-lift']);
const towTypes = Schema.Tuple([tow, tow]).pipe(Schema.mutable);
const fields = {
  phase: Schema.Literals(stages), action: Schema.Literals(['entering', 'ready', 'dragging', 'working']), elapsed: between(0, 10),
  colors: Schema.Tuple([integer(PALETTE.length - 1), integer(PALETTE.length - 1)]).pipe(Schema.mutable), cones: flagPair, towed: flagPair,
  selected: Schema.NullOr(Schema.Literals([0, 1])), cleaned: integer(DEBRIS.length), truckX: between(-11, 11),
  handle: Schema.Struct({ x: between(-11, 11), y: between(0, 2), z: between(-6.5, 6.5) }),
};
const current = Schema.Struct({ ...fields, version: Schema.Literal(3), towTypes, firstTow: Schema.Literals([0, 1]) });
export const decodeTrafficSnapshot = createSnapshotDecoder<TrafficState>(current, resumeTraffic);
