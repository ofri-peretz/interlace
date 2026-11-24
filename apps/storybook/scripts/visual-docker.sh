#!/usr/bin/env bash
# Run the visual specs inside the official Playwright image whose version is
# the one installed here, so a laptop, a cloud agent and CI all render the
# same pixels. Extra arguments go to `playwright test`, e.g.
#   npm run visual:docker -- --update-snapshots
#   npm run visual:docker -- --project=matrix --grep "Button"
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"   # apps/storybook
root="$(cd "$here/../.." && pwd)"          # repo root (node_modules live here)
version="$(node -p "require('$root/node_modules/@playwright/test/package.json').version")"
image="mcr.microsoft.com/playwright:v${version}-noble"

if [ ! -f "$here/storybook-static/index.json" ]; then
  echo "No storybook-static build. Run: npx turbo run build-storybook --filter=@interlace/storybook" >&2
  exit 1
fi

exec docker run --rm --ipc=host --init \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e CI="${CI:-}" \
  -e INTERLACE_VISUAL_DOCKER=1 \
  -v "$root:$root" \
  -w "$here" \
  "$image" \
  npx --no playwright test "$@"
