import { defineConfig } from 'tsup';

export default defineConfig({
  // `styles` is a CSS entry → emitted as dist/styles.css (exported as
  // `@untra/naiveworkflow-react/styles.css`). It has no third-party @imports, so
  // esbuild compiles it cleanly.
  entry: { index: 'src/index.ts', styles: 'src/styles.css' },
  format: ['esm', 'cjs'],
  dts: { entry: { index: 'src/index.ts' } },
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['react', 'react-dom', '@xyflow/react'],
});
