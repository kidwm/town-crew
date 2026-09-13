import { expect } from '@playwright/test';

// Follow the on-screen demonstration itself, so a misplaced hint cannot pass
// merely because the test independently knows the game's world coordinates.
export async function gesture(page, direction) {
  const hint = page.locator('.drag-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toHaveAttribute('data-direction', direction);
  return hint.locator('.drag-hint-line').evaluate(path => {
    const rect = path.ownerSVGElement.getBoundingClientRect();
    const point = distance => {
      const p = path.getPointAtLength(distance);
      return { x: rect.x + p.x, y: rect.y + p.y };
    };
    return { from: point(0), to: point(path.getTotalLength()) };
  });
}
