import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // `.tsx` too, so a component's KEYBOARD path can be asserted by a test that
    // actually presses keys. `node` stays the default environment — only the
    // interaction tests opt into jsdom, via a `@vitest-environment` docblock.
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
});
