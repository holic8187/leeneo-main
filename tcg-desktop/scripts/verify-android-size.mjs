import { stat } from 'node:fs/promises';

// Already-installed clients enforce this limit before running the new APK.
// Raising only the new client's limit cannot fix their download path.
const maximum = 256 * 1024 * 1024;
const file = process.argv[2];
if (!file) throw new Error('Provide the signed release APK path.');
const { size } = await stat(file);
if (size > maximum) {
  throw new Error(`APK is ${size} bytes; installed clients accept at most ${maximum}. Optimize bundled assets before publishing.`);
}
console.log(`Android update size verified: ${size} / ${maximum} bytes.`);
