import { Schema } from 'effect';
import { between, createSnapshotDecoder, fraction, integer, point2 } from '../../runtime/snapshot.ts';
import { resumeHouse, stages, DELIVERY_START, DELIVERY_STOP } from './domain/house.ts';
import type { HouseState } from './domain/house.ts';
import { ROOF_TYPES, HOUSE_PALETTES } from './domain/round.ts';

const round = Schema.Struct({ roof: Schema.Literals(ROOF_TYPES), layout: Schema.Literals([0, 1]), palette: integer(HOUSE_PALETTES.length - 1), family: Schema.Literals([0, 1, 2]), pet: Schema.Literals(['none', 'cat', 'dog']) });
const fields = {
  phase: Schema.Literals(stages), action: Schema.Literals(['entering', 'ready', 'dragging', 'working', 'leaving', 'finishing', 'pickup', 'placing', 'resetting', 'unhooking']),
  elapsed: between(0, 1e7), gravel: fraction, pours: Schema.Tuple([fraction, fraction, fraction]).pipe(Schema.mutable),
  chute: point2, placed: integer(6), truckX: between(DELIVERY_START, DELIVERY_STOP), dragPx: between(0, 60), load: point2, from: point2, color: integer(2),
};
const current = Schema.Struct({ ...fields, version: Schema.Literal(6), round, attached: Schema.Boolean });
export const decodeHouseSnapshot = createSnapshotDecoder<HouseState>(current, resumeHouse);
