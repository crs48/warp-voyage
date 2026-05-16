import { createGyroInput } from "./gyro";
import { createKeyboardInput } from "./keyboard";

export type InputController = {
  readonly getSteer: () => number;
  readonly dispose: () => void;
};

export const createInputController = (
  gyroButton: HTMLButtonElement,
  gyroStatus: HTMLElement,
): InputController => {
  const keyboard = createKeyboardInput();
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

      return gyro.getSteer();
    },
    dispose: () => {
      keyboard.dispose();
      gyro.dispose();
      gyroButton.removeEventListener("click", requestGyro);
    },
  };
};
