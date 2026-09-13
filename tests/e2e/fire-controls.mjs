import * as THREE from 'three';
import { gesture } from './gesture.mjs';

export async function fireControls(page, touch = false) {
  const cdp = await page.context().newCDPSession(page);
  const down = async p => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] }) : (await page.mouse.move(p.x, p.y), page.mouse.down());
  const move = async p => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] }) : page.mouse.move(p.x, p.y, { steps: 5 });
  const up = async () => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) : page.mouse.up();
  const cancel = async () => { if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); else { await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.mouse.up(); } };
  const wait = (phase, action = 'ready') => page.locator(`#app[data-phase="${phase}"][data-action="${action}"]`).waitFor();
  async function project(p) {
    const rect = await page.locator('canvas').boundingBox(), aspect = rect.width / rect.height, height = Math.max(15, 25 / aspect);
    const camera = new THREE.OrthographicCamera(-height * aspect / 2, height * aspect / 2, height / 2, -height / 2, 0.1, 300);
    camera.position.set(32, 34, 70.5); camera.lookAt(0, 2, 0.5); camera.updateMatrixWorld(true);
    const point = new THREE.Vector3(p.x, p.y, p.z).project(camera);
    return { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1 - point.y) * rect.height / 2 };
  }
  async function target(id) {
    const box = await page.locator(`.fire-target[data-goal="${id}"]`).boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }
  async function dragGoal(id, direction = 'up') {
    const hint = await gesture(page, direction), to = await target(id);
    await down(hint.from); await move(to);
  }
  return { down, move, up, cancel, wait, project, target, dragGoal };
}
