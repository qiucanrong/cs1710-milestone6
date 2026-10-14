// Builds static/data/ from data/ and us-atlas, then prints data + join checks.
// Run with: npm run data
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { csvParse, csvFormat, extent } from 'd3';
import { feature } from 'topojson-client';
import { COLUMNS, parseCounty, hasPlottedValues } from '../src/lib/parse.js';

const SRC_CSV = 'data/counties.csv';
const SRC_TOPO = 'node_modules/us-atlas/counties-albers-10m.json';
const OUT_CSV = 'static/data/counties.csv';
const OUT_TOPO = 'static/data/counties-albers-10m.json';

// 1. Runtime CSV: only the needed columns, cell text copied verbatim.
const raw = csvParse(readFileSync(SRC_CSV, 'utf8'));
writeFileSync(OUT_CSV, csvFormat(raw, COLUMNS));
copyFileSync(SRC_TOPO, OUT_TOPO);

// 2. Parse exactly like the app does.
const rows = csvParse(readFileSync(OUT_CSV, 'utf8'), parseCounty);
const label = (d) => `${d.fips} ${d.county}, ${d.state_abbr}`;

console.log(`Rows: ${rows.length}; unique FIPS: ${new Set(rows.map((d) => d.fips)).size}`);
console.log(`All FIPS 5-digit strings: ${rows.every((d) => /^\d{5}$/.test(d.fips))}`);

console.log('\nColumn                 missing  range');
for (const k of COLUMNS) {
	const vals = rows.map((d) => d[k]);
	const miss = vals.filter((v) => v == null || v === '').length;
	const present = vals.filter((v) => v != null && v !== '');
	const range =
		typeof present[0] === 'number'
			? extent(present).join(' to ')
			: typeof present[0] === 'boolean'
				? `true ${present.filter(Boolean).length} / false ${present.filter((v) => !v).length}`
				: `${new Set(present).size} distinct`;
	console.log(`${k.padEnd(22)} ${String(miss).padStart(7)}  ${range}`);
	if (miss) console.log(`${''.padEnd(31)}null in: ${rows.filter((d) => d[k] == null || d[k] === '').map(label).join('; ')}`);
}

// 3. change ≈ jul2026 − may2022
const both = rows.filter((d) => d.drive_miles_change != null && d.drive_miles_may2022 != null && d.drive_miles_jul2026 != null);
const diffs = both.map((d) => Math.abs(d.drive_miles_jul2026 - d.drive_miles_may2022 - d.drive_miles_change));
const bad = both.filter((_, i) => diffs[i] > 0.15);
console.log(`\nchange check: ${both.length} rows, max |diff| = ${Math.max(...diffs).toFixed(6)}, rows off by >0.15 mi: ${bad.length}`);

const plotted = rows.filter(hasPlottedValues);
console.log(`Rows with both plotted values (scatterplot): ${plotted.length}`);
console.log(`Missing a plotted value: ${rows.filter((d) => !hasPlottedValues(d)).map(label).join('; ')}`);

// 4. Join to geometry, both directions.
const topo = JSON.parse(readFileSync(OUT_TOPO, 'utf8'));
const geoms = feature(topo, topo.objects.counties).features;
const geoIds = new Set(geoms.map((f) => String(f.id)));
const csvIds = new Set(rows.map((d) => d.fips));
console.log(`\nGeometry features: ${geoms.length}; unique ids: ${geoIds.size}`);
const csvOnly = rows.filter((d) => !geoIds.has(d.fips));
const geoOnly = geoms.filter((f) => !csvIds.has(String(f.id)));
console.log(`CSV rows without a shape (${csvOnly.length}): ${csvOnly.map(label).join('; ')}`);
const byState = {};
for (const f of geoOnly) (byState[String(f.id).slice(0, 2)] ??= []).push(`${f.id} ${f.properties.name}`);
console.log(`Shapes without a CSV row (${geoOnly.length}):`);
for (const [st, list] of Object.entries(byState))
	console.log(`  state ${st}: ${list.length > 6 ? `${list.length} shapes` : list.join('; ')}`);
const mapped = plotted.filter((d) => geoIds.has(d.fips));
console.log(`\nPlottable rows that also have a shape (map): ${mapped.length} of ${plotted.length}`);
console.log(`Wrote ${OUT_CSV} and ${OUT_TOPO}`);
