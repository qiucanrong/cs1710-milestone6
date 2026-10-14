<script>
	import Map from '#lib/components/Map.svelte';
	import Scatterplot from '#lib/components/Scatterplot.svelte';
	import Legend from '#lib/components/Legend.svelte';
	import { classify, categoryLabel, DIST_BREAK, SUPPLY_BREAK } from '#lib/categories.js';
	import { hasPlottedValues } from '#lib/parse.js';
	import { NO_SELECTION, FILTERS, passesFilter, selectedFips, describeSelection } from '#lib/selection.js';
	import { fmtInt, fmtMiles, fmtChange, fmtRate } from '#lib/format.js';

	let { data } = $props();

	// ---- shared data (components receive already-classified records)
	let shapes = $derived(data.shapes.map((s) => ({ ...s, cat: classify(s.datum) })));
	let rows = $derived(data.scatterRows.map((d) => ({ ...d, cat: classify(d) })));
	let recordByFips = $derived(new globalThis.Map(data.counties.map((d) => [d.fips, d])));

	// ---- shared interaction state: the single source of truth
	let filter = $state('all'); // 'all' | 'metro' | 'nonmetro'
	let selection = $state(NO_SELECTION); // {mode:'none'|'county'|'category'|'brush', ...criteria}
	let hoverFips = $state(null); // temporary emphasis only
	let plotMode = $state('inspect'); // scatterplot: 'inspect' (hover/click) | 'brush' (drag)
	let search = $state('');

	// ---- derived from state (never stored separately)
	let eligible = $derived(rows.filter((d) => passesFilter(d, filter)));
	let eligibleFips = $derived(new Set(eligible.map((d) => d.fips)));
	let selected = $derived(selectedFips(selection, eligible)); // Set | null
	let focusFips = $derived(selection.mode === 'county' ? selection.fips : null);
	let selectedKey = $derived(selection.mode === 'category' ? selection.key : null);

	let counts = $derived.by(() => {
		const m = new globalThis.Map();
		for (const d of eligible) m.set(d.cat.key, (m.get(d.cat.key) ?? 0) + 1);
		return m;
	});
	let mappedCount = $derived(shapes.filter((s) => s.cat).length);
	let mapMissing = $derived(shapes.filter((s) => !s.cat));
	let notPlotted = $derived(data.counties.filter((d) => !hasPlottedValues(d)));
	let highlightCount = $derived(rows.filter((d) => d.cat.key === '2-2').length);
	let unknownMetro = $derived(rows.filter((d) => d.metro == null).length);

	// ---- county search (keyboard-accessible alternative to clicking the map)
	const name = (d) => `${d.county}, ${d.state_abbr}`;
	let searchOptions = $derived.by(() => {
		const seen = new globalThis.Map();
		for (const d of eligible) seen.set(name(d), (seen.get(name(d)) ?? 0) + 1);
		return eligible
			.map((d) => ({ fips: d.fips, label: seen.get(name(d)) > 1 ? `${name(d)} (${d.fips})` : name(d) }))
			.sort((a, b) => a.label.localeCompare(b.label));
	});
	let labelToFips = $derived(new globalThis.Map(searchOptions.map((o) => [o.label.toLowerCase(), o.fips])));
	let searchMiss = $derived(search.trim() !== '' && !labelToFips.has(search.trim().toLowerCase()));

	function onSearch() {
		const f = labelToFips.get(search.trim().toLowerCase());
		if (f) selection = { mode: 'county', fips: f };
	}

	// ---- callbacks handed to components
	function hover(fips) {
		hoverFips = fips;
	}
	function selectCounty(fips) {
		if (!eligibleFips.has(fips)) return; // excluded / missing-value shapes are not selectable
		selection =
			selection.mode === 'county' && selection.fips === fips ? NO_SELECTION : { mode: 'county', fips };
	}
	function selectCategory(key) {
		selection =
			selection.mode === 'category' && selection.key === key ? NO_SELECTION : { mode: 'category', key };
	}
	function brushed(extent) {
		if (extent) selection = { mode: 'brush', ...extent };
		else if (selection.mode === 'brush') selection = NO_SELECTION;
	}
	function setFilter(id) {
		if (id === filter) return;
		filter = id;
		selection = NO_SELECTION; // also clears the visible brush
		search = '';
	}
	function clearSelection() {
		selection = NO_SELECTION;
		search = '';
	}
	function resetAll() {
		clearSelection();
		filter = 'all';
		plotMode = 'inspect';
		hoverFips = null;
	}

	// ---- details panel: hovered county, else the persistently selected county
	let detailFips = $derived(hoverFips ?? focusFips);
	let detail = $derived(detailFips ? recordByFips.get(detailFips) : null);
	let detailCat = $derived(detail ? classify(detail) : null);
	let detailShape = $derived(detailFips ? shapes.find((s) => s.fips === detailFips) : null);
</script>

<main>
	<header>
		<h1>Abortion-care travel distance and OB-GYN supply</h1>
		<p class="subtitle">
			Explore county-level changes in driving distance from May 2022 to July 2026 alongside
			OB-GYN supply in 2023.
		</p>
		<p class="stats">
			<strong>{fmtInt(rows.length)}</strong> counties plotted in the scatterplot ·
			<strong>{fmtInt(mappedCount)}</strong> coloured on the map ·
			<strong>{fmtInt(highlightCount)}</strong> counties with a ≥{DIST_BREAK}-mile increase and no
			OB-GYNs
		</p>
	</header>

	<section class="card controls" aria-label="Filters and selection">
		<div class="control-group">
			<span class="control-label" id="filter-label">County type</span>
			<div class="segmented" role="group" aria-labelledby="filter-label">
				{#each FILTERS as f (f.id)}
					<button type="button" aria-pressed={filter === f.id} onclick={() => setFilter(f.id)}>
						{f.label}
					</button>
				{/each}
			</div>
			<span class="muted">
				{fmtInt(eligible.length)} eligible counties{#if filter !== 'all'}&nbsp;of {fmtInt(rows.length)}{/if}
				{#if filter === 'all' && unknownMetro}
					· {unknownMetro} with unknown metro status appear only here{/if}
			</span>
		</div>

		<div class="control-group">
			<label class="control-label" for="county-search">Find a county</label>
			<input
				id="county-search"
				type="search"
				list="county-options"
				placeholder="Type a county, e.g. Hinds, MS"
				autocomplete="off"
				bind:value={search}
				oninput={onSearch}
				onchange={onSearch}
				onkeydown={(e) => e.key === 'Enter' && onSearch()}
				aria-describedby="search-hint"
			/>
			<datalist id="county-options">
				{#each searchOptions as o (o.fips)}
					<option value={o.label}></option>
				{/each}
			</datalist>
			<span id="search-hint" class="muted">
				{searchMiss ? 'No eligible county with that name yet — pick one from the list.' : 'Selects the county in both views.'}
			</span>
		</div>

		<div class="control-group status" aria-live="polite">
			<span class="control-label">Selection</span>
			<span class="selection-text">
				{describeSelection(selection, recordByFips)}
			</span>
			<span class="muted">
				{#if selected}
					<strong class="count">{fmtInt(selected.size)}</strong> of {fmtInt(eligible.length)} eligible
					counties selected{#if selection.mode === 'brush' && selected.size === 0}
						&nbsp;— the brush is active but contains no counties{/if}
				{:else}
					All {fmtInt(eligible.length)} eligible counties shown at full strength
				{/if}
			</span>
			<div class="buttons">
				<button type="button" onclick={clearSelection} disabled={selection.mode === 'none'}>
					Clear selection
				</button>
				<button type="button" onclick={resetAll}>Reset all</button>
			</div>
		</div>
	</section>

	<div class="charts">
		<section class="card map-card">
			<h2>Where the categories fall</h2>
			<p class="howto">
				<strong>Hover</strong> a county for details · <strong>click</strong> to select it (click again
				to deselect) · <strong>click a legend cell</strong> to select a whole category.
			</p>
			<Map
				{shapes}
				stateBorders={data.stateBorders}
				nation={data.nation}
				{eligibleFips}
				{selected}
				{hoverFips}
				{focusFips}
				onhover={hover}
				onselect={selectCounty}
			/>
			<Legend
				{counts}
				missingCount={mapMissing.length}
				showExcluded={filter !== 'all'}
				{selectedKey}
				onselect={selectCategory}
			/>
		</section>

		<div class="right-col">
			<section class="card scatter-card">
				<div class="scatter-head">
					<h2>Change in driving distance vs OB-GYN supply</h2>
					<div class="segmented small" role="group" aria-label="Scatterplot pointer mode">
						<button type="button" aria-pressed={plotMode === 'inspect'} onclick={() => (plotMode = 'inspect')}>
							Inspect: hover &amp; click
						</button>
						<button type="button" aria-pressed={plotMode === 'brush'} onclick={() => (plotMode = 'brush')}>
							Brush: drag to select
						</button>
					</div>
				</div>
				<p class="howto">
					{#if plotMode === 'inspect'}
						<strong>Hover</strong> near a dot for details · <strong>click</strong> it to select that county.
						Switch to <em>Brush</em> to drag a selection rectangle.
					{:else}
						<strong>Drag</strong> a rectangle to select counties inside it · drag the rectangle to move it ·
						<strong>click</strong> empty plot space to clear it. Hover details still work.
					{/if}
				</p>
				<Scatterplot
					allRows={rows}
					rows={eligible}
					{selected}
					{hoverFips}
					{focusFips}
					mode={plotMode}
					brushActive={selection.mode === 'brush'}
					onhover={hover}
					onselect={selectCounty}
					onbrush={brushed}
				/>
				<p class="scale-note">
					Square-root scale expands low values; tick labels show original values.
				</p>
				<p class="note">
					One dot per eligible county, full observed range, no jitter. X-axis linear, y-axis square
					root; both stay fixed across filters. Dashed lines mark no change and a +{DIST_BREAK}-mile change in driving distance, and 0 and
					{SUPPLY_BREAK} OB-GYNs per 10,000.
				</p>
			</section>

			<section class="card details" aria-live="polite">
				<h2>
					County details
					{#if detail}<span class="tag">{hoverFips ? 'hovered' : 'selected'}</span>{/if}
				</h2>
				{#if detail}
					<p class="detail-name">
						{#if detailCat}<span class="swatch" style="background: {detailCat.color}"></span>{/if}
						{detail.county}, {detail.state}
					</p>
					<dl>
						<dt>Driving distance, May 2022</dt>
						<dd>{fmtMiles(detail.drive_miles_may2022)}</dd>
						<dt>Driving distance, July 2026</dt>
						<dd>{fmtMiles(detail.drive_miles_jul2026)}</dd>
						<dt>Change in driving distance</dt>
						<dd>{fmtChange(detail.drive_miles_change)}</dd>
						<dt>OB-GYNs per 10k women 15–44 (2023)</dt>
						<dd>{fmtRate(detail.obgyn_per_10k_women)}</dd>
						<dt>Obstetric hospitals (2023)</dt>
						<dd>{detail.ob_hospitals == null ? 'no data' : fmtInt(detail.ob_hospitals)}</dd>
						<dt>County type</dt>
						<dd>{detail.metro == null ? 'unknown' : detail.metro ? 'Metro' : 'Nonmetro'}</dd>
					</dl>
					<p class="muted small-text">
						{#if !detailCat}
							Missing a plotted value, so not in the scatterplot or bivariate categories.
						{:else}
							Category: {categoryLabel(detailCat.key)}.
							{#if !eligibleFips.has(detail.fips)}Outside the current county-type filter.{/if}
						{/if}
					</p>
				{:else if detailShape}
					<p class="detail-name">{detailShape.feature.properties.name}</p>
					<p class="muted">FIPS {detailShape.fips} has a map shape but no county record in the data.</p>
				{:else}
					<p class="muted">
						Hover a county or dot, or select one with a click or the search box, to see its driving
						distances, OB-GYN supply and obstetric hospital count.
					</p>
				{/if}
			</section>
		</div>
	</div>

<section class="card methods">
		<h2>Methods and data notes</h2>
		<ul>
			<li>
				<strong>Measures.</strong> Driving distance is road miles from each county to the nearest open
				abortion clinic (Myers Abortion Facility Database), in May 2022 and July 2026; the charts plot the change between the two (July 2026 minus May
				2022), not the current distance.
				OB-GYN supply is OB-GYNs (MD + DO, non-federal) per 10,000 women ages 15–44, measured once,
				in 2023 (HRSA Area Health Resource File). The two measures come from different years; the
				supply figure is a single snapshot, not a pre-Dobbs baseline, and no change in supply is
				measured.
			</li>
			<li>
				<strong>Categories.</strong> Change in driving distance: ≤0, &gt;0 to &lt;{DIST_BREAK}, ≥{DIST_BREAK}
				miles. Supply: 0, &gt;0 to {SUPPLY_BREAK}, &gt;{SUPPLY_BREAK} per 10,000. These thresholds
				are exploratory choices computed directly from the numeric values; other cut points would
				change the counts.
			</li>
			<li>
				<strong>County type.</strong> Metro = USDA rural–urban code 1–3 (<code>metro</code> = 1);
				nonmetro = <code>metro</code> = 0. {unknownMetro} plotted counties (Connecticut's legacy
				counties) have no metro value; they appear under All counties only.
			</li>
			<li>
				<strong>Interpretation.</strong> The dashboard shows descriptive overlap between the two
				measures. It does not estimate a causal effect of abortion restrictions on OB-GYN supply
				or on health outcomes.
			</li>
			<li>
				<strong>Missing data.</strong>
				{fmtInt(data.counties.length)} county records;
				{notPlotted.length} lack at least one plotted value, so they are left out of the scatterplot and
				are not coloured on the map:
				{notPlotted.map(name).join('; ')}.
			</li>
			<li>
				<strong>Geometry.</strong> County shapes are Census 2017 boundaries (us-atlas). Shapes
				without a complete record are hatched:
				{mapMissing
					.map((s) => (s.datum ? `${name(s.datum)} (no OB-GYN data)` : `${s.feature.properties.name} (FIPS ${s.fips}, no county record)`))
					.join('; ')}.
				{data.unmatched.csvWithoutShape.map(name).join(' and ')} (created in 2019 from Valdez-Cordova)
				have no shape in this geometry and were not reassigned to another shape. Every county in the
				scatterplot appears on the map.
			</li>
		</ul>
	</section>
</main>

<style>
	main {
		max-width: 1400px;
		margin: 0 auto;
		padding: 24px 16px 48px;
	}
	h1 {
		margin: 0 0 4px;
		font-size: clamp(1.4rem, 2.6vw, 2rem);
		line-height: 1.2;
	}
	.subtitle {
		margin: 0 0 8px;
		color: var(--ink-2);
		font-size: 1.05rem;
	}
	.stats {
		margin: 0 0 16px;
		color: var(--ink-2);
		font-size: 0.95rem;
	}
	.stats strong {
		color: var(--ink);
	}
	.charts {
		display: grid;
		grid-template-columns: minmax(0, 55fr) minmax(0, 45fr);
		gap: 16px;
		align-items: start;
	}
	@media (max-width: 900px) {
		.charts {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.card {
		background: var(--card);
		border: 1px solid var(--rule);
		border-radius: 8px;
		padding: 16px;
	}
	.card h2 {
		margin: 0 0 10px;
		font-size: 1.05rem;
	}
	.map-card :global(.legend) {
		margin-top: 12px;
	}
	.note {
		margin: 8px 0 0;
		font-size: 0.85rem;
		color: var(--ink-2);
	}
	.methods {
		margin-top: 16px;
	}
	.right-col {
		display: grid;
		gap: 16px;
		min-width: 0;
	}

	/* controls */
	.controls {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 12px 24px;
		margin-bottom: 16px;
	}
	.control-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}
	.control-label {
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--ink-2);
	}
	.muted {
		color: var(--ink-2);
		font-size: 0.85rem;
	}
	.selection-text {
		font-weight: 600;
		min-height: 3em; /* reserve 2 lines so the buttons below don't jump */
	}
	.status .muted {
		min-height: 2.6em;
	}
	.count {
		color: var(--ink);
	}
	.segmented {
		display: inline-flex;
		flex-wrap: wrap;
		border: 1px solid #c7cbd1;
		border-radius: 6px;
		overflow: hidden;
		width: fit-content;
		max-width: 100%;
	}
	.segmented button {
		border: 0;
		border-radius: 0;
	}
	.segmented button + button {
		border-left: 1px solid #c7cbd1;
	}
	.segmented button[aria-pressed='true'] {
		background: var(--ink);
		color: #ffffff;
	}
	.segmented.small button {
		font-size: 0.8rem;
		padding: 4px 8px;
	}
	button {
		font: inherit;
		font-size: 0.9rem;
		padding: 6px 12px;
		background: #ffffff;
		color: var(--ink);
		border: 1px solid #c7cbd1;
		border-radius: 6px;
		cursor: pointer;
	}
	button:hover:not(:disabled) {
		background: #f3f4f6;
	}
	.segmented button[aria-pressed='true']:hover {
		background: #374151;
	}
	button:disabled {
		color: #9ca3af;
		cursor: default;
	}
	.buttons {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	input[type='search'] {
		font: inherit;
		font-size: 0.95rem;
		padding: 6px 10px;
		border: 1px solid #c7cbd1;
		border-radius: 6px;
		max-width: 100%;
	}
	:global(:focus-visible) {
		outline: 3px solid #2563eb;
		outline-offset: 2px;
	}

	.scatter-head {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 12px;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 4px;
	}
	.scatter-head h2 {
		margin: 0;
	}
	.scale-note {
		margin: 6px 0 0;
		padding: 6px 10px;
		font-size: 0.85rem;
		background: #f3f4f6;
		border-left: 3px solid #6b7280;
		border-radius: 4px;
		color: var(--ink);
	}
	.howto {
		margin: 0 0 8px;
		font-size: 0.85rem;
		color: var(--ink-2);
	}

	/* details */
	.details {
		min-height: 15rem;
	}
	.details h2 {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.tag {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background: #eef0f3;
		color: var(--ink-2);
		padding: 2px 6px;
		border-radius: 4px;
	}
	.detail-name {
		margin: 0 0 8px;
		font-weight: 700;
		font-size: 1.05rem;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.swatch {
		width: 14px;
		height: 14px;
		border-radius: 3px;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25);
		flex: none;
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 4px 16px;
		margin: 0 0 8px;
		font-size: 0.9rem;
	}
	dt {
		color: var(--ink-2);
	}
	dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}
	.small-text {
		margin: 0;
		font-size: 0.8rem;
	}
	.methods ul {
		margin: 0;
		padding-left: 1.2rem;
		font-size: 0.9rem;
		color: #374151;
	}
	.methods li + li {
		margin-top: 6px;
	}
</style>
