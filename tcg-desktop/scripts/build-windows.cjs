const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const projectDir = path.resolve(__dirname, '..');
const releaseDir = path.join(projectDir, 'release');
const tempRoot = path.resolve(os.tmpdir());
const tempOutput = path.join(tempRoot, `hoi-card-desk-build-${Date.now()}-${process.pid}`);
const builderCli = require.resolve('electron-builder/out/cli/cli.js');
const publish = process.argv.includes('--publish');

if (!tempOutput.startsWith(`${tempRoot}${path.sep}`) || !path.basename(tempOutput).startsWith('hoi-card-desk-build-')) {
  throw new Error('Refusing to use an unexpected temporary build directory.');
}

fs.mkdirSync(tempOutput, { recursive: true });
const args = [
  builderCli,
  '--win',
  'nsis',
  '--publish',
  publish ? 'always' : 'never',
  `--config.directories.output=${tempOutput}`,
];

const result = spawnSync(process.execPath, args, {
  cwd: projectDir,
  env: process.env,
  stdio: 'inherit',
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}

fs.mkdirSync(releaseDir, { recursive: true });
for (const entry of fs.readdirSync(tempOutput, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const source = path.join(tempOutput, entry.name);
  const destination = path.join(releaseDir, entry.name);
  fs.copyFileSync(source, destination);
}

fs.rmSync(tempOutput, { recursive: true, force: true });
console.log(`Windows release artifacts copied to ${releaseDir}`);
