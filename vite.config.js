import { readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { defineConfig } from 'vite';

const ROOT = resolve('.');
const IGNORE_DIRS = new Set(['.git', 'dist', 'node_modules']);

function collectHtmlFiles(dirPath, files = []) {
  for (const entry of readdirSync(dirPath)) {
    const fullPath = resolve(dirPath, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      if (!IGNORE_DIRS.has(entry)) {
        collectHtmlFiles(fullPath, files);
      }
      continue;
    }

    if (entry.endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files;
}

const htmlInputs = Object.fromEntries(
  collectHtmlFiles(ROOT).map((filePath) => {
    const relPath = relative(ROOT, filePath);
    const name = relPath.replace(/\.html$/, '');
    return [name, filePath];
  })
);

export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: htmlInputs,
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) {
            return 'three';
          }
        },
      },
    },
  },
});
