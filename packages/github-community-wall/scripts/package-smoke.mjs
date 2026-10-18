import { spawn } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with ${code ?? signal}`));
    });
  });

const temporaryDirectory = await mkdtemp(
  join(tmpdir(), 'github-community-wall-')
);
const packageDirectory = join(temporaryDirectory, 'package');
const installDirectory = join(temporaryDirectory, 'install');

try {
  await run('pnpm', ['pack', '--pack-destination', packageDirectory]);
  const [packageName] = await readdir(packageDirectory);
  const packageFile = join(packageDirectory, packageName);

  await run('npm', [
    'install',
    '--prefix',
    installDirectory,
    '--no-save',
    '--ignore-scripts',
    packageFile
  ]);
  await run('node', [
    join(
      installDirectory,
      'node_modules',
      'github-community-wall',
      'dist',
      'cli.js'
    ),
    '--version'
  ]);
  await run('node', [
    join(
      installDirectory,
      'node_modules',
      'github-community-wall',
      'dist',
      'cli.js'
    ),
    '--help'
  ]);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
