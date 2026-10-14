<script>
	import * as d3 from 'd3';
	import { DIST_BREAK, SUPPLY_BREAK } from '#lib/categories.js';
	import { makeYScale, yTickValues, yTickFormat } from '#lib/scales.js';

	/**
	 * @type {{
	 *   allRows: any[], rows: any[],
	 *   selected: Set<string> | null, hoverFips: string | null, focusFips: string | null,
	 *   mode: 'inspect' | 'brush', brushActive: boolean,
	 *   onhover: (fips: string | null) => void, onselect: (fips: string) => void,
	 *   onbrush: (extent: {x0: number, x1: number, y0: number, y1: number} | null) => void
	 * }}
	 * allRows fixes the axis domains; rows are the eligible (filtered) counties drawn.
	 */
	let {
		allRows,
		rows,
		selected,
		hoverFips,
		focusFips,
		mode,
		brushActive,
		onhover,
		onselect,
		onbrush
	} = $props();

	// Everything is in viewBox units, so CSS resizing never changes brush or scale coordinates.
	const width = 560;
	const height = 470; // shorter so the whole card fits a ~600 px-tall laptop viewport
	const margin = { top: 16, right: 20, bottom: 78, left: 66 };
	const inset = 8; // keeps dots at x/y extremes (including y = 0) inside the plot
	const r = 2; // small + slightly transparent to reduce overlap
	const hoverRadius = 12; // nearest-dot search radius, bigger than the mark

	// Domains come from ALL valid rows so they stay fixed across county-type filters.
	let x = $derived(
		d3
			.scaleLinear()
			.domain(d3.extent(allRows, (d) => d.drive_miles_change))
			.nice()
			.range([margin.left + inset, width - margin.right - inset])
	);
	// y: square-root scale; domain [0, max], fixed across filters.
	let y = $derived(
		makeYScale(d3.max(allRows, (d) => d.obgyn_per_10k_women), [
			height - margin.bottom - inset,
			margin.top + inset
		])
	);

	let byFips = $derived(new Map(rows.map((d) => [d.fips, d])));
	let delaunay = $derived(
		d3.Delaunay.from(
			rows,
			(d) => x(d.drive_miles_change),
			(d) => y(d.obgyn_per_10k_women)
		)
	);

	let svgEl = $state();
	let xAxisEl = $state();
	let yAxisEl = $state();
	let brushEl = $state();

	$effect(() => {
		d3.select(xAxisEl).call(d3.axisBottom(x).ticks(8).tickSizeOuter(0));
		d3.select(yAxisEl).call(
			d3.axisLeft(y).tickValues(yTickValues(y)).tickFormat(yTickFormat).tickSizeOuter(0)
		);
	});

	// --- hover / click via nearest dot (works in both modes, above or below the brush overlay)
	function nearest(event) {
		const [px, py] = d3.pointer(event, svgEl);
		const i = delaunay.find(px, py);
		const d = rows[i];
		if (!d) return null;
		const dist = Math.hypot(x(d.drive_miles_change) - px, y(d.obgyn_per_10k_women) - py);
		return dist <= hoverRadius ? d : null;
	}
	function handleMove(event) {
		onhover(nearest(event)?.fips ?? null);
	}
	function handleClick(event) {
		if (mode !== 'inspect') return;
		const d = nearest(event);
		if (d) onselect(d.fips);
	}

	// --- brush
	let brush;
	$effect(() => {
		const g = d3.select(brushEl);
		brush = d3
			.brush()
			.extent([
				[margin.left, margin.top],
				[width - margin.right, height - margin.bottom]
			])
			.on('brush end', (event) => {
				// Programmatic brush.move (e.g. clearing after a map selection) has no sourceEvent;
				// ignoring it means clearing the visual brush can't wipe out the new selection.
				if (!event.sourceEvent) return;
				if (!event.selection) {
					onbrush(null);
					return;
				}
				const [[px0, py0], [px1, py1]] = event.selection;
				// Invert pixel extent to data space through the scales (y is sqrt);
				// y range is flipped.
				onbrush({ x0: x.invert(px0), x1: x.invert(px1), y0: y.invert(py1), y1: y.invert(py0) });
			});
		g.call(brush);
		return () => {
			brush.on('brush end', null);
			g.on('.brush', null);
			g.selectAll('*').remove();
		};
	});

	// Selection replaced by map / legend / filter / reset -> remove the visible brush.
	$effect(() => {
		if (!brushActive && brushEl && d3.brushSelection(brushEl)) {
			d3.select(brushEl).call(brush.move, null);
		}
	});

	let refs = $derived([
		{ id: 'x0', x1: x(0), x2: x(0), y1: margin.top, y2: height - margin.bottom, label: 'no change', lx: x(0) - 4, ly: margin.top + 10, anchor: 'end' },
		{ id: 'x100', x1: x(DIST_BREAK), x2: x(DIST_BREAK), y1: margin.top, y2: height - margin.bottom, label: '+100 mi', lx: x(DIST_BREAK) + 4, ly: margin.top + 10, anchor: 'start' },
		{ id: 'y0', x1: margin.left, x2: width - margin.right, y1: y(0), y2: y(0), label: '', lx: 0, ly: 0 },
		{ id: 'y25', x1: margin.left, x2: width - margin.right, y1: y(SUPPLY_BREAK), y2: y(SUPPLY_BREAK), label: '2.5 per 10k', lx: margin.left + 4, ly: y(SUPPLY_BREAK) - 4 }
	]);

	let emphasis = $derived(
		[
			focusFips && byFips.get(focusFips) ? { kind: 'selected', d: byFips.get(focusFips) } : null,
			hoverFips && byFips.get(hoverFips) ? { kind: 'hover', d: byFips.get(hoverFips) } : null
		].filter(Boolean)
	);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<svg
	bind:this={svgEl}
	viewBox="0 0 {width} {height}"
	role="img"
	aria-label="Scatterplot of change in driving distance versus OB-GYNs per 10,000 women, one dot per county. Use the county search for keyboard selection."
	class:brush-mode={mode === 'brush'}
	onpointermove={handleMove}
	onpointerleave={() => onhover(null)}
	onclick={handleClick}
>
	<rect
		class="plot-bg"
		x={margin.left}
		y={margin.top}
		width={width - margin.left - margin.right}
		height={height - margin.top - margin.bottom}
	/>

	{#each refs as l (l.id)}
		<line class="ref" x1={l.x1} x2={l.x2} y1={l.y1} y2={l.y2} />
		{#if l.label}
			<text class="ref-label" x={l.lx} y={l.ly} text-anchor={l.anchor ?? 'start'}>{l.label}</text>
		{/if}
	{/each}

	<g class="dots">
		{#each rows as d (d.fips)}
			<circle
				data-fips={d.fips}
				cx={x(d.drive_miles_change)}
				cy={y(d.obgyn_per_10k_women)}
				{r}
				fill={d.cat.color}
				class:dim={selected && !selected.has(d.fips)}
			/>
		{/each}
	</g>

	<g class="axis" bind:this={xAxisEl} transform="translate(0,{height - margin.bottom})" />
	<g class="axis" bind:this={yAxisEl} transform="translate({margin.left},0)" />

	<!-- Brush sits above the dots; it only takes pointer events in brush mode. -->
	<g class="brush" bind:this={brushEl} />

	<!-- Emphasised dots drawn last = always on top of overlapping points. -->
	<g class="emphasis">
		{#each emphasis as e (e.kind)}
			<circle
				class={e.kind}
				cx={x(e.d.drive_miles_change)}
				cy={y(e.d.obgyn_per_10k_women)}
				r="5.5"
				fill={e.d.cat.color}
			/>
		{/each}
	</g>

	<text class="axis-title" x={(margin.left + width - margin.right) / 2} y={height - 30} text-anchor="middle">
		<tspan>Change in driving distance to nearest abortion clinic (miles)</tspan>
		<tspan class="axis-sub" x={(margin.left + width - margin.right) / 2} dy="18">May 2022 → July 2026</tspan>
	</text>
	<text
		class="axis-title"
		transform="translate(16,{(margin.top + height - margin.bottom) / 2}) rotate(-90)"
		text-anchor="middle"
	>
		OB-GYNs per 10,000 women ages 15–44 (2023)
	</text>
</svg>

<style>
	svg {
		display: block;
		width: 100%;
		height: auto;
		touch-action: none;
	}
	.plot-bg {
		fill: #ffffff;
		stroke: #e5e7eb;
	}
	.ref {
		stroke: #9ca3af;
		stroke-width: 1;
		stroke-dasharray: 4 3;
		pointer-events: none;
	}
	.ref-label {
		font-size: 13px;
		fill: #6b7280;
		pointer-events: none;
	}
	.dots circle {
		fill-opacity: 0.7;
		/* thin dark ring so the near-white category stays visible */
		stroke: rgba(31, 35, 40, 0.45);
		stroke-width: 0.5;
		pointer-events: none;
	}
	.dots circle.dim {
		opacity: 0.12;
	}
	.brush {
		pointer-events: none;
	}
	.brush :global(*) {
		pointer-events: none;
	}
	.brush-mode .brush,
	.brush-mode .brush :global(*) {
		pointer-events: all;
	}
	.brush :global(.selection) {
		fill: #1f2328;
		fill-opacity: 0.06;
		stroke: #1f2328;
		stroke-dasharray: 3 2;
	}
	.emphasis circle {
		stroke: #111827;
		stroke-width: 2;
		paint-order: stroke;
		pointer-events: none;
	}
	.emphasis circle.selected {
		stroke-dasharray: 3 1.5;
	}
	.axis :global(text) {
		font-size: 14px;
		fill: #4b5563;
	}
	.axis :global(path),
	.axis :global(line) {
		stroke: #9ca3af;
	}
	.axis-sub {
		font-weight: 400;
		fill: #4b5563;
	}
	.axis-title {
		font-size: 14.5px;
		fill: #1f2328;
		font-weight: 600;
	}
</style>
