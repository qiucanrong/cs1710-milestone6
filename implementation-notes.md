# Implementation notes — Milestone 6 dashboard

Combines Sketch 10 (bivariate county map) and Sketch 19 (scatterplot) to ask: *where do
greater increases in driving distance to abortion care overlap with limited OB-GYN supply,
and how are these counties distributed geographically?*

Stack: SvelteKit 3.0.1, Svelte 5.57.2, Vite 8.3.4, adapter-static 4.0.0, d3 7.9.0,
topojson-client 3.1.0, us-atlas 3.0.1. Screenshots (1440 px wide): `screenshots/dashboard-final.png` (default state) and
`screenshots/dashboard-hover-middlesex-ma.png` (Middlesex County, MA, FIPS 25017, hovered on
the map).

## Data decisions
- Source: `data/counties.csv` (3,143 rows, 3,143 unique 5-character FIPS). `data/` is unchanged;
  `npm run data` writes the 11 needed columns to `static/data/counties.csv`.
- Numeric fields are parsed one by one (`src/lib/parse.js`); empty cells become `null`, never 0.
  FIPS stays a string.
- Plotted variables: change in driving distance to the nearest abortion clinic, May 2022 →
  July 2026 (miles), and OB-GYNs per 10,000 women ages 15–44, measured in 2023. The 2023
  figure is a single snapshot; it is not described as a pre-Dobbs baseline, and no change in
  supply is claimed.
- `drive_miles_change` equals July 2026 minus May 2022 in all 3,141 rows that have both.
- Bivariate categories are computed from those two numeric fields (not `access_band` or
  `hit_twice`): distance change ≤0 / >0–<100 / ≥100 mi; supply 0 / >0–2.5 / >2.5. These are
  exploratory cut points.
- Missing plotted values (left out of the scatterplot, not coloured on the map): Chugach
  (02063), Copper River (02066), Valdez-Cordova (02261), all Alaska. 3,140 counties plotted.
- Geometry: us-atlas, Census 2017 boundaries, pre-projected with Alaska/Hawaii insets.
  Connecticut's legacy counties match. Valdez-Cordova has a shape but no OB-GYN value (hatched);
  DC (11001) has a shape but no row (hatched); Chugach and Copper River have no shape and were
  not reassigned. All 3,140 plotted counties have a shape.
- `metro` is null for Connecticut's 8 counties; they count under All counties only.
- Some headline counts in `data/README.md` differ from the CSV (e.g. 1,065 vs 1,273 counties
  with increased distance); the CSV was treated as authoritative.

## Final interactions
- **Hover** (map county or scatter dot): outlines the county on the map, draws an enlarged dot
  on top in the scatterplot, and fills the County details panel (county and state, driving
  distance May 2022 and July 2026, change in driving distance, 2023 OB-GYN supply, obstetric
  hospitals, county type). Hover changes emphasis only.
- **Persistent selection**, one at a time; a new one replaces the old one:
  - click a county on the map (click again to deselect), or a dot in Inspect mode;
  - pick a county in the "Find a county" search box (keyboard-accessible);
  - click a legend cell to select that category;
  - drag a brush in Brush mode (d3.brush; the pixel extent is converted back to data values
    with the x and y scales).
  Unselected marks stay visible but dimmed in both views.
- **County type filter** (All / Metro / Nonmetro): filters the scatterplot; on the map,
  excluded counties are drawn in a neutral style. Axes and thresholds stay fixed. Changing the
  filter clears the selection and the brush.
- **Status**: describes the selection and shows "N of M eligible counties selected"; an empty
  brush is reported separately from no selection. Clear selection keeps the filter; Reset all
  also returns to All counties and Inspect mode.
- **Y-axis**: square root only (the linear option was removed). Ticks are in original units;
  a note says the scale expands low values. Dots are radius 2 at 70 % fill opacity.

## How the coordination works
The page (`src/routes/+page.svelte`) keeps a few pieces of **shared state**:
`filter`, `selection` (what kind of selection and its criteria — a FIPS code, a legend
category key, or brush ranges in data units), `hoverFips`, and `plotMode`.
Everything else is **derived** from that state every time it changes:
`eligible` (rows passing the filter) → `selected` (the set of FIPS codes matching the selection
among eligible rows, or `null` for no selection) → legend counts, the status text, and the
details panel. Map and scatterplot both receive the same `selected` set and dim any county
whose FIPS is not in it. They never talk to each other; they call `onhover`, `onselect` or
`onbrush`, and the page updates the state. When a non-brush selection replaces a brush, the
scatterplot removes the rectangle in code; that programmatic brush event is ignored so it
cannot erase the new selection.

## Changes during the build
- Bivariate palette chosen and checked with a palette validator (all nine colours pairwise
  distinguishable under simulated colour-vision deficiency).
- Fixed SvelteKit 3 `asset()` warning (no leading slash).
- Fixed legend title clipping, reference-label overlap, and button position jumps in the status
  area; scatterplot height reduced to fit a ~600 px-tall viewport.
- Fixed brush edges: `invert(scale(v))` is not exactly `v` (e.g. −1e-14 for 0), which dropped
  counties sitting on a brush edge; brush comparisons now use a 1e-9 tolerance.
- Removed the linear y-axis option; square root is the only scale.
- Labels now say "driving distance" for the May 2022 / July 2026 values and "change in driving
  distance" for the plotted variable.

## Checks performed
- `npx svelte-check`: 0 errors, 0 warnings. `npm run build`: succeeds (static output in `build/`).
- `npm run data`: row, FIPS, missing-value, range and join checks (see above).
- `npm run verify` (`scripts/verify.mjs`), all passing: ≥100 mi & 0 OB-GYN legend set equals a
  direct calculation on the raw CSV (316); the nine categories add up to 3,140; metro 1,178 +
  nonmetro 1,954 + unknown 8 = 3,140; no selection is `null` and an empty brush is an empty set;
  every plotted county has a shape; four brush regions under the square-root scale select
  exactly the directly calculated counties.
- In Chrome at 1440 × 608 CSS px:
  - hover leaves all counts, the status text and the dimmed marks unchanged, with and without
    a selection;
  - the legend selection highlights the same 316 county codes in the map and the scatterplot,
    matching the CSV;
  - with the Metro filter, the same cell selects 70 counties, the same set in both views and
    matching the CSV;
  - hovering Valdez-Cordova and DC shows the correct missing-data messages, and clicking them
    does not change the selection;
  - drawing a second brush replaces the first (one rectangle, new count); clicking empty plot
    space and the Clear selection button both remove the brush;
  - the reference labels no longer overlap.
- Earlier rounds also checked in Chrome: dot hover ↔ map outline, map click and keyboard search
  selection, focus rings, resizing with an active brush, and the stacked layout at phone width.

## Deployment preparation
- No Git remote or deployment configuration existed for this project (it sits inside a home-
  directory repository whose remote belongs to an unrelated project), and the earlier course
  labs have no hosting setup either.
- Prepared for GitHub Pages: `adapter-static` with prerendering, `paths.base` from `BASE_PATH`,
  data fetched with `asset('data/...')`, and a GitHub Actions workflow
  (`.github/workflows/deploy.yml`) that runs `npm run verify`, builds with
  `BASE_PATH=/<repo-name>`, and publishes `build/`.
- Moved the favicon to `static/` and linked it in `src/app.html`, which removed a 404 on
  `/favicon.ico` at a subpath.
- Checked locally: a build with `BASE_PATH=/cs1710-milestone6`, served by a plain static file
  server under that subpath and loaded in headless Chrome, rendered 3,140 dots and 3,142 county
  shapes; both data files returned 200 from `/cs1710-milestone6/data/`; no failed requests or
  console errors. Not yet deployed — no public URL has been verified.

## Remaining limitations
- 1,457 counties with no OB-GYNs lie on y = 0 and many counties with no distance change lie on
  x = 0; they overlap heavily because points are not jittered.
- Counties outside the filter use a very light fill that is close to the lightest category
  colour (≤0 mi, >2.5); their grey outline is the main difference.
- Cleanup of brush event handlers when the component is removed is in the code but was not
  triggered in testing (single-page app). Touch input was not tested.
- `scripts/verify.mjs` repeats the scatterplot's size and margin numbers; if those change in
  `Scatterplot.svelte`, the script must be updated to match.
- Valdez-Cordova shows 0 obstetric hospitals while its OB-GYN value is missing; that is how the
  CSV records it.
