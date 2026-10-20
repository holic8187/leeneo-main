import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { LOADING_CHARACTERS } from '../src/data/loadingCharacters.js';

/** Decode shipped pixels and alpha rather than trusting a cached audit manifest. */
export async function inspectLoadingSprite(filename) {
  const metadata = await sharp(filename).metadata();
  if (!['png', 'webp'].includes(metadata.format)) throw new Error('Expected a PNG or WebP sprite');
  const { data, info: { width, height, channels } } = await sharp(filename).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (channels !== 4) throw new Error('Expected four decoded RGBA channels');
  if (width !== height || width % 2 || width < 512 || width > 4096) throw new Error('Expected an even square 2x2 sheet');
  const stride = width * 4;
  const cells = Array.from({ length: 4 }, () => ({ bounds: [width / 2, height / 2, 0, 0], transparent: 0, opaque: 0, visible: 0 }));
  const frameHashes = Array.from({ length: 4 }, () => createHash('sha256'));
  let alphaMin = 255; let alphaMax = 0;
  for (let y = 0; y < height; y += 1) {
    const row = data.subarray(y * stride, (y + 1) * stride);
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
  }
  return { format: metadata.format, width, height, alphaMin, alphaMax, cells, frameHashes: frameHashes.map((hash) => hash.digest('hex')) };
}

export async function auditLoadingSprites(directory = fileURLToPath(new URL('../public/assets/loading/', import.meta.url))) {
  const geometry = {}; const audits = {}; const missing = [];
  for (const character of LOADING_CHARACTERS) {
    const filename = resolve(directory, basename(character.sprite));
    if (!existsSync(filename)) { missing.push(character.id); continue; }
    const audit = await inspectLoadingSprite(filename);
    audits[character.id] = audit;
    geometry[character.id] = { width: audit.width, height: audit.height, bounds: audit.cells.map((cell) => cell.bounds) };
  }
  return { geometry, audits, missing };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await auditLoadingSprites(), null, 2));
}
