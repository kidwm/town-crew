import { Schema } from 'effect';
import { between, createSnapshotDecoder, fraction, integer, nonnegative } from '../../runtime/snapshot.ts';
import { resumeTransit, stages } from './domain/transit.ts';
import type { TransitState } from './domain/transit.ts';

const transfer = Schema.Literals(['taxi', 'school', 'coach']);
const companion = Schema.Literals(['school', 'coach']);
const roundFields = { layout: Schema.Literals([0, 1]), palette: integer(3), cast: integer(2) };
const fields = {
  phase: Schema.Literals(stages), action: Schema.Literals(['ready', 'dragging', 'auto']),
  selected: Schema.NullOr(transfer), order: Schema.Array(transfer).pipe(Schema.mutable), travel: fraction, aim: fraction,
  doors: Schema.Struct({ bus: fraction, taxi: fraction, school: fraction, coach: fraction }),
  luggage: Schema.Struct({ x: between(-13, 13), y: between(0.16, 2), z: between(1.2, 8) }), elapsed: nonnegative,
};
const current = Schema.Struct({ ...fields, version: Schema.Literal(4), round: Schema.Struct({ ...roundFields, companion }) });
export const decodeTransitSnapshot = createSnapshotDecoder<TransitState>(current, resumeTransit);
