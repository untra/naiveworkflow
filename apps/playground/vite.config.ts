import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const fromHere = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig(({ command }) => ({
  plugins: [react()],
  server: { port: 5180 },
  resolve: {
    // Single instance of React / React Flow when bundling package source directly.
    dedupe: ['react', 'react-dom', '@xyflow/react'],
    // Dev only: compile the workspace packages' source directly for instant HMR — edits in
    // packages/react/src and packages/compiler/src hot-reload without a tsup rebuild.
    // Production `vite build` keeps resolving to each package's built dist/ (CI builds packages
    // first), so the GitHub Pages bundle is unaffected. Ordered array: the /styles.css entry must
    // precede the bare package name, since a string `find` also matches `name/` subpaths.
    ...(command === 'serve'
      ? {
          alias: [
            {
              find: '@untra/naiveworkflow-react/styles.css',
              replacement: fromHere('../../packages/react/src/styles.css'),
            },
            {
              find: '@untra/naiveworkflow-react',
              replacement: fromHere('../../packages/react/src/index.ts'),
            },
            {
              find: '@untra/naiveworkflow-compiler/ir',
              replacement: fromHere('../../packages/compiler/src/ir/index.ts'),
            },
          ],
        }
      : {}),
  },
}));
