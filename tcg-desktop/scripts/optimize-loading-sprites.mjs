// Development-only format conversion. Keeps every visible RGB value and alpha
// value unchanged, and archives original PNGs outside shipped public assets.
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { LOADING_CHARACTERS } from '../src/data/loadingCharacters.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const publicDirectory = resolve(root, 'public/assets/loading');
const archiveDirectory = resolve(root, 'docs/art-originals-0.15/loading-local');
const reportPath = resolve(root, 'docs/loading-lossless-optimization-0.15.json');
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const containedPath = (directory, filename) => {
  const target = resolve(directory, filename);
  if (!target.startsWith(`${directory}${sep}`)) throw new Error('Image path escapes its directory');
  return target;
};

mkdirSync(archiveDirectory, { recursive: true });
const records = [];
for (const { id } of LOADING_CHARACTERS) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Unexpected character id: ${id}`);
  const original = containedPath(publicDirectory, `${id}-walk.png`);
  const archived = containedPath(archiveDirectory, `${id}-walk.png`);
  const source = existsSync(original) ? original : archived;
  const target = containedPath(publicDirectory, `${id}-walk.webp`);
  const sourceHash = sha256(readFileSync(source));
  if (existsSync(archived) && sha256(readFileSync(archived)) !== sourceHash) throw new Error(`Archive differs: ${id}`);
  await sharp(source).webp({ lossless: true, effort: 6 }).toFile(target);
  const before = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const after = await sharp(target).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (before.info.width !== after.info.width || before.info.height !== after.info.height || before.info.channels !== 4 || after.info.channels !== 4 || before.data.length !== after.data.length) {
    throw new Error(`Decoded dimensions changed: ${id}`);
  }
  let changedVisiblePixels = 0; let changedAlphaPixels = 0; let changedTransparentRgbPixels = 0;
  for (let offset = 0; offset < before.data.length; offset += 4) {
    if (before.data[offset + 3] !== after.data[offset + 3]) changedAlphaPixels += 1;
    const rgbChanged = before.data[offset] !== after.data[offset]
      || before.data[offset + 1] !== after.data[offset + 1]
      || before.data[offset + 2] !== after.data[offset + 2];
    if (rgbChanged) {
      if (before.data[offset + 3] || after.data[offset + 3]) changedVisiblePixels += 1;
      else changedTransparentRgbPixels += 1;
    }
  }
  if (changedVisiblePixels || changedAlphaPixels) throw new Error(`Visible pixels or alpha changed: ${id}`);
  if (!existsSync(archived)) copyFileSync(source, archived, constants.COPYFILE_EXCL);
  records.push({
    id, source: `docs/art-originals-0.15/loading-local/${id}-walk.png`, target: `public/assets/loading/${id}-walk.webp`,
    width: before.info.width, height: before.info.height,
    originalBytes: statSync(source).size, optimizedBytes: statSync(target).size,
    originalSha256: sourceHash, optimizedSha256: sha256(readFileSync(target)),
    changedVisiblePixels, changedAlphaPixels, changedTransparentRgbPixels,
  });
  console.log(JSON.stringify({ id, savedBytes: records.at(-1).originalBytes - records.at(-1).optimizedBytes, changedTransparentRgbPixels }));
}

// Every output and archive has passed validation before removing any PNG from
// the package. Delete only explicit files within the checked asset directory.
for (const record of records) {
  const original = containedPath(publicDirectory, `${record.id}-walk.png`);
  if (existsSync(original)) unlinkSync(original);
}
const originalBytes = records.reduce((sum, entry) => sum + entry.originalBytes, 0);
const optimizedBytes = records.reduce((sum, entry) => sum + entry.optimizedBytes, 0);
const report = {
  format: 'lossless WebP',
  note: 'Dimensions, every alpha value, and every RGB value with alpha > 0 are unchanged. Fully transparent RGB may be normalized by WebP; PNG originals are retained locally outside shipped assets.',
  count: records.length, originalBytes, optimizedBytes, savedBytes: originalBytes - optimizedBytes, records,
};
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ count: report.count, originalBytes, optimizedBytes, savedBytes: report.savedBytes }));
