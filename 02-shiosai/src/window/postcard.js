export const defaultLine = "오래 기억하고 싶은 저녁.";
export function dateLabel(date = new Date()) {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}
export function download(blob, name) {
  const url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function remember(line) {
  try {
    localStorage.setItem("shiosai:memory", line.slice(0, 44));
    return true;
  } catch {
    return false;
  }
}
export function recalled() {
  try {
    return localStorage.getItem("shiosai:memory") || "";
  } catch {
    return "";
  }
}
export async function createPostcard(source, line, date, night) {
  const image = new Image();
  image.src = source;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 1800;
  canvas.height = 1440;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f3efe4";
  ctx.fillRect(0, 0, 1800, 1440);
  // The complete portrait or landscape view is preserved, never crop out the train.
  const area = { x: 64, y: 64, w: 1672, h: 1080 };
  ctx.fillStyle = "#101b20";
  ctx.fillRect(area.x, area.y, area.w, area.h);
  const scale = Math.min(area.w / image.width, area.h / image.height);
  const w = image.width * scale,
    h = image.height * scale;
  ctx.drawImage(
    image,
    area.x + (area.w - w) / 2,
    area.y + (area.h - h) / 2,
    w,
    h,
  );
  ctx.fillStyle = "#253436";
  ctx.font = '52px "Hiragino Mincho ProN", "Yu Mincho", serif';
  ctx.fillText("潮騒", 72, 1228);
  ctx.font = "18px sans-serif";
  ctx.fillStyle = "#53605e";
  ctx.fillText("S H I O S A I", 208, 1224);
  ctx.textAlign = "right";
  ctx.font = "23px Georgia, serif";
  ctx.fillText(`${date}  /  ${night ? "19:08" : "17:42"}`, 1728, 1224);
  ctx.textAlign = "left";
  ctx.fillStyle = "#253436";
  ctx.font = '32px "Apple SD Gothic Neo", sans-serif';
  const text = (line.trim() || defaultLine).slice(0, 44);
  let row = "",
    y = 1320;
  for (const char of text) {
    if (ctx.measureText(row + char).width > 1640) {
      ctx.fillText(row, 72, y);
      row = char;
      y += 48;
    } else row += char;
  }
  ctx.fillText(row, 72, y);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("엽서를 만들지 못했어요.")),
      "image/png",
    ),
  );
}
