---
'@interlace/ui': major
---

Interlace no longer rewrites the host app's Tailwind theme. Installing one component used to redefine `max-w-sm` (24rem became 1rem), move `sm:` from 640px to 480px, delete `2xl:` and change every `rounded-sm|md|lg`. Spacing is now Tailwind's numeric scale, which follows `--spacing`. Radius derives from `--radius` exactly as shadcn derives it. The only breakpoint Interlace declares is a new `xs:` tier at 480px, which Tailwind doesn't use. Components render pixel-for-pixel as before.

Components: accordion, alert, alert-dialog, article-card, article-list-grid, article-template, auth-template, author-byline, author-template, blog-home-template, box, breadcrumb, button, button-variants, callout, checkbox, code-block, code-editor, code-window, combobox, command-palette, container, context-menu, cta-section, dashboard-template, data-table, dialog, distribution, docs-page-template, dropdown-menu, empty-state, error-template, faq, feature-grid, figure, focus-cards, focus-ring, footer, grade-badge, grid, hero, hero-cosmic, hover-card, input, landing-template, lint-playground, metric-table, network-graph, newsletter-form, number-field, page-header, pagination, popover, prev-next-post, pricing-table, prose, radial-weave, registry-item-template, related-posts, scorecard-row, scorecard-template, section-boundary, select, settings-template, sheet, shimmer-button, skeleton, skeleton-variants, skip-link, stack, stat-card, stat-group, stat-strip, stats-template, sunny-background, tabs, tag-template, testimonial, textarea, theme, theme-switcher, theme-tokens, time-series, timeline-map, toast, toc, toggle, tooltip, topbar

Kind: Breaking

Migration: Only code you wrote against Interlace's tokens is affected. Already-installed component files keep working once you reinstall them.

1. Named spacing to numeric: `xs` → `2`, `sm` → `4`, `md` → `6`, `lg` → `10`, `xl` → `16`, `2xl` → `24` (`gap-md` → `gap-6`, `-mt-xl` → `-mt-16`). This also applies to `max-w-*`, `w-*` and `h-*` with those names, since they resolved to spacing values.
2. Radius, to keep the same pixels: `rounded-md` → `rounded-lg`, `rounded-lg` → `rounded-xl`, `rounded-xl` → `rounded-lg`, `rounded-2xl` → `rounded-xl`. `rounded-sm` is unchanged. To change every radius at once, set `--radius` (Interlace's default is 0.75rem).
3. Breakpoints: `sm:` meaning 480px → `xs:`, including `max-sm:` → `max-xs:`. `sm:`, `md:`, `lg:`, `xl:` and `2xl:` are now Tailwind's own tiers.
4. `var(--spacing-md)` → `--spacing(6)`, and `--interlace-radius-sm|md|lg` → `--interlace-radius` (the one base value).
