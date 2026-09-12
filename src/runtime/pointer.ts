interface DragHandlers<T> {
  start(event: PointerEvent): T | undefined;
  move(event: PointerEvent, context: T): void;
  end(context: T, cancelled: boolean): void;
}

/** A single primary pointer owns a drag until release, cancellation or blur. */
export function bindPrimaryDrag<T>(canvas: HTMLCanvasElement, handlers: DragHandlers<T>, signal: AbortSignal) {
  const options = { signal };
  let active: { id: number; context: T } | undefined;
  function finish(cancelled: boolean) {
    if (!active) return;
    const { id, context } = active;
    active = undefined;
    handlers.end(context, cancelled);
    if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }
  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || active) return;
    const context = handlers.start(event);
    if (context === undefined) return;
    event.preventDefault();
    active = { id: event.pointerId, context };
    canvas.setPointerCapture(event.pointerId);
  }, options);
  canvas.addEventListener('pointermove', event => {
    if (active?.id === event.pointerId) handlers.move(event, active.context);
  }, options);
  canvas.addEventListener('pointerup', event => {
    if (active?.id === event.pointerId) finish(false);
  }, options);
  for (const type of ['pointercancel', 'lostpointercapture'] as const) {
    canvas.addEventListener(type, event => { if (active?.id === event.pointerId) finish(true); }, options);
  }
  const cancel = () => finish(true);
  window.addEventListener('blur', cancel, options);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); }, options);
  signal.addEventListener('abort', cancel, { once: true });
  return { cancel, context: () => active?.context };
}
