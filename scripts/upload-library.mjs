#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
// Explicit opt-in only. No credentials are written to files or passed as arguments.
const [manifestPath, bucket] = process.argv.slice(2);
if (!manifestPath || !bucket || !/^[a-z0-9-]+$/.test(bucket)) {
  console.error(
    'Usage: node scripts/upload-library.mjs <upload-manifest.json> <private-bucket-name>',
  );
  process.exit(1);
}
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (manifest.version !== 1 || !Array.isArray(manifest.files))
  throw new Error('Invalid upload manifest');
for (const file of manifest.files) {
  if (typeof file.key !== 'string' || typeof file.source !== 'string' || file.key.includes('..'))
    throw new Error('Invalid manifest entry');
  const args = [
    'wrangler',
    'r2',
    'object',
    'put',
    `${bucket}/${file.key}`,
    '--file',
    file.source,
    '--remote',
  ];
  if (file.contentType) args.push('--content-type', file.contentType);
  const result = spawnSync('npx', args, { stdio: 'inherit', shell: false });
  if (result.status !== 0) process.exit(result.status || 1);
}
