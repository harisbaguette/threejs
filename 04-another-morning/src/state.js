export const SAVE_KEY = 'another-morning-v1';
export const EXPERIENCES = [
  { id: 'mirror', title: '거울 속의 나', hint: '전신 거울 앞에 서기' },
  { id: 'outfit', title: '오늘의 색', hint: '옷장에서 옷 색상 고르기' },
  { id: 'coffee', title: '취향을 알아가는 시간', hint: '주방에서 커피 만들기' },
  { id: 'phone', title: '서연의 약속', hint: '책상에서 메시지 읽기' },
  { id: 'window', title: '나의 새로운 아침', hint: '창가에서 도시 바라보기' },
  { id: 'outing', title: '그녀의 걸음으로', hint: '현관에서 거리로 나가기' },
  { id: 'boutique', title: '오늘의 스타일', hint: '거리의 온도 편집숍 방문하기' },
  { id: 'order', title: '나를 부르는 이름', hint: '모닝 커피에 들어가 주문하기' },
  { id: 'friend', title: '서연으로 만나는 사람', hint: '거리 끝에서 지민 만나기' },
];
export function initialState() {
  return { character: 'male', completed: [], outfit: 'cream', view: 'third', reply: null, zone: 'home', drink: null };
}
export function restoreState(raw) {
  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return {
      character: data.character === 'female' ? 'female' : 'male',
      completed: [...new Set((Array.isArray(data.completed) ? data.completed : []).filter(id => EXPERIENCES.some(e => e.id === id)))],
      outfit: data.outfit === 'wine' ? 'wine' : 'cream',
      view: data.view === 'first' ? 'first' : 'third',
      reply: ['walk', 'cafe'].includes(data.reply) ? data.reply : null,
      zone: ['home','street','cafe'].includes(data.zone) ? data.zone : 'home',
      drink: ['latte','americano'].includes(data.drink) ? data.drink : null,
    };
  } catch { return null; }
}
export function complete(state, id) {
  if (state.character !== 'female' || !EXPERIENCES.some(e => e.id === id) || state.completed.includes(id)) return false;
  state.completed.push(id);
  return true;
}
export function nextObjective(state) {
  if (state.character === 'male') return '서연에게 다가가 빙의하기';
  return EXPERIENCES.find(e => !state.completed.includes(e.id))?.hint ?? '모든 순간을 경험했어요. 자유롭게 둘러보세요.';
}
export function moveWithCollision(position, dx, dz, obstacles, radius = .25, bounds = { minX:-5.65, maxX:5.65, minZ:-4.62, maxZ:4.62 }) {
  const result = { x: position.x, z: position.z };
  const blocked = (x, z) => obstacles.some(o => x > o.x - o.w / 2 - radius && x < o.x + o.w / 2 + radius && z > o.z - o.d / 2 - radius && z < o.z + o.d / 2 + radius);
  // Substeps keep sprinting through thin furniture impossible after a slow frame.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .1));
  for (let i = 0; i < steps; i++) {
    const x = Math.max(bounds.minX, Math.min(bounds.maxX, result.x + dx / steps));
    if (!blocked(x, result.z)) result.x = x;
    const z = Math.max(bounds.minZ, Math.min(bounds.maxZ, result.z + dz / steps));
    if (!blocked(result.x, z)) result.z = z;
  }
  return result;
}
