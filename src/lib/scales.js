// Scatterplot y-scale (square root), shared by the component and scripts/check-brush.mjs.
import * as d3 from 'd3';

// Ticks chosen in ORIGINAL units so low values get labels where the sqrt scale expands them.
const SQRT_TICKS = [0, 1, 2.5, 5, 10, 20, 40, 60, 80];

/**
 * Square-root y-scale. Domain [0, max].nice(): zero is preserved and the full observed range shown.
 * @param {number} max  largest observed OB-GYN rate
 * @param {[number, number]} range  [bottom px, top px]
 */
export function makeYScale(max, range) {
	return d3.scaleSqrt().domain([0, max]).nice().range(range);
}

/** Tick values in original units (never sqrt-transformed numbers). */
export function yTickValues(scale) {
	const [, hi] = scale.domain();
	return SQRT_TICKS.filter((t) => t <= hi);
}

export const yTickFormat = d3.format('~g'); // 2.5 → "2.5", 10 → "10"
