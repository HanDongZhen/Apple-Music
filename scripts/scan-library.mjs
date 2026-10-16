#!/usr/bin/env node
import { readdir, mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { basename, dirname, extname, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { parseFile } from 'music-metadata';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
if (args.includes('--help') || !args[0] || args[0].startsWith('--')) {
  console.log(
    'Usage: npm run scan-library -- <audio-folder> [--out private-library] [--base-url /media]',
  );
  console.log(
    'Scans original files, extracts embedded artwork and adjacent .lrc/.json lyrics, writes library.json and upload-manifest.json. Does not copy, modify, transcode, or upload audio.',
  );
  process.exit(args.includes('--help') ? 0 : 1);
}
const root = resolve(args[0]);
const output = resolve(flag('--out', 'private-library'));
const base = flag('--base-url', '/media').replace(/\/$/, '');
if (!/^(https?:\/\/|\/(?!\/))/.test(base))
  throw new Error('--base-url must be http(s) or root-relative');
await mkdir(output, { recursive: true });
await mkdir(resolve(output, 'artwork'), { recursive: true });
await mkdir(resolve(output, 'lyrics'), { recursive: true });
async function walk(path) {
  const result = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = resolve(path, entry.name);
    if (child === output) continue;
    if (entry.isDirectory()) result.push(...(await walk(child)));
    else if (entry.isFile() && /\.(flac|wav|mp3|m4a|aac|ogg|opus|aiff)$/i.test(entry.name))
      result.push(child);
  }
  return result.sort();
}
async function hashFile(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
const urlFor = (key) => `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
const tracks = [];
const uploads = [];
const failures = [];
for (const file of await walk(root)) {
  try {
    const { common, format } = await parseFile(file, { duration: true });
    const details = await stat(file);
    const id = (await hashFile(file)).slice(0, 24);
    const key = `music/${relative(root, file).split(sep).join('/')}`;
    if (tracks.some((track) => track.id === id)) {
      console.log(`Duplicate content skipped: ${basename(file)}`);
      continue;
    }
    let artworkUrl = '/artwork/placeholder.svg';
    const cover = common.picture?.[0];
    if (cover) {
      const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[
        cover.format
      ];
      if (extension) {
        const name = `${id}.${extension}`;
        const target = resolve(output, 'artwork', name);
        await writeFile(target, cover.data);
        const coverKey = `artwork/${name}`;
        artworkUrl = urlFor(coverKey);
        uploads.push({ source: target, key: coverKey, contentType: cover.format });
      }
    }
    let lyricsUrl;
    for (const extension of ['.lrc', '.json']) {
      const sidecar = resolve(dirname(file), `${basename(file, extname(file))}${extension}`);
      try {
        const source = await readFile(sidecar, 'utf8');
        const name = `${id}${extension}`;
        const target = resolve(output, 'lyrics', name);
        await writeFile(target, source);
        const lyricsKey = `lyrics/${name}`;
        lyricsUrl = urlFor(lyricsKey);
        uploads.push({
          source: target,
          key: lyricsKey,
          contentType: extension === '.json' ? 'application/json' : 'text/plain; charset=utf-8',
        });
        break;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    tracks.push({
      id,
      title: common.title || basename(file, extname(file)),
      artist: common.artist || 'Unknown Artist',
      album: common.album || 'Unknown Album',
      albumArtist: common.albumartist,
      year: common.year,
      genre: common.genre?.[0],
      trackNumber: common.track.no ?? undefined,
      discNumber: common.disk.no ?? undefined,
      duration: format.duration || 0,
      audioUrl: urlFor(key),
      artworkUrl,
      lyricsUrl,
      codec: format.codec || extname(file).slice(1),
      bitDepth: format.bitsPerSample,
      sampleRate: format.sampleRate,
      bitrate: format.bitrate,
      channels: format.numberOfChannels,
      fileSize: details.size,
      addedAt: details.mtimeMs,
    });
    uploads.push({ source: file, key, original: true });
    console.log(`Scanned: ${basename(file)}`);
  } catch (error) {
    failures.push({ file: relative(root, file), error: error.message });
    console.error(`Failed: ${basename(file)} — ${error.message}`);
  }
}
await writeFile(resolve(output, 'library.json'), JSON.stringify({ version: 1, tracks }, null, 2));
uploads.push({
  source: resolve(output, 'library.json'),
  key: 'library.json',
  contentType: 'application/json',
});
await writeFile(
  resolve(output, 'upload-manifest.json'),
  JSON.stringify({ version: 1, files: uploads, failures }, null, 2),
);
console.log(`${tracks.length} tracks. ${failures.length} failed. Metadata: ${output}`);
if (failures.length) process.exitCode = 1;
