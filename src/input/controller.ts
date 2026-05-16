import { createGyroInput } from "./gyro";
import { createKeyboardInput } from "./keyboard";
import { createTouchInput } from "./touch";

export type InputController = {
  readonly getSteer: () => number;
  readonly dispose: () => void;
};

export const createInputController = (
  canvas: HTMLElement,
  gyroButton: HTMLButtonElement,
  gyroStatus: HTMLElement,
): InputController => {
  const keyboard = createKeyboardInput();
  const touch = createTouchInput(canvas);
  const gyro = createGyroInput(gyroStatus);
  const requestGyro = (): void => {
    void gyro.request();
  };

  gyroButton.addEventListener("click", requestGyro);

  return {
    getSteer: () => {
      const keyboardSteer = keyboard.getSteer();
      if (keyboardSteer !== 0) {
        return keyboardSteer;
      }

      const touchSteer = touch.getSteer();
      return touchSteer !== 0 ? touchSteer : gyro.getSteer();
    },
    dispose: () => {
      keyboard.dispose();
      touch.dispose();
      gyro.dispose();
      gyroButton.removeEventListener("click", requestGyro);
    },
  };
};
