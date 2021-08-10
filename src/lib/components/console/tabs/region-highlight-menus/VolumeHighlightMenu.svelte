<script lang="ts">
	import type GameLite from '$lib/game';
	import Button from '../../../Button.svelte';
	import Slider from '../../../Slider.svelte';

	export let game: GameLite;
	export let closed: boolean;

	let maxX: number = 1000,
		minX: number = -1000,
		maxY: number = 1000,
		minY: number = -1000,
		maxZ: number = 1000,
		minZ: number = -1000,
		selecting: boolean = false,
		showGuide: boolean = false;

	$: if (game && selecting && maxX > minX && maxX <= game.structure.maxX) {
		game.highlights.updateBound('maxX', maxX);
	}
	$: if (game && selecting && minX < maxX && minX >= game.structure.minX) {
		game.highlights.updateBound('minX', minX);
	}
	$: if (game && selecting && maxY > minY && maxY <= game.structure.maxY) {
		game.highlights.updateBound('maxY', maxY);
	}
	$: if (game && selecting && minY < maxY && minY >= game.structure.minY) {
		game.highlights.updateBound('minY', minY);
	}
	$: if (game && selecting && maxZ > minZ && maxZ <= game.structure.maxZ) {
		game.highlights.updateBound('maxZ', maxZ);
	}
	$: if (game && selecting && minZ < maxZ && minZ >= game.structure.minZ) {
		game.highlights.updateBound('minZ', minZ);
	}

	function resetParams() {
		maxX = 1000;
		maxY = 1000;
		maxZ = 1000;
		minX = -1000;
		minY = -1000;
		minZ = -1000;
		selecting = false;
		showGuide = false;
	}

	function start() {
		if (!selecting && game) {
			game.highlights.startVolume();
			selecting = true;
		}
	}

	function create() {
		if (selecting) {
			game.highlights.createVolumeHighlight();
			resetParams();
		}
	}

	function cancel() {
		if (selecting) {
			game.highlights.cancel();
			resetParams();
		}
	}

	function reset() {
		if (selecting) {
			game.highlights.reset();
			resetParams();
		}
	}
</script>

<div class="main" class:hidden={closed}>
	<Slider
		dark
		min={Math.floor(game.structure.minX)}
		max={Math.ceil(game.structure.maxX)}
		label="Maximum X"
		softMin={minX}
		bind:value={maxX}
	/>
	<Slider
		dark
		min={Math.floor(game.structure.minY)}
		max={Math.ceil(game.structure.maxY)}
		label="Maximum Y"
		softMin={minY}
		bind:value={maxY}
	/>
	<Slider
		dark
		min={Math.floor(game.structure.minZ)}
		max={Math.ceil(game.structure.maxZ)}
		label="Maximum Z"
		softMin={minZ}
		bind:value={maxZ}
	/>
	<Slider
		dark
		min={Math.floor(game.structure.minX)}
		max={Math.ceil(game.structure.maxX)}
		label="Minimum X"
		softMax={maxX}
		bind:value={minX}
	/>
	<Slider
		dark
		min={Math.floor(game.structure.minY)}
		max={Math.ceil(game.structure.maxY)}
		label="Minimum Y"
		softMax={maxY}
		bind:value={minY}
	/>
	<Slider
		dark
		max={Math.ceil(game.structure.maxZ)}
		min={Math.floor(game.structure.minZ)}
		label="Minimum Z"
		softMax={maxZ}
		bind:value={minZ}
	/>
	<div class="button-row">
		<Button type={selecting ? 'cancel' : 'action'} on:click={selecting ? cancel : start}
			>{selecting ? 'Cancel' : 'Place!'}</Button
		>
		<Button type="cancel" on:click={reset}>Reset</Button>
		<Button type="action" on:click={create}>Search!</Button>
	</div>
	<div class="check-row">
		<label for="guidemesh-box">Show Guide Mesh?</label>
		<input type="checkbox" id="guidemesh-box" bind:checked={showGuide} />
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
