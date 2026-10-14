// Data/logic checks for the dashboard. Run with: npm run verify
// Compares the app's own functions against direct calculations on the raw CSV text.
import { readFileSync } from 'node:fs';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import { parseCounty, hasPlottedValues } from '../src/lib/parse.js';
import { classify } from '../src/lib/categories.js';
import { passesFilter, selectedFips, NO_SELECTION } from '../src/lib/selection.js';
import { makeYScale } from '../src/lib/scales.js';

let failures = 0;
const check = (label, ok, detail = '') => {
	if (!ok) failures++;
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
};

const csv = readFileSync('static/data/counties.csv', 'utf8');
const rows = d3.csvParse(csv, parseCounty).filter(hasPlottedValues).map((d) => ({ ...d, cat: classify(d) }));

// 1. Highlight category vs a direct calculation on the raw strings (no app code).
const raw = d3.csvParse(csv); // all strings
const direct = raw.filter(
	(r) => r.drive_miles_change !== '' && r.obgyn_per_10k_women !== '' && +r.drive_miles_change >= 100 && +r.obgyn_per_10k_women === 0
);
const legend = selectedFips({ mode: 'category', key: '2-2' }, rows);
const directSet = new Set(direct.map((r) => r.fips));
check('legend "≥100 mi & 0 OB-GYNs" = direct CSV calculation', legend.size === directSet.size && [...legend].every((f) => directSet.has(f)), `${legend.size} vs ${directSet.size}`);

// 2. All nine categories partition the plotted counties.
const byKey = d3.rollup(rows, (v) => v.length, (d) => d.cat.key);
check('nine categories sum to plotted rows', d3.sum(byKey.values()) === rows.length && byKey.size === 9, `${d3.sum(byKey.values())} of ${rows.length}`);

// 3. Filters: metro null only in "all"; subgroups partition the rest.
const n = (f) => rows.filter((d) => passesFilter(d, f)).length;
const nullMetro = rows.filter((d) => d.metro == null).length;
check('metro + nonmetro + unknown = all', n('metro') + n('nonmetro') + nullMetro === n('all'), `${n('metro')} + ${n('nonmetro')} + ${nullMetro} = ${n('all')}`);
const rawMetro = raw.filter((r) => hasPlottedValues(parseCounty(r)) && r.metro === '1.0').length;
check('metro count = raw metro=1 rows', n('metro') === rawMetro, `${n('metro')} vs ${rawMetro}`);

// 4. No selection = null (not an empty set); empty brush = empty set.
check('no selection is null', selectedFips(NO_SELECTION, rows) === null);
check('brush with no counties is an empty Set', selectedFips({ mode: 'brush', x0: -290, x1: -280, y0: 70, y1: 75 }, rows)?.size === 0);

// 5. Geometry join: every plotted county has a shape.
const topo = JSON.parse(readFileSync('static/data/counties-albers-10m.json', 'utf8'));
const geoIds = new Set(feature(topo, topo.objects.counties).features.map((f) => String(f.id)));
const noShape = rows.filter((d) => !geoIds.has(d.fips));
check('every plotted county has a map shape', noShape.length === 0, `${noShape.length} without`);

// 6. Brush: pixel extent -> sqrt invert -> same counties as the requested data region.
const [W, H, m, inset] = [560, 470, { top: 16, right: 20, bottom: 78, left: 66 }, 8];
const x = d3.scaleLinear().domain(d3.extent(rows, (d) => d.drive_miles_change)).nice().range([m.left + inset, W - m.right - inset]);
const y = makeYScale(d3.max(rows, (d) => d.obgyn_per_10k_women), [H - m.bottom - inset, m.top + inset]);
const truth = (e) => new Set(rows.filter((d) => d.drive_miles_change >= e.x0 && d.drive_miles_change <= e.x1 && d.obgyn_per_10k_women >= e.y0 && d.obgyn_per_10k_women <= e.y1).map((d) => d.fips));
for (const r of [
	{ x0: 100, x1: 800, y0: 0, y1: 2.5 },
	{ x0: -250, x1: 0, y0: 2.505, y1: 80 },
	{ x0: 150, x1: 600, y0: 5, y1: 20 },
	{ x0: 0, x1: 0, y0: 0, y1: 80 }
]) {
	const inv = { mode: 'brush', x0: x.invert(x(r.x0)), x1: x.invert(x(r.x1)), y0: y.invert(y(r.y0)), y1: y.invert(y(r.y1)) };
	const got = selectedFips(inv, rows);
	const want = truth(r);
	check(`brush x ${r.x0}..${r.x1}, y ${r.y0}..${r.y1} (sqrt invert)`, got.size === want.size && [...got].every((f) => want.has(f)), `${got.size} vs ${want.size}`);
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exitCode = failures ? 1 : 0;
