import { defineConfig, type Options } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/bin.ts'
  },
  format: 'esm',
  outDir: 'dist',
  platform: 'node',
  target: 'es2022',
  tsconfig: 'tsconfig.json',
  sourcemap: true,
  treeshake: true,
  clean: true,
  dts: true,
  splitting: false,
  minify: false
} as Options);
