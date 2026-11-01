import { Schema } from 'effect';
import { between, createSnapshotDecoder, fraction, integer, nonnegative } from '../../runtime/snapshot.ts';
import { resumeRail, stages, trains, directions, type RailState } from './domain/rail.ts';
const current = Schema.Struct({
  version: Schema.Literal(1), phase: Schema.Literals(stages),
  round: Schema.Struct({ direction: Schema.Literals(directions), layout: Schema.Literals([0, 1]), palette: integer(3), cast: integer(2) }),
  order: Schema.Array(Schema.Literals(trains)).pipe(Schema.mutable), selected: Schema.NullOr(Schema.Literals(trains)),
  action: Schema.Literals(['ready', 'dragging', 'auto']), travel: fraction, door: fraction, aim: fraction, elapsed: nonnegative, dwell: between(0, 0.4), moved: Schema.Boolean,
});
export const decodeRailSnapshot = createSnapshotDecoder<RailState>(current, resumeRail);
