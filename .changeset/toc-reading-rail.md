---
'@interlace/ui': minor
---

Toc: the table of contents now follows the reader. A section stays current from the moment its heading crosses the reading line until the next one does, so the rail never goes blank; a marker slides to the current entry and the track fills as you read; long outlines (over 10 entries, or `collapse`) show sub-headings only under the current section; a pick holds its entry while the page scrolls there. New `title` prop for a visible heading. New `TocBar` for narrow layouts: a slim bar that names the current section, shows the page's progress along its foot, and opens the list in a bottom sheet that closes on a pick with focus on the heading. ReadingLayout uses `TocBar` below `@4xl` and titles its rail with `triggerLabel`. All motion is `motion-safe`.

Components: toc, reading-layout
