<script>
	import { DIST_CLASSES, SUPPLY_CLASSES, PALETTE, MISSING, EXCLUDED, inkOn, categoryLabel } from '#lib/categories.js';
	import { fmtInt } from '#lib/format.js';

	/**
	 * @type {{ counts: Map<string, number>, missingCount: number, showExcluded: boolean,
	 *          selectedKey: string | null, onselect: (key: string) => void }}
	 * counts = eligible counties per category (hover never changes them).
	 */
	let { counts, missingCount, showExcluded, selectedKey, onselect } = $props();

	// Rows top → bottom = supply high → none, matching the scatterplot's y-axis.
	const rows = [0, 1, 2];
	const cols = [0, 1, 2];
</script>

<figure class="legend" aria-label="Bivariate legend">
	<div class="grid">
		<div class="y-title">↑ OB-GYNs per 10,000 women 15–44 (2023)</div>
		{#each rows as s (s)}
			<div class="row-label" style="grid-row: {s + 2}">{SUPPLY_CLASSES[s].label}</div>
			{#each cols as d (d)}
				{@const color = PALETTE[s][d]}
				{@const key = `${d}-${s}`}
				<button
					type="button"
					class="cell"
					class:highlight={s === 2 && d === 2}
					class:active={selectedKey === key}
					class:faded={selectedKey && selectedKey !== key}
					style="grid-row: {s + 2}; grid-column: {d + 2}; background: {color}; color: {inkOn(color)}"
					aria-pressed={selectedKey === key}
					aria-label="Select {fmtInt(counts.get(key) ?? 0)} counties: {categoryLabel(key)}"
					onclick={() => onselect(key)}
				>
					{fmtInt(counts.get(key) ?? 0)}
				</button>
			{/each}
		{/each}
		{#each cols as d (d)}
			<div class="col-label" style="grid-column: {d + 2}">{DIST_CLASSES[d].label}</div>
		{/each}
		<div class="x-title">Change in driving distance, May 2022–July 2026 →</div>
	</div>
	<figcaption>
		Numbers are eligible counties per category. Click a cell to select that category.
		<span class="missing">
			<svg width="16" height="16" aria-hidden="true">
				<defs>
					<pattern id="legend-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
						<rect width="4" height="4" fill={MISSING.fill} />
						<line x1="0" y1="0" x2="0" y2="4" stroke={MISSING.hatch} stroke-width="1.5" />
					</pattern>
				</defs>
				<rect x="0.5" y="0.5" width="15" height="15" fill="url(#legend-hatch)" stroke="#9ca3af" />
			</svg>
			{MISSING.label} on map ({missingCount} shapes)
		</span>
		{#if showExcluded}
			<span class="missing">
				<svg width="16" height="16" aria-hidden="true">
					<rect x="0.5" y="0.5" width="15" height="15" fill={EXCLUDED.fill} stroke={EXCLUDED.stroke} />
				</svg>
				{EXCLUDED.label}
			</span>
		{/if}
	</figcaption>
</figure>

<style>
	.legend {
		margin: 0;
		font-size: 12px;
		color: #374151;
	}
	.grid {
		display: grid;
		grid-template-columns: auto repeat(3, minmax(0, 5.2rem));
		max-width: 100%;
		grid-template-rows: auto repeat(3, 2.2rem) auto auto;
		gap: 2px;
		align-items: center;
	}
	.y-title {
		grid-column: 1 / -1;
		grid-row: 1;
		font-weight: 600;
		font-size: 11px;
		padding-bottom: 2px;
	}
	.row-label {
		grid-column: 1;
		text-align: right;
		padding-right: 6px;
		white-space: nowrap;
	}
	.cell {
		font: inherit;
		border: 0;
		padding: 0;
		cursor: pointer;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-variant-numeric: tabular-nums;
		font-size: 11px;
		border-radius: 2px;
	}
	.cell.highlight {
		box-shadow: 0 0 0 2px #1f2328;
		font-weight: 700;
	}
	.cell.faded {
		opacity: 0.35;
	}
	.cell.active {
		box-shadow:
			0 0 0 2px #ffffff,
			0 0 0 4px #1f2328;
		font-weight: 700;
	}
	.cell:focus-visible {
		outline: 3px solid #2563eb;
		outline-offset: 2px;
	}
	.col-label {
		grid-row: 5;
		text-align: center;
		line-height: 1.2;
		padding-top: 3px;
	}
	.x-title {
		grid-row: 6;
		grid-column: 2 / 5;
		text-align: center;
		font-weight: 600;
		font-size: 11px;
	}
	figcaption {
		margin-top: 8px;
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		align-items: center;
		color: #4b5563;
	}
	.missing {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
</style>
