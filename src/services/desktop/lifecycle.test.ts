import { test } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

test('desktop lifecycle: verify build artifacts exist', () => {
  const mainPath = path.resolve(process.cwd(), 'dist-electron/main.cjs');
  const preloadPath = path.resolve(process.cwd(), 'dist-electron/preload.cjs');
  const iconPath = path.resolve(process.cwd(), 'assets/icon.ico');

  assert.strictEqual(fs.existsSync(mainPath), true, 'dist-electron/main.cjs must exist');
  assert.strictEqual(fs.existsSync(preloadPath), true, 'dist-electron/preload.cjs must exist');
  assert.strictEqual(fs.existsSync(iconPath), true, 'assets/icon.ico must exist');
});

test('desktop lifecycle: clean launch, loopback backend binding, and shutdown', () => {
  const cleanEnv = { ...process.env };
  if (cleanEnv.PATH) {
    cleanEnv.PATH = cleanEnv.PATH.replace(/"/g, '');
  }

  const cmd = `npx electron . --test-lifecycle`;
  const result = spawnSync(cmd, {
    cwd: process.cwd(),
    encoding: 'utf-8',
    env: cleanEnv,
    shell: true,
    timeout: 20000,
  });

  const output = (result.stdout || '') + (result.stderr || '');
  assert.strictEqual(result.status, 0, `Electron must exit with code 0. Output: ${output}`);
  assert.ok(
    output.includes('LIFECYCLE_VERIFICATION_PASS'),
    `Output must contain LIFECYCLE_VERIFICATION_PASS. Found: ${output}`
  );
  assert.ok(
    output.includes('loopback=127.0.0.1'),
    'Internal backend must bind strictly to 127.0.0.1 loopback'
  );
});
