export type TouchInput = {
  readonly getSteer: () => number;
  readonly dispose: () => void;
};

export const createTouchInput = (target: HTMLElement): TouchInput => {
  let steer = 0;

  const setSteerFromPointer = (event: PointerEvent): void => {
    const bounds = target.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    steer = x < bounds.width / 2 ? -1 : 1;
  };

  const clearSteer = (): void => {
    steer = 0;
  };

  target.addEventListener("pointerdown", setSteerFromPointer);
  target.addEventListener("pointermove", setSteerFromPointer);
  target.addEventListener("pointerup", clearSteer);
  target.addEventListener("pointercancel", clearSteer);
  target.addEventListener("pointerleave", clearSteer);

  return {
    getSteer: () => steer,
    dispose: () => {
      target.removeEventListener("pointerdown", setSteerFromPointer);
      target.removeEventListener("pointermove", setSteerFromPointer);
      target.removeEventListener("pointerup", clearSteer);
      target.removeEventListener("pointercancel", clearSteer);
      target.removeEventListener("pointerleave", clearSteer);
    },
  };
};
