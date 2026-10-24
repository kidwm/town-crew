/** Attempt every synchronous release, preserving all failures for diagnostics. */
export function releaseAll(releases: Iterable<() => void>) {
  const errors: unknown[] = [];
  for (const release of releases) {
    try { release(); } catch (error) { errors.push(error); }
  }
  if (errors.length) throw new AggregateError(errors, 'Resource cleanup failed');
}
