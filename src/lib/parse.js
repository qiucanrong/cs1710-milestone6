// Row parsing for counties.csv. Pure functions (no SvelteKit imports) so the
// Node check script in scripts/ can reuse exactly the same logic as the app.

/** Columns copied to static/data/counties.csv and used by the dashboard. */
export const COLUMNS = [
	'fips',
	'county',
	'state',
	'state_abbr',
	'drive_miles_may2022',
	'drive_miles_jul2026',
	'drive_miles_change',
	'obgyn_per_10k_women',
	'ob_hospitals',
	'women_15_44',
	'metro'
];

/** Empty / missing cell -> null. Never 0. Throws on non-numeric text. */
export function num(value) {
	if (value == null) return null;
	const s = String(value).trim();
	if (s === '' || s.toUpperCase() === 'NA') return null;
	const n = Number(s);
	if (!Number.isFinite(n)) throw new Error(`Not a number: "${value}"`);
	return n;
}

/** Keep FIPS as a 5-character string (pads if a leading zero was lost). */
export function fips(value) {
	const s = String(value ?? '').trim();
	if (!/^\d{1,5}$/.test(s)) throw new Error(`Bad FIPS: "${value}"`);
	return s.padStart(5, '0');
}

/** Row accessor for d3.csv / d3.csvParse. Do NOT use d3.autoType here. */
export function parseCounty(d) {
	const metro = num(d.metro);
	return {
		fips: fips(d.fips),
		county: d.county,
		state: d.state,
		state_abbr: d.state_abbr,
		drive_miles_may2022: num(d.drive_miles_may2022),
		drive_miles_jul2026: num(d.drive_miles_jul2026),
		drive_miles_change: num(d.drive_miles_change),
		obgyn_per_10k_women: num(d.obgyn_per_10k_women),
		ob_hospitals: num(d.ob_hospitals),
		women_15_44: num(d.women_15_44),
		metro: metro == null ? null : metro === 1 // true / false / null
	};
}

/** True when both plotted variables are present (scatterplot inclusion rule). */
export function hasPlottedValues(d) {
	return d.drive_miles_change != null && d.obgyn_per_10k_women != null;
}
