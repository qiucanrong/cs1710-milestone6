// Interaction state helpers. The page holds ONE `selection` object; the selected
// FIPS set is always derived from it (never stored separately).
import * as d3 from 'd3';
import { categoryLabel } from './categories.js';

export const NO_SELECTION = { mode: 'none' };

export const FILTERS = [
	{ id: 'all', label: 'All counties' },
	{ id: 'metro', label: 'Metro' },
	{ id: 'nonmetro', label: 'Nonmetro' }
];

/** metro is true / false / null; null only counts toward "all". */
export function passesFilter(d, filter) {
	if (filter === 'metro') return d.metro === true;
	if (filter === 'nonmetro') return d.metro === false;
	return true;
}

/**
 * @param {{mode: string, fips?: string, key?: string, x0?: number, x1?: number, y0?: number, y1?: number}} sel
 * @param {any[]} eligible rows that pass the county-type filter
 * @returns {Set<string> | null} null = no active selection
 */
export function selectedFips(sel, eligible) {
	let keep;
	if (sel.mode === 'county') keep = (d) => d.fips === sel.fips;
	else if (sel.mode === 'category') keep = (d) => d.cat.key === sel.key;
	else if (sel.mode === 'brush') keep = inBrush(sel);
	else return null;
	return new Set(eligible.filter(keep).map((d) => d.fips));
}

// scale.invert(scale(v)) is not always exactly v (e.g. −1e-14 for 0, or sqrt round-off),
// so a value sitting exactly on a brush edge would drop out. A tiny tolerance fixes that.
const EPS = 1e-9;

/** Brush test on actual data values; extents are already inverted to data units. */
export function inBrush(e) {
	return (d) =>
		d.drive_miles_change >= e.x0 - EPS &&
		d.drive_miles_change <= e.x1 + EPS &&
		d.obgyn_per_10k_women >= e.y0 - EPS &&
		d.obgyn_per_10k_women <= e.y1 + EPS;
}

const f1 = d3.format(',.1f');
const f2 = d3.format(',.2f');

export function describeSelection(sel, byFips) {
	if (sel.mode === 'county') {
		const d = byFips.get(sel.fips);
		return `County: ${d ? `${d.county}, ${d.state_abbr}` : sel.fips}`;
	}
	if (sel.mode === 'category') return `Legend category: ${categoryLabel(sel.key)}`;
	if (sel.mode === 'brush')
		return `Brush: driving-distance change ${f1(sel.x0)} to ${f1(sel.x1)} mi, OB-GYN supply ${f2(Math.max(0, sel.y0))} to ${f2(sel.y1)} per 10k`;
	return 'No active selection';
}
