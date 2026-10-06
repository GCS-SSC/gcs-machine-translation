import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom', globals: true, include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8', include: ['client/**/*.ts', 'shared/**/*.ts', 'i18n/**/*.ts', 'components/**/*.vue', 'server/**/*.ts', 'extension.config.ts'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 }
    }
  }
})
