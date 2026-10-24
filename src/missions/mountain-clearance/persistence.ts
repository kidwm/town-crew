import { Schema } from 'effect';
import { between, coordinate, createSnapshotDecoder, fraction, integer, nonnegative } from '../../runtime/snapshot.ts';
import { resumeMountain, stages } from './domain/mountain.ts';
import type { MountainState } from './domain/mountain.ts';

const soil = Schema.Literals([0, 1]), rock = integer(2);
const point = Schema.Struct({ x: coordinate(40), y: coordinate(40), z: coordinate(40) });
const fields = {
  round: Schema.Struct({ pattern: Schema.Literals(['spread', 'cluster']), layout: soil }), phase: Schema.Literals(stages), action: Schema.Literals(['ready', 'dragging', 'auto']),
  motion: Schema.Literals(['none', 'lift', 'unload', 'return', 'push-return', 'drive-finish', 'loader-finish', 'loader-scoop', 'loader-park', 'loader-tip', 'loader-return']),
  elapsed: between(0, 30), pushes: Schema.Tuple([fraction, fraction]).pipe(Schema.mutable), pushIndex: soil, haul: fraction, swept: fraction,
  delivered: Schema.Array(rock).pipe(Schema.mutable), carried: Schema.NullOr(rock), bucket: point, from: point, target: point,
};
const loader = { soilLoaded: Schema.Array(soil).pipe(Schema.mutable), loaderSelected: Schema.NullOr(soil), loaderCarrying: Schema.Boolean, loaderTravel: fraction };
const current = Schema.Struct({ ...fields, ...loader, version: Schema.Literal(3), workOrder: Schema.Literals(['rocks-first', 'soil-first']), loaderDocked: Schema.Boolean,
  desired: fraction, aimed: Schema.NullOr(rock), dwell: nonnegative,
});
export const decodeMountainSnapshot = createSnapshotDecoder<MountainState>(current, resumeMountain);
