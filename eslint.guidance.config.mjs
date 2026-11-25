/**
 * Guidance placement: CLAUDE.md, AGENTS.md, skills and subagents, linted by
 * eslint-plugin-conventions' `guidance` preset on @eslint/markdown.
 *
 * It is its own config because the JS presets in eslint.config.mjs carry no
 * `files` and would run their rules on Markdown. `npm run lint:guidance` runs
 * it, from CI's eslint job and the pre-push hook. Every rule is at error; findings that predate
 * it live in .guidance-suppressions.json, which may only shrink
 * (`npm run lint:guidance -- --prune-suppressions` after a fix).
 */
import markdown from "@eslint/markdown";
import { configs as conventions } from "eslint-plugin-conventions";

const { guidance } = conventions;

export default [
  {
    // ESLint lints *.js, *.mjs and *.cjs by default; here they would only
    // report the main config's disable comments as unknown rules.
    ignores: [
      "**/*.{js,mjs,cjs}",
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/.next/**",
      "**/.turbo/**",
    ],
  },
  { plugins: { markdown } },
  {
    ...guidance,
    rules: {
      ...Object.fromEntries(
        Object.keys(guidance.rules).map((rule) => [rule, "error"]),
      ),
      // Budgets held near this repo's sizes, well under the preset's 4096
      // bytes and 1024 description chars. A file already over them is pinned
      // in .guidance-budget.json, which may only shrink. Lower them as files
      // shrink; raise one only by decision.
      "conventions/guidance-budget": [
        "error",
        {
          memoryBytes: 800,
          descriptionChars: 250,
          ratchetFile: ".guidance-budget.json",
        },
      ],
    },
  },
];
