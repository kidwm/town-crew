import { Schema } from 'effect';
import { between, createSnapshotDecoder, fraction, integer, point3 } from '../../runtime/snapshot.ts';
import { resumeFire, stages, DRIVE_START, STREET_STOP } from './domain/fire.ts';
import type { FireState } from './domain/fire.ts';

const state = Schema.Struct({
  version: Schema.Literal(1), phase: Schema.Literals(stages), action: Schema.Literals(['entering', 'ready', 'dragging', 'working', 'returning', 'unloading']),
  elapsed: between(0, 1e7), truckX: between(DRIVE_START, STREET_STOP),
  hose: point3, basket: point3, stretcher: point3, from: point3, aim: point3,
  fires: Schema.Tuple([fraction, fraction, fraction, fraction]).pipe(Schema.mutable), wet: Schema.NullOr(integer(3)),
  rescued: Schema.Tuple([Schema.Boolean, Schema.Boolean]).pipe(Schema.mutable), passenger: Schema.NullOr(Schema.Literals(['resident', 'cat'])),
});
export const decodeFireSnapshot = createSnapshotDecoder<FireState>(state, resumeFire);
