export const presets = {
  platform: { position: [-3.9, 2.5, 24], target: [0.5, 2.16, -13], fov: 45 },
  coast: { position: [10, 3.8, 29], target: [-2, 2.3, -13], fov: 46 },
  close: { position: [-4.4, 2.45, 13], target: [0, 2.45, 1], fov: 47 },
};

export const mobilePresets = {
  platform: { position: [-4.8, 2.5, 26], target: [2.8, 2.2, -10] },
  coast: { position: [9.5, 4.3, 34], target: [-2, 2, -9] },
  close: { position: [-5, 2.4, 15], target: [0.4, 2.3, 3] },
};

export function constrainCamera(position, previousY, trainZ) {
  position.x = Math.max(-11, Math.min(22, position.x));
  position.z = Math.max(-55, Math.min(58, position.z));
  position.y = Math.max(1.2, Math.min(11, position.y));
  const underRoof =
    position.x > -9.6 &&
    position.x < -2.3 &&
    position.z > -34.4 &&
    position.z < 24.5;
  if (underRoof && position.y > 4 && position.y < 5.05)
    position.y = previousY < 4.5 ? 4 : 5.05;
  const alongsideTrain =
    position.z > trainZ - 27.2 && position.z < trainZ + 9.4;
  if (alongsideTrain && position.y < 4.5 && Math.abs(position.x) < 1.8)
    position.x = position.x < 0 ? -1.8 : 1.8;
  return position;
}

export function cameraPreset(name, width) {
  return width < 700 ? { ...mobilePresets[name], fov: 58 } : presets[name];
}
