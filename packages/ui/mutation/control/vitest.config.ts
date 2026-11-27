import { defineConfig } from "vitest/config";

// Which of the control's two tests runs: CONTROL=weak or CONTROL=strong (default strong).
export default defineConfig({
  test: {
    include: [`${process.env.CONTROL ?? "strong"}.test.ts`],
    environment: "node",
    coverage: { enabled: false },
  },
});
