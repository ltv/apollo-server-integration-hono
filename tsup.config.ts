import { defineConfig } from 'tsup';
import { readdirSync, statSync } from 'fs';
import path from 'path';

const getAllDependencies = () => {
  const nodeModulesPath = path.resolve('node_modules');
  return readdirSync(nodeModulesPath).filter((dir) =>
    statSync(path.join(nodeModulesPath, dir)).isDirectory(),
  );
};

const external = getAllDependencies();

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  minify: true,
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  platform: 'node',
  external,
});
