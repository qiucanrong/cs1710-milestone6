// Bivariate categories + colours, shared by Map, Scatterplot and Legend.
// Thresholds are exploratory choices, computed from the numeric fields only
// (not from access_band or hit_twice).

/** Distance change, May 2022 → July 2026 (miles). Index 0..2, left → right. */
export const DIST_CLASSES = [
	{ label: '≤0 mi', long: 'No increase (≤0 miles)' },
	{ label: '>0 to <100 mi', long: 'Increase of >0 to <100 miles' },
	{ label: '≥100 mi', long: 'Increase of ≥100 miles' }
];

/** OB-GYNs per 10,000 women 15–44 (2023). Index 0..2, most → least supply. */
export const SUPPLY_CLASSES = [
	{ label: '>2.5', long: 'More than 2.5 per 10,000' },
	{ label: '>0 to 2.5', long: 'More than 0, up to 2.5 per 10,000' },
	{ label: '0', long: 'No OB-GYNs' }
];

export const DIST_BREAK = 100; // miles
export const SUPPLY_BREAK = 2.5; // per 10,000 women 15–44

/** @param {number|null} v */
export function distClass(v) {
	if (v == null) return null;
	if (v <= 0) return 0;
	if (v < DIST_BREAK) return 1;
	return 2;
}

/** @param {number|null} v */
export function supplyClass(v) {
	if (v == null) return null;
	if (v === 0) return 2;
	if (v <= SUPPLY_BREAK) return 1;
	return 0;
}

// PALETTE[supply][dist]. Darkness grows toward "≥100 mi and no OB-GYNs" (bottom-right),
// so that combination stands out. Validated with the dataviz palette checker:
// every pair of the nine colours ≥9.6 ΔE under simulated colour-vision deficiency, ≥15.6 normal.
export const PALETTE = [
	['#f2f2f2', '#f2b880', '#d24a10'], // supply > 2.5
	['#9ebeda', '#9e9073', '#80300a'], // supply > 0 to 2.5
	['#3a80d0', '#52665e', '#34230c'] // no OB-GYNs
];

/** Missing data: drawn with a hatch pattern, never one of the nine colours. */
export const MISSING = { fill: '#ffffff', hatch: '#9a9a9a', label: 'Missing data' };

/**
 * @param {{drive_miles_change: number|null, obgyn_per_10k_women: number|null} | null} d
 * @returns {{dist: number, supply: number, key: string, color: string} | null}
 */
export function classify(d) {
	if (!d) return null;
	const dist = distClass(d.drive_miles_change);
	const supply = supplyClass(d.obgyn_per_10k_women);
	if (dist == null || supply == null) return null;
	return { dist, supply, key: `${dist}-${supply}`, color: PALETTE[supply][dist] };
}

/** Readable text colour on top of a palette cell. */
export function inkOn(hex) {
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#1f2328' : '#ffffff';
}

/** Render order so the highlighted category is drawn on top. */
export function drawOrder(cat) {
	return cat ? cat.supply * 3 + cat.dist : -1;
}

/** "Distance ≥100 mi · OB-GYNs 0" for a "dist-supply" key. */
export function categoryLabel(key) {
	const [d, s] = key.split('-').map(Number);
	return `driving-distance change ${DIST_CLASSES[d].label}, OB-GYN supply ${SUPPLY_CLASSES[s].label}${s === 2 ? '' : ' per 10k'}`;
}

/** Map treatment for counties outside the active county-type filter. */
export const EXCLUDED = { fill: '#fcfcfc', stroke: '#d4d4d8', label: 'Outside county-type filter' };
