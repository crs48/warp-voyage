export type GyroInput = {
  readonly request: () => Promise<void>;
  readonly getSteer: () => number;
  readonly dispose: () => void;
};

type OrientationPermissionTarget = {
  readonly requestPermission?: () => Promise<"granted" | "denied">;
};

const orientationConstructor = (): OrientationPermissionTarget | undefined => {
  const constructor =
    typeof DeviceOrientationEvent === "undefined"
      ? undefined
      : (DeviceOrientationEvent as unknown);

  return typeof constructor === "function"
    ? (constructor as OrientationPermissionTarget)
    : undefined;
};

export const createGyroInput = (
  status: HTMLElement,
  target: Window = window,
): GyroInput => {
  let neutralGamma = 0;
  let filteredGamma = 0;
  let enabled = false;

  const onOrientation = (event: DeviceOrientationEvent): void => {
    if (!enabled || event.gamma === null) {
      return;
    }

    filteredGamma += (event.gamma - neutralGamma - filteredGamma) * 0.12;
  };

  const enable = (): void => {
    enabled = true;
    neutralGamma = filteredGamma;
    status.textContent = "gyro";
    target.addEventListener("deviceorientation", onOrientation);
  };

  return {
    request: async () => {
      const constructor = orientationConstructor();

      if (constructor?.requestPermission === undefined) {
        enable();
        return;
      }

      const permission = await constructor.requestPermission();
      if (permission === "granted") {
        enable();
      } else {
        status.textContent = "gyro denied";
      }
    },
    getSteer: () =>
      enabled ? Math.max(-1, Math.min(1, filteredGamma / 18)) : 0,
    dispose: () => {
      target.removeEventListener("deviceorientation", onOrientation);
    },
  };
};
