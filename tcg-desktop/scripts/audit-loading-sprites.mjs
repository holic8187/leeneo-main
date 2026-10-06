import { readFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LOADING_CHARACTERS } from '../src/data/loadingCharacters.js';

const paeth = (a, b, c) => {
  const p = a + b - c;
  const da = Math.abs(p - a); const db = Math.abs(p - b); const dc = Math.abs(p - c);
  return da <= db && da <= dc ? a : db <= dc ? b : c;
};

/** Read-only inspector for the generated, non-interlaced 8-bit RGBA sheets. */
export function inspectLoadingSprite(filename) {
  const png = readFileSync(filename);
  if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Not a PNG');
  const width = png.readUInt32BE(16); const height = png.readUInt32BE(20);
  if (png[24] !== 8 || png[25] !== 6 || png[28] !== 0) throw new Error('Expected non-interlaced 8-bit RGBA');
  if (width !== height || width % 2 || width < 512 || width > 4096) throw new Error('Expected an even square 2x2 sheet');
  const chunks = [];
  for (let offset = 8; offset + 12 <= png.length;) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    if (offset + 12 + length > png.length) throw new Error('Truncated PNG chunk');
    if (type === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
    if (type === 'IEND') break;
  }
  const stride = width * 4;
  const raw = inflateSync(Buffer.concat(chunks), { maxOutputLength: (stride + 1) * height });
  if (raw.length !== (stride + 1) * height) throw new Error('Unexpected PNG scanline size');
  const cells = Array.from({ length: 4 }, () => ({ bounds: [width / 2, height / 2, 0, 0], transparent: 0, opaque: 0, visible: 0 }));
  const frameHashes = Array.from({ length: 4 }, () => createHash('sha256'));
  let previous = Buffer.alloc(stride);
  let alphaMin = 255; let alphaMax = 0;
  for (let y = 0; y < height; y += 1) {
    const start = y * (stride + 1);
    const filter = raw[start];
    if (filter > 4) throw new Error('Invalid PNG filter');
    const row = Buffer.allocUnsafe(stride);
    for (let byte = 0; byte < stride; byte += 1) {
      const left = byte >= 4 ? row[byte - 4] : 0;
      const above = previous[byte]; const upperLeft = byte >= 4 ? previous[byte - 4] : 0;
      const predictor = filter === 1 ? left : filter === 2 ? above : filter === 3 ? Math.floor((left + above) / 2) : filter === 4 ? paeth(left, above, upperLeft) : 0;
      row[byte] = (raw[start + 1 + byte] + predictor) & 255;
    }
    const gridRow = y >= height / 2 ? 1 : 0;
    frameHashes[gridRow * 2].update(row.subarray(0, stride / 2));
    frameHashes[gridRow * 2 + 1].update(row.subarray(stride / 2));
    for (let x = 0; x < width; x += 1) {
      const alpha = row[x * 4 + 3];
      alphaMin = Math.min(alphaMin, alpha); alphaMax = Math.max(alphaMax, alpha);
      const column = x >= width / 2 ? 1 : 0;
      const cell = cells[gridRow * 2 + column];
      if (alpha === 0) cell.transparent += 1;
      if (alpha === 255) cell.opaque += 1;
      if (alpha < 32) continue;
      cell.visible += 1;
      const localX = x - column * width / 2; const localY = y - gridRow * height / 2;
      cell.bounds[0] = Math.min(cell.bounds[0], localX); cell.bounds[1] = Math.min(cell.bounds[1], localY);
      cell.bounds[2] = Math.max(cell.bounds[2], localX + 1); cell.bounds[3] = Math.max(cell.bounds[3], localY + 1);
    }
    previous = row;
  }
  return { width, height, alphaMin, alphaMax, cells, frameHashes: frameHashes.map((hash) => hash.digest('hex')) };
}

export function auditLoadingSprites(directory = fileURLToPath(new URL('../public/assets/loading/', import.meta.url))) {
  const geometry = {}; const audits = {}; const missing = [];
  for (const character of LOADING_CHARACTERS) {
    const filename = resolve(directory, `${character.id}-walk.png`);
    if (!existsSync(filename)) { missing.push(character.id); continue; }
    const audit = inspectLoadingSprite(filename);
    audits[character.id] = audit;
    geometry[character.id] = { width: audit.width, height: audit.height, bounds: audit.cells.map((cell) => cell.bounds) };
  }
  return { geometry, audits, missing };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(auditLoadingSprites(), null, 2));
}
