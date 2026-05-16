export type KeyboardInput = {
  readonly getSteer: () => number;
  readonly dispose: () => void;
};

export const createKeyboardInput = (target: Window = window): KeyboardInput => {
  const pressed = new Set<string>();
  const down = (event: KeyboardEvent): void => {
    if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(event.code)) {
      event.preventDefault();
      pressed.add(event.code);
    }
  };
  const up = (event: KeyboardEvent): void => {
    pressed.delete(event.code);
  };

  target.addEventListener("keydown", down);
  target.addEventListener("keyup", up);

  return {
    getSteer: () => {
      const left = pressed.has("ArrowLeft") || pressed.has("KeyA");
      const right = pressed.has("ArrowRight") || pressed.has("KeyD");
      return (left ? 1 : 0) - (right ? 1 : 0);
    },
    dispose: () => {
      target.removeEventListener("keydown", down);
      target.removeEventListener("keyup", up);
    },
  };
};
