import { Schema } from 'effect';
import { between, createSnapshotDecoder, fraction, integer, nonnegative } from '../../runtime/snapshot.ts';
import { resumeSanitation, stages, items, recyclables } from './domain/sanitation.ts';
import type { SanitationState } from './domain/sanitation.ts';
const point = Schema.Struct({ x: between(-10, 10), y: between(0.35, 2.8), z: between(-3, 8) });
const current = Schema.Struct({
  version: Schema.Literal(2), phase: Schema.Literals(stages), round: Schema.Struct({ layout: Schema.Literals([0, 1]), palette: integer(3), cast: integer(2), service: Schema.Literals(['recycle-first', 'food-first']), cargo: Schema.Tuple([Schema.Literals(recyclables), Schema.Literals(recyclables)]).pipe(Schema.mutable) }),
  action: Schema.Literals(['ready', 'dragging', 'auto']), travel: fraction, aim: fraction, elapsed: nonnegative, dwell: between(0, 0.4), near: Schema.Boolean, moved: Schema.Boolean,
  held: Schema.NullOr(Schema.Literals(items)), positions: Schema.Struct({ 'bag-0': point, 'bag-1': point, bin: point, cardboard: point, bottles: point, cans: point, paper: point, food: point }),
  bags: Schema.Array(Schema.Literals(['bag-0', 'bag-1'])).pipe(Schema.mutable), recycled: Schema.Array(Schema.Literals(recyclables)).pipe(Schema.mutable), binEmpty: Schema.Boolean, foodEmpty: Schema.Boolean, swept: fraction,
});
export const decodeSanitationSnapshot = createSnapshotDecoder<SanitationState>(current, resumeSanitation);
