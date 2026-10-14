<script>
	import * as d3 from 'd3';
	import { MISSING, EXCLUDED } from '#lib/categories.js';

	/**
	 * @type {{
	 *   shapes: any[], stateBorders: any, nation: any,
	 *   eligibleFips: Set<string>, selected: Set<string> | null,
	 *   hoverFips: string | null, focusFips: string | null,
	 *   onhover: (fips: string | null) => void, onselect: (fips: string) => void
	 * }}
	 */
	let {
		shapes,
		stateBorders,
		nation,
		eligibleFips,
		selected,
		hoverFips,
		focusFips,
		onhover,
		onselect
	} = $props();

	// us-atlas albers file is already projected to 975×610 (Alaska/Hawaii insets included),
	// so geoPath needs no projection.
	const width = 975;
	const height = 610;
	const path = d3.geoPath();

	let countyPaths = $derived(shapes.map((s) => ({ ...s, d: path(s.feature) })));
	let pathByFips = $derived(new Map(countyPaths.map((s) => [s.fips, s.d])));
	let statePath = $derived(path(stateBorders));
	let nationPath = $derived(path(nation));

	function fill(s) {
		if (!s.cat) return 'url(#missing-hatch)';
		if (!eligibleFips.has(s.fips)) return EXCLUDED.fill;
		return s.cat.color;
	}

	// One delegated handler set on the <g>, instead of 3,142 per-path handlers.
	const fipsOf = (event) => event.target?.dataset?.fips ?? null;
</script>

<svg
	viewBox="0 0 {width} {height}"
	role="img"
	aria-label="US county map coloured by driving-distance change and OB-GYN-supply category. Use the county search for keyboard selection."
>
	<defs>
		<pattern id="missing-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
			<rect width="4" height="4" fill={MISSING.fill} />
			<line x1="0" y1="0" x2="0" y2="4" stroke={MISSING.hatch} stroke-width="1.5" />
		</pattern>
	</defs>

	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<g
		class="counties"
		onpointerover={(e) => onhover(fipsOf(e))}
		onpointerleave={() => onhover(null)}
		onclick={(e) => {
			const f = fipsOf(e);
			if (f) onselect(f);
		}}
	>
		{#each countyPaths as s (s.fips)}
			{@const eligible = s.cat && eligibleFips.has(s.fips)}
			<path
				d={s.d}
				data-fips={s.fips}
				fill={fill(s)}
				class:excluded={s.cat && !eligible}
				class:dim={eligible && selected && !selected.has(s.fips)}
				class:clickable={eligible}
			/>
		{/each}
	</g>
	<!-- Two-tone state lines: a white halo + dark core stay visible on light and dark fills. -->
	<path class="states halo" d={statePath} />
	<path class="states" d={statePath} />
	<path class="nation" d={nationPath} />

	<!-- Emphasis outlines drawn last so they sit above every county. -->
	{#if focusFips && pathByFips.has(focusFips)}
		<path class="outline-halo" d={pathByFips.get(focusFips)} />
		<path class="outline selected" d={pathByFips.get(focusFips)} />
	{/if}
	{#if hoverFips && pathByFips.has(hoverFips)}
		<path class="outline-halo" d={pathByFips.get(hoverFips)} />
		<path class="outline hover" d={pathByFips.get(hoverFips)} />
	{/if}
</svg>

<style>
	svg {
		display: block;
		width: 100%;
		height: auto;
	}
	.counties path {
		stroke: #ffffff;
		stroke-width: 0.2;
		stroke-linejoin: round;
		transition: opacity 120ms;
	}
	.counties path.clickable {
		cursor: pointer;
	}
	.counties path.excluded {
		stroke: #d4d4d8;
		stroke-width: 0.3;
	}
	.counties path.dim {
		opacity: 0.18;
	}
	.states {
		fill: none;
		stroke: #3b3f46;
		stroke-width: 0.6;
		stroke-linejoin: round;
		pointer-events: none;
	}
	.states.halo {
		stroke: #ffffff;
		stroke-width: 1.8;
	}
	.nation {
		fill: none;
		stroke: #6b7280;
		stroke-width: 0.8;
		stroke-linejoin: round;
		pointer-events: none;
	}
	.outline,
	.outline-halo {
		fill: none;
		pointer-events: none;
		stroke-linejoin: round;
	}
	.outline-halo {
		stroke: #ffffff;
		stroke-width: 4;
	}
	.outline {
		stroke: #111827;
		stroke-width: 2;
	}
	.outline.selected {
		stroke-dasharray: 4 2;
	}
</style>
