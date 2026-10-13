import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(pkg.version);
if (!match) throw new Error('iOS release version must be major.minor.patch.');
const [, major, minor, patch] = match.map(Number);
// Deterministic locally, while CI can export a monotonically increasing build number.
const build = process.env.IOS_BUILD_NUMBER || String(major * 1000000 + minor * 1000 + patch + 1);
if (!/^[1-9]\d{0,8}$/.test(build)) throw new Error('IOS_BUILD_NUMBER must be a positive integer of up to 9 digits.');
const projectFile = new URL('ios/App/App.xcodeproj/project.pbxproj', root);
const project = await readFile(projectFile, 'utf8');
const updated = project
  .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${pkg.version};`)
  .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`)
  .replace(/IPHONEOS_DEPLOYMENT_TARGET = [^;]+;/g, 'IPHONEOS_DEPLOYMENT_TARGET = 17.0;');
if (!updated.includes(`MARKETING_VERSION = ${pkg.version};`)) throw new Error('iOS project has no version fields.');
await writeFile(projectFile, updated);
// Capacitor regenerates this package on sync; keep the supported OS and portable
// node_modules symlink paths consistent on Windows and macOS/pnpm installations.
const packageFile = new URL('ios/App/CapApp-SPM/Package.swift', root);
const spm = await readFile(packageFile, 'utf8');
await writeFile(packageFile, spm
  .replace(/platforms: \[\.iOS\([^)]*\)\]/, 'platforms: [.iOS(.v17)]')
  .replace(/path: "[^"]*node_modules\/@capacitor\/(app|browser|preferences)"/g,
    'path: "../../../node_modules/@capacitor/$1"'));
console.log(`iOS ${pkg.version} (${build}), minimum iOS 17.0: ${fileURLToPath(projectFile)}`);
