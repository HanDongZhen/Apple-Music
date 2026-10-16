import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'versioned-offline-shell',
      apply: 'build',
      async closeBundle() {
        const assets = (await readdir('dist/assets'))
          .filter((file) => /\.(js|css)$/.test(file))
          .map((file) => `/assets/${file}`);
        const hash = createHash('sha256')
          .update(await readFile('dist/index.html'))
          .digest('hex')
          .slice(0, 12);
        const worker = (await readFile('public/sw.js', 'utf8'))
          .replace('mr-han-shell-v1', `mr-han-shell-${hash}`)
          .replace(
            'const CORE = [',
            `const CORE = [${assets.map((asset) => JSON.stringify(asset)).join(',')},`,
          );
        await writeFile('dist/sw.js', worker);
      },
    },
  ],
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
  build: { chunkSizeWarningLimit: 650 },
});
