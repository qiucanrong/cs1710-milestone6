import { asset } from '$app/paths';
import * as d3 from 'd3';
import { feature, mesh } from 'topojson-client';
import { parseCounty, hasPlottedValues } from './parse.js';

/**
 * Loads counties + geometry. Uses asset() so URLs include paths.base.
 * @param {typeof fetch} fetch
 */
export async function loadDashboardData(fetch) {
	const [csvText, topo] = await Promise.all([
		fetch(asset('data/counties.csv')).then((r) => r.text()),
		fetch(asset('data/counties-albers-10m.json')).then((r) => r.json())
	]);

	const counties = d3.csvParse(csvText, parseCounty);
	const byFips = new Map(counties.map((d) => [d.fips, d]));

	// Geometry is pre-projected (d3.geoAlbersUsa, 975×610) -> use d3.geoPath() with no projection.
	const shapes = feature(topo, topo.objects.counties).features.map((f) => ({
		fips: String(f.id),
		feature: f,
		datum: byFips.get(String(f.id)) ?? null // null = no CSV row (e.g. DC)
	}));
	const stateBorders = mesh(topo, topo.objects.states, (a, b) => a !== b);
	const nation = feature(topo, topo.objects.nation);

	const geoIds = new Set(shapes.map((s) => s.fips));
	return {
		counties,
		scatterRows: counties.filter(hasPlottedValues), // independent of geometry
		shapes,
		stateBorders,
		nation,
		unmatched: {
			csvWithoutShape: counties.filter((d) => !geoIds.has(d.fips)),
			shapeWithoutCsv: shapes.filter((s) => !s.datum)
		}
	};
}
