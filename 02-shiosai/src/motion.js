export const LOOP_DURATION = 92;

export function journeyAt(time) {
  const t = ((time % LOOP_DURATION) + LOOP_DURATION) % LOOP_DURATION;
  if (t < 9) return { z: -3, speed: 0, status: "잠시 정차 중" };
  if (t < 21) {
    const d = t - 9;
    return {
      z: -3 + d * d * 0.1875,
      speed: d * 0.375,
      status: "바다를 따라 출발",
    };
  }
  if (t < 52)
    return { z: 24 + (t - 21) * 4.5, speed: 4.5, status: "해안선을 달리는 중" };
  if (t < 78)
    return {
      z: -191.1 + (t - 52) * 5.7,
      speed: 5.7,
      status: "곧 열차가 도착합니다",
    };
  const d = Math.min(t - 78, 14);
  return {
    z: -42.9 + 5.7 * d - (5.7 / 28) * d * d,
    speed: Math.max(0, 5.7 - (5.7 / 14) * d),
    status: "시오사이 역에 도착",
  };
}

export function advanceTime(time, delta, running) {
  return running ? time + Math.max(0, Math.min(delta, 0.1)) : time;
}
