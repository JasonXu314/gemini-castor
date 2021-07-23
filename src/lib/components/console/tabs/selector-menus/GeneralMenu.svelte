<script lang="ts">
	import type GameLite from '$lib/game';

	export let game: GameLite;
	export let closed: boolean;

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

<div class="main" class:hidden={closed}>
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

<style>
	.main {
		padding: 0.25em 1em 0.25em 0.5em;
	}

	.main.hidden {
		display: none;
	}
</style>
