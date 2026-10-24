import { Result, Schema } from 'effect';
import { reportStorageFailure, SnapshotDecodeError } from './storage.ts';

export const finite = Schema.Number.check(Schema.isFinite());
export const between = (minimum: number, maximum: number) => finite.check(Schema.isBetween({ minimum, maximum }));
export const integer = (maximum: number) => between(0, maximum).check(Schema.isInt());
export const fraction = between(0, 1);
export const nonnegative = finite.check(Schema.isGreaterThanOrEqualTo(0));
export const coordinate = (limit: number) => finite.check(Schema.isBetween({ minimum: -limit, maximum: limit, exclusiveMinimum: true, exclusiveMaximum: true }));
export const point2 = Schema.Struct({ x: coordinate(30), z: coordinate(30) });
export const point3 = Schema.Struct({ x: coordinate(30), y: coordinate(30), z: coordinate(30) });
export type SnapshotDecoder<A> = (value: unknown, key: string) => Result.Result<A, SnapshotDecodeError>;

/** Validate current data, apply domain invariants/input cancellation, then strip unknown metadata. */
export function createSnapshotDecoder<A>(schema: Schema.ConstraintDecoder<A>, resume: (value: unknown) => A | undefined): SnapshotDecoder<A> {
  const decode = Schema.decodeUnknownResult(schema);
  return (value, key) => {
    const fail = (stage: SnapshotDecodeError['stage'], cause: unknown) => Result.fail(new SnapshotDecodeError({ key, stage, cause }));
    try {
      const checked = decode(value);
      if (Result.isFailure(checked)) return fail('schema', checked.failure);
      // Check original keys before stripping: domain invariants may require an exact key set.
      const resumed = resume(value);
      if (!resumed) return fail('invariant', new Error('Snapshot violates mission state or recovery rules'));
      const normalized = decode(resumed);
      return Result.isFailure(normalized) ? fail('resume', normalized.failure) : Result.succeed(normalized.success);
    } catch (cause) { return fail('resume', cause); }
  };
}

export function restoreSnapshot<A>(decode: SnapshotDecoder<A>, value: unknown, key: string): A | undefined {
  if (value == null) return;
  const result = decode(value, key);
  if (Result.isSuccess(result)) return result.success;
  reportStorageFailure(result.failure);
}
