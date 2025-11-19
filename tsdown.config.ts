import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/annotation-canvas/index.tsx'],
  format: ['esm', 'cjs'],
})
