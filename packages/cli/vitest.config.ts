import { defineConfig } from 'vitest/config';

/**
 * The CLI's decidable surface — argv parsing, name resolution, output
 * formatting — is pure and lives in `src/plan.ts` and `src/render.ts`, so it
 * is held at 100% the same way the DS holds its covered globs at 100: a
 * category is either in the glob at 100 or it is out.
 *
 * `src/components-json.ts` does touch the filesystem and is covered anyway,
 * because it is the ONE thing this CLI writes into a consumer's repository —
 * the place where a bug costs somebody else their config, not us a rerun. Its
 * tests use a real temp directory rather than a mocked `fs`, so what they
 * assert is the bytes on disk.
 *
 * `src/index.ts` is deliberately OUT. It is the I/O edge — spawn, fetch,
 * process.exit — and covering it would mean mocking `child_process` and
 * asserting we called it, which tests the mock. What actually protects it is
 * `__tests__/package-contract.test.ts` (the `bin` target exists and is what
 * `npx interlace-ui` resolves) plus the shape assertions the pure modules
 * already carry.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    passWithNoTests: false,
    coverage: {
      enabled: true,
      provider: 'v8',
      include: ['src/plan.ts', 'src/render.ts', 'src/components-json.ts'],
      thresholds: { lines: 100, statements: 100, functions: 100, branches: 100 },
      reportsDirectory: './coverage',
      reporter: ['text-summary'],
    },
  },
});
