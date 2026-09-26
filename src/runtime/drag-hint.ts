interface Point { x: number; y: number }
export interface DragHint {
  from: Point; to: Point; via?: Point[]; direction: 'up' | 'left' | 'right'; label: string;
}

/** One gesture demonstration for lifting a bed or driving any vehicle. */
export function createDragHint(host: HTMLElement) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('drag-hint');
  svg.setAttribute('role', 'img');
  svg.style.display = 'none';
  svg.innerHTML = `<path class="drag-hint-line"/><path class="drag-hint-arrow"/><circle class="drag-hint-origin" r="9"/><g class="drag-hint-hand"><circle class="drag-hint-touch" r="16"/><path d="M-5 22V5C-5-2 5-2 5 5v14-5c0-6 9-6 9 0v6-3c0-6 9-6 9 0v5-2c0-6 9-6 9 0v14c0 11-6 17-16 17H9c-6 0-10-3-13-8l-11-16c-4-6 3-11 7-6l6 7"/></g>`;
  host.append(svg);
  const line = svg.querySelector('.drag-hint-line')!, arrow = svg.querySelector('.drag-hint-arrow')!;
  const origin = svg.querySelector('.drag-hint-origin')!, hand = svg.querySelector('.drag-hint-hand')!;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let started = 0, previousKey = '';
  return {
    update(hint: DragHint | undefined, time: number) {
      svg.style.display = hint ? '' : 'none';
      if (!hint) { previousKey = ''; return; }
      const { from, to, direction, label } = hint;
      const path = [from, ...(hint.via ?? []), to];
      const key = `${direction}:${path.map(p => `${p.x},${p.y}`).join(':')}`;
      if (key !== previousKey) { started = time; previousKey = key; }
      svg.dataset.direction = direction;
      svg.setAttribute('aria-label', label);
      line.setAttribute('d', path.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' '));
      origin.setAttribute('cx', String(from.x)); origin.setAttribute('cy', String(from.y));
      const last = path[path.length - 2];
      const angle = Math.atan2(to.y - last.y, to.x - last.x);
      // A stationary hand demonstrates pressing to spray; it has no arrow.
      arrow.setAttribute('visibility', Math.hypot(to.x - from.x, to.y - from.y) < 1 ? 'hidden' : 'visible');
      arrow.setAttribute('d', `M-12 -9L0 0L-12 9`);
      arrow.setAttribute('transform', `translate(${to.x} ${to.y}) rotate(${angle * 180 / Math.PI})`);
      const duration = hint.via?.length ? 2.5 : 1.25, cycleLength = duration + 1.15;
      const cycle = (time - started) % cycleLength;
      const progress = reducedMotion.matches ? 0 : Math.max(0, Math.min(1, (cycle - 0.35) / duration));
      const eased = progress * progress * (3 - 2 * progress);
      const lengths = path.slice(1).map((p, i) => Math.hypot(p.x - path[i].x, p.y - path[i].y));
      let remaining = lengths.reduce((a, b) => a + b, 0) * eased, position = to;
      for (let i = 0; i < lengths.length; i++) {
        if (remaining <= lengths[i]) { const t = lengths[i] ? remaining / lengths[i] : 0; position = { x: path[i].x + (path[i + 1].x - path[i].x) * t, y: path[i].y + (path[i + 1].y - path[i].y) * t }; break; }
        remaining -= lengths[i];
      }
      hand.setAttribute('transform', `translate(${position.x} ${position.y})`);
      hand.setAttribute('opacity', String(reducedMotion.matches ? 1 : Math.max(0, Math.min(1, (cycleLength - 0.25 - cycle) / 0.25))));
    },
    dispose() { svg.remove(); },
  };
}
