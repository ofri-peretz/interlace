import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Vitest configuration for @interlace/ui.
 *
 * The tests in __tests__/ are *structural locks* — static source parsing
 * plus a tiny renderToStaticMarkup pass over layout primitives. No browser
 * APIs, but the static markup pass needs jsdom for React 19 type checks
 * around `useEffect` no-ops.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['__tests__/**/*.test.{ts,tsx}'],
    passWithNoTests: false,
    globals: true,
    reporters: ['default'],
  },
});
