<script lang="ts">
	import type GameLite from '$lib/game';

	export let closed: boolean = true;
	export let game: GameLite;

	let showAxes: boolean = true,
		showStruct: boolean = true,
		showCompartments: boolean = true,
		showArcs: boolean = true,
		showFlags: boolean = true,
		showAnnotations: boolean = true;

	$: {
		if (game) {
			game.structure.events.on('COMP_SHOW', () => {
				showCompartments = true;
			});
			game.structure.events.on('STRUCT_SHOW', () => {
				showStruct = true;
			});
			game.epiData.events.on('ARC_SHOW', () => {
				showArcs = true;
			});
			game.epiData.events.on('FLAG_SHOW', () => {
				showFlags = true;
			});
		}
	}

	$: if (game) game.setAxesShown(showAxes);
	$: if (game) game.structure.setStructShown(showStruct);
	$: if (game) game.structure.setCompartmentsShown(showCompartments);
	$: if (game) game.epiData.setFlagsShown(showFlags);
	$: if (game) game.epiData.setArcsShown(showArcs);
	$: if (game) game.epiData.setAnnotationsShown(showAnnotations);
</script>

<div class="main">
	<div
		class="title"
		on:click={() => {
			closed = !closed;
		}}
	>
		{#if closed}
			<img class="arrow" src="/images/triangle-right-arrow.svg" alt="" />
		{:else}
			<img class="arrow" src="/images/triangle-top-arrow.svg" alt="" />
		{/if}
		<div>General Settings</div>
	</div>
	{#if !closed}
		<div class="content">
			<div class="check-row">
				<label for="axes-box">Show Coordinate Axes</label>
				<input type="checkbox" id="axes-box" bind:checked={showAxes} />
			</div>
			<div class="check-row">
				<label for="struct-box">Show Structure</label>
				<input type="checkbox" id="struct-box" bind:checked={showStruct} />
			</div>
			<div class="check-row">
				<label for="comp-box">Show A/B Compartment Data</label>
				<input type="checkbox" id="comp-box" bind:checked={showCompartments} />
			</div>
			<div class="check-row">
				<label for="arc-box">Show Arcs</label>
				<input type="checkbox" id="arc-box" bind:checked={showArcs} />
			</div>
			<div class="check-row">
				<label for="flag-box">Show Flags</label>
				<input type="checkbox" id="flag-box" bind:checked={showFlags} />
			</div>
			<div class="check-row">
				<label for="ann-box">Show Annotations</label>
				<input type="checkbox" id="ann-box" bind:checked={showAnnotations} />
			</div>
		</div>
	{/if}
</div>

<style>
	.main {
		border: 1px solid black;
		padding: 0.25em 1em 0.25em 0.5em;
	}

	.main .title {
		cursor: pointer;
		display: flex;
		flex-direction: row;
		padding-right: 0.5em;
	}

	.main .title .arrow {
		max-height: 1em;
		max-width: 1em;
		margin-right: 0.25em;
	}

	.main .title div {
		min-width: max-content;
	}

	.main .content {
		padding-left: 1em;
		margin-top: 0.2em;
	}
</style>
