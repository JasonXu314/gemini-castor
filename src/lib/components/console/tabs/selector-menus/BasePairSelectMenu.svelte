<script lang="ts">
	import type GameLite from '$lib/game';
	import Button from '../../../Button.svelte';
	import FancyInput from '../../../FancyInput.svelte';
	import Slider from '../../../Slider.svelte';

	export let game: GameLite;
	export let closed: boolean;

	let regions: string = '',
		radius: number = 500,
		locked: boolean = false,
		errMsg: string | null = null;
	let debounce: number = typeof window === 'undefined' ? -1 : window.setTimeout(tryUpdate, 5000);

	game.events.on('RECALL_SORT', (sort: Sort) => {
		if (sort.bpsSelect) {
			regions = game.bpsSelect.regions;
			radius = game.bpsSelect.radius;
		}
	});

	$: if (game && !game.bpsSelect.locked) game.bpsSelect.updateRadius(radius);
	$: {
		if (game) {
			game.bpsSelect.onReset = resetParams;
			game.events.on('RESET', resetParams);
			game.events.on('ACTIVE', () => {
				if (!game.bpsSelect.active) {
					resetParams();
				}
			});
		}
	}

	function resetParams() {
		regions = '';
		radius = 500;
		locked = false;
	}

	function set() {
		if (!locked && regions !== '') {
			game.bpsSelect.finalize();
			locked = true;
		}
	}

	function search() {
		if (locked) {
			game.executeSearches();
		}
	}

	function tryUpdate() {
		try {
			clearTimeout(debounce);
			game.bpsSelect.updateRegion(regions);
		} catch (err: unknown) {
			if (err instanceof Error) {
				errMsg = err.message;
			}
		} finally {
			debounce = window.setTimeout(tryUpdate, 5000);
		}
	}

	function resetDebounce() {
		clearTimeout(debounce);
		debounce = window.setTimeout(tryUpdate, 5000);
		errMsg = null;
	}
</script>

<div class="main" class:hidden={closed}>
	<FancyInput dark id="chrs" label="Chromosome Segments" on:blur={tryUpdate} on:change={resetDebounce} bind:value={regions} />
	{#if errMsg}
		<div class="err">{errMsg}</div>
	{/if}
	<div class="slider-row">
		<Slider dark disabled={locked} min={0} max={1000} label="Radius" bind:value={radius} />
	</div>
	<div class="btn-row">
		<Button type="action" on:click={set}>Set!</Button>
		<Button type="action" disabled={!locked} on:click={search}>Search!</Button>
	</div>
</div>

<style>
	.main {
		padding: 0.25em 1em 0.25em 0.5em;
	}

	.main.hidden {
		display: none;
	}

	.main .slider-row {
		margin: 0.5em 0;
	}

	.main .btn-row {
		margin: 0.75em 0 0;
	}

	.err {
		color: red;
		padding: 0.5em 0;
	}
</style>
