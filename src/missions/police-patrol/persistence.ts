import { Schema } from 'effect';
import { between, createSnapshotDecoder, fraction, integer } from '../../runtime/snapshot.ts';
import { resumePolice, stages, PALETTE } from './domain/police.ts';
import type { PoliceState } from './domain/police.ts';
const state = Schema.Struct({
  version: Schema.Literal(3), phase: Schema.Literals(stages), action: Schema.Literals(['ready', 'dragging', 'working']),
  round: Schema.Struct({ layout: integer(1), color: integer(PALETTE.length - 1), traffic: Schema.Literals(['taxi-first', 'freight-first']) }),
  elapsed: between(0, 9.5), active: Schema.NullOr(Schema.Literals(['police', 'bike0', 'bike1', 'van', 'tow'])), aim: fraction,
  work: Schema.Struct({ setup: fraction, guard: fraction, arrive: fraction, door: fraction, escort: fraction, recover: fraction }),
  checked: integer(2),
  selected: Schema.NullOr(Schema.Literals(['bike0', 'bike1'])),
});
export const decodePoliceSnapshot = createSnapshotDecoder<PoliceState>(state, resumePolice);
