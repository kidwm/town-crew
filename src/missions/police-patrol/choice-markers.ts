import type { Bike } from './domain/police.ts';
import type { policeChoiceMarker } from './view.ts';

export function createChoiceMarkers(host: HTMLElement) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('police-choices'); svg.style.display = 'none';
  svg.setAttribute('role', 'group'); svg.setAttribute('aria-label', '兩台重機任選一台，拖到出口警戒位');
  svg.innerHTML = (['bike0', 'bike1'] as const).map((id, n) => `<g data-bike="${id}" role="img" aria-label="可選：${n ? '二' : '一'}號重機"><ellipse class="police-choice-ring"/><path class="police-choice-arrow"/></g>`).join('');
  const nodes = (['bike0', 'bike1'] as const).map(id => {
    const node = svg.querySelector<SVGGElement>(`[data-bike="${id}"]`)!;
    return { id, node, ring: node.querySelector('ellipse')!, arrow: node.querySelector('path')! };
  });
  host.append(svg);
  return {
    update(markers: (ReturnType<typeof policeChoiceMarker> & { id: Bike })[], reduced: boolean) {
      svg.style.display = markers.length ? '' : 'none';
      for (const { id, node, ring, arrow } of nodes) {
        const p = markers.find(m => m.id === id); node.style.display = p ? '' : 'none'; if (!p) continue;
        for (const [name, value] of Object.entries({ cx: p.x, cy: p.y, rx: p.rx, ry: p.ry })) ring.setAttribute(name, String(value));
        node.dataset.gripX = String(p.grip.x); node.dataset.gripY = String(p.grip.y);
        arrow.setAttribute('d', p.arrow); arrow.style.display = reduced ? '' : 'none';
      }
    },
    dispose() { svg.remove(); },
  };
}
