export const TRACK = { carSpacing: 6.55 };

export function wrap(value, length = 1) {
  return ((value % length) + length) % length;
}

export function advanceDistance(distance, delta, speed, running, length) {
  return running ? wrap(distance + Math.max(0, delta) * speed * 4.8, length) : distance;
}

export function carriageDistance(distance, index, length) {
  return wrap(distance - index * TRACK.carSpacing, length);
}

export function seededRandom(seed = 24) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
