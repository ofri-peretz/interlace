---
'@interlace/ui': minor
---

New `ChoroplethMap`: a value per area as shades of one colour. You pass the shapes as projected SVG paths, so Interlace ships no geography and decides no borders. Values fall into a few classes (quantile, equal or your own breaks) with a legend a reader can match; missing areas are hatched and labelled "No data", never drawn as the lowest shade. Every area is reachable by keyboard and announced with its value, and a table view carries the same numbers.

Components: choropleth-map
