import fs from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const iconDir = path.join(rootDir, "icons");

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);

  return Buffer.concat([length, name, data, crc]);
}

function interpolate(start, end, t) {
  return Math.round(start + (end - start) * t);
}

function setPixel(pixels, size, x, y, rgba) {
  if (x < 0 || y < 0 || x >= size || y >= size) {
    return;
  }

  const index = (y * size + x) * 4;
  pixels[index] = rgba[0];
  pixels[index + 1] = rgba[1];
  pixels[index + 2] = rgba[2];
  pixels[index + 3] = rgba[3];
}

function fillRoundedRect(pixels, size, rectX, rectY, width, height, radius, color) {
  const right = rectX + width;
  const bottom = rectY + height;
  const radiusSquared = radius * radius;

  for (let y = rectY; y < bottom; y += 1) {
    for (let x = rectX; x < right; x += 1) {
      let dx = 0;
      let dy = 0;

      if (x < rectX + radius) dx = rectX + radius - x;
      if (x >= right - radius) dx = x - (right - radius - 1);
      if (y < rectY + radius) dy = rectY + radius - y;
      if (y >= bottom - radius) dy = y - (bottom - radius - 1);

      if (dx * dx + dy * dy <= radiusSquared) {
        setPixel(pixels, size, x, y, color);
      }
    }
  }
}

function fillCircle(pixels, size, centerX, centerY, radius, color) {
  const rSquared = radius * radius;
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy <= rSquared) {
        setPixel(pixels, size, x, y, color);
      }
    }
  }
}

function fillLine(pixels, size, startX, startY, endX, endY, thickness, color) {
  const steps = Math.max(Math.abs(endX - startX), Math.abs(endY - startY));
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const x = Math.round(startX + (endX - startX) * t);
    const y = Math.round(startY + (endY - startY) * t);
    fillCircle(pixels, size, x, y, thickness, color);
  }
}

function buildPixels(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const topColor = [255, 225, 185, 255];
  const bottomColor = [207, 90, 47, 255];

  for (let y = 0; y < size; y += 1) {
    const t = y / Math.max(size - 1, 1);
    const rowColor = [
      interpolate(topColor[0], bottomColor[0], t),
      interpolate(topColor[1], bottomColor[1], t),
      interpolate(topColor[2], bottomColor[2], t),
      255,
    ];
    for (let x = 0; x < size; x += 1) {
      setPixel(pixels, size, x, y, rowColor);
    }
  }

  fillCircle(
    pixels,
    size,
    Math.round(size / 2),
    Math.round(size / 2),
    Math.round(size * 0.33),
    [255, 255, 255, 54],
  );

  const panelX = Math.round(size * 0.18);
  const panelY = Math.round(size * 0.18);
  const panelW = Math.round(size * 0.17);
  const panelH = Math.round(size * 0.6);
  const panelR = Math.round(size * 0.04);
  const light = [255, 248, 239, 255];
  const accent = [143, 52, 23, 235];

  fillRoundedRect(pixels, size, panelX, panelY, panelW, panelH, panelR, light);
  fillLine(
    pixels,
    size,
    Math.round(size * 0.36),
    Math.round(size * 0.5),
    Math.round(size * 0.67),
    Math.round(size * 0.18),
    Math.round(size * 0.04),
    light,
  );
  fillLine(
    pixels,
    size,
    Math.round(size * 0.36),
    Math.round(size * 0.5),
    Math.round(size * 0.69),
    Math.round(size * 0.8),
    Math.round(size * 0.04),
    light,
  );
  fillLine(
    pixels,
    size,
    Math.round(size * 0.28),
    Math.round(size * 0.7),
    Math.round(size * 0.74),
    Math.round(size * 0.7),
    Math.round(size * 0.022),
    accent,
  );

  return pixels;
}

function encodePng(size, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }

  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function writeIcon(size, fileName) {
  const pixels = buildPixels(size);
  const png = encodePng(size, pixels);
  await fs.writeFile(path.join(iconDir, fileName), png);
}

await writeIcon(192, "icon-192.png");
await writeIcon(512, "icon-512.png");
await writeIcon(180, "apple-touch-icon.png");

console.log("Icons generated in", iconDir);
