// Install page.clock before navigation. Native pointer commands may take longer
// than the 400 ms dwell on software-rendered CI; elapsed test-runner time must
// not turn a brief pass/cancellation into a successful hold.
export async function withPausedClock(page, action) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 60_000);
  try { await action(); } finally { await page.clock.resume(); }
}
