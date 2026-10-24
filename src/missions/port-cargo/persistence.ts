import { Schema } from 'effect';
import { between, createSnapshotDecoder, fraction, integer, nonnegative, point2 } from '../../runtime/snapshot.ts';
import { resumePort, stages } from './domain/port.ts';
import type { PortState } from './domain/port.ts';

const cargo = Schema.Literals([0, 1]);
const order = Schema.Array(cargo).pipe(Schema.mutable);
const roundFields = { layout: cargo, palette: integer(3) };
const round = Schema.Struct({ ...roundFields, direction: Schema.Literals(['unload', 'load']) });
const fields = {
  phase: Schema.Literals(stages), action: Schema.Literals(['ready', 'dragging', 'lowering', 'picking', 'loading', 'returning', 'auto', 'hoisting', 'unhooking']),
  boat: fraction, truck: fraction, haul: fraction, forkTravel: fraction, unloaded: order, loaded: order,
  selected: Schema.NullOr(cargo), carrying: Schema.Boolean, load: Schema.Struct({ x: between(-1.8, 4.3), z: between(-5.8, -1.35) }), lift: fraction, elapsed: nonnegative,
};
const current = Schema.Struct({ ...fields, version: Schema.Literal(3), round, craneAttached: Schema.Boolean,
  desired: Schema.NullOr(fraction), aim: Schema.NullOr(point2), moved: Schema.Boolean,
});
export const decodePortSnapshot = createSnapshotDecoder<PortState>(current, resumePort);
