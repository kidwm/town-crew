import { Schema } from 'effect';
import { between, createSnapshotDecoder, fraction, integer } from '../../runtime/snapshot.ts';
import { resumePolice, stages, PALETTE, BAG_COLORS } from './domain/police.ts';
import type { PoliceState } from './domain/police.ts';

const state = Schema.Struct({
  version: Schema.Literal(1), phase: Schema.Literals(stages), action: Schema.Literals(['ready', 'dragging', 'working']),
  round: Schema.Struct({ layout: integer(3), color: integer(PALETTE.length - 1), body: Schema.Literals(['car', 'van']), bag: integer(BAG_COLORS.length - 1) }),
  elapsed: between(0, 7), active: Schema.NullOr(Schema.Literals(['police', 'bike0', 'bike1', 'van'])), aim: fraction,
  work: Schema.Struct({ follow: fraction, bike0: fraction, bike1: fraction, yield: fraction, arrive: fraction, door: fraction, lead: fraction, escort: fraction }),
  order: Schema.Array(Schema.Literals(['bike0', 'bike1'])).pipe(Schema.mutable),
});
export const decodePoliceSnapshot = createSnapshotDecoder<PoliceState>(state, resumePolice);
