export function drawMap(canvas, player, world, found, full = false, yaw = 0) {
  const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  c.clearRect(0, 0, w, h); c.fillStyle = '#1b3b38'; c.fillRect(0, 0, w, h);
  const scale = full ? Math.min(w / 105, h / 190) : 5.2;
  const centerX = full ? 0 : player.x, centerZ = full ? -5 : player.z;
  const project = (x, z) => [w / 2 + (x - centerX) * scale, h / 2 + (z - centerZ) * scale];
  const rect = (x, z, ww, dd, color) => {
    const [px, py] = project(x, z); c.fillStyle = color; c.fillRect(px - ww * scale / 2, py - dd * scale / 2, ww * scale, dd * scale);
  };
  rect(57, -4, 135, 210, '#65776a');
  rect(.5, -4, 20, 198, '#b6b79b');
  rect(26, -39, 33, 20, '#b6b79b');
  rect(-24, -70, 29, 9, '#b6b79b');
  rect(-22, 5.5, 24, 4.3, '#a4a18a');
  for (const b of world.buildings) rect(b.x, b.z, b.w, b.d, '#394d42');
  for (const z of [43, 8, -30, -60]) {
    const [x, y] = project(-6.4, z); c.beginPath(); c.arc(x, y, 1.6 * scale, 0, Math.PI * 2); c.fillStyle = '#506b50'; c.fill();
  }
  c.strokeStyle = 'rgba(211,229,220,.08)'; c.lineWidth = 1;
  for (let y = 0; y < h; y += 24) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  for (const spot of world.landmarks) {
    const [x, y] = project(spot.x, spot.z);
    c.beginPath(); c.arc(x, y, full ? 7 : 6, 0, Math.PI * 2);
    c.fillStyle = found.has(spot.id) ? '#ead9a5' : '#18332e'; c.fill();
    c.strokeStyle = '#ead9a5'; c.lineWidth = 2; c.stroke();
    if (full) {
      c.font = '17px sans-serif'; c.textAlign = 'left'; c.fillStyle = '#f5f1e7';
      c.fillText(spot.name, x + 13, y + (spot.id === 'fountain' ? 20 : 5));
    }
  }
  const [px, py] = project(player.x, player.z);
  c.save(); c.translate(px, py); c.rotate(-yaw);
  c.fillStyle = '#f9f5e6'; c.shadowBlur = 9; c.shadowColor = '#152e29';
  c.beginPath(); c.moveTo(0, -10); c.lineTo(-6, 7); c.lineTo(0, 3); c.lineTo(6, 7); c.closePath(); c.fill(); c.restore();
  if (full) {
    c.fillStyle = '#c1cec2'; c.font = '15px Georgia'; c.textAlign = 'center';
    c.save(); c.translate(w * .15, h * .69); c.rotate(-Math.PI / 2); c.fillText('M A R   L I G U R E', 0, 0); c.restore();
    c.font = '13px sans-serif'; c.fillText('N ↑', w - 35, 35);
  }
}
