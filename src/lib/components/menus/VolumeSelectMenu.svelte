<script lang="ts">
	import type GameLite from '$lib/game';
	import type { EventSrc } from '$lib/utils/utils';
	import Button from '../Button.svelte';
	import Slider from '../Slider.svelte';

	export let closed: boolean = true;
	export let game: GameLite;
	export let events: EventSrc<MainEvents>;

	let maxX: number = 1000,
		minX: number = -1000,
		maxY: number = 1000,
		minY: number = -1000,
		maxZ: number = 1000,
		minZ: number = -1000,
		locked: boolean = true,
		selecting: boolean = false,
		set: boolean = false,
		showGuide: boolean = false;

	$: if (game && maxX > minX && maxX <= game.structure.maxX) {
		game.volSelect.updateBound('maxX', Number(maxX));
	}
	$: if (game && minX < maxX && minX >= game.structure.minX) {
		game.volSelect.updateBound('minX', Number(minX));
	}
	$: if (game && maxY > minY && maxY <= game.structure.maxY) {
		game.volSelect.updateBound('maxY', Number(maxY));
	}
	$: if (game && minY < maxY && minY >= game.structure.minY) {
		game.volSelect.updateBound('minY', Number(minY));
	}
	$: if (game && maxZ > minZ && maxZ <= game.structure.maxZ) {
		game.volSelect.updateBound('maxZ', Number(maxZ));
	}
	$: if (game) {
		game.volSelect.updateBound('minZ', minZ);
	}

	events.on('RECALL_SORT', (sort: Sort) => {
		if (sort.volSelect) {
			game.volSelect.start();
			maxX = sort.volSelect.maxX;
			minX = sort.volSelect.minX;
			maxY = sort.volSelect.maxY;
			minY = sort.volSelect.minY;
			maxZ = sort.volSelect.maxZ;
			minZ = sort.volSelect.minZ;
			selecting = true;
			locked = false;
		}
	});

	$: {
		if (selecting && !showGuide) {
			showGuide = true;
		} else if (game) {
			game.volSelect.setGuideShown(showGuide);
		}
	}

	$: {
		if (game) {
			game.volSelect.onReset = resetParams;
			game.events.on('RESET', resetParams);
			game.events.on('ACTIVE', () => {
				if (!game.volSelect.active) {
					resetParams();
				}
			});
		}
	}

	function resetParams() {
		maxX = 1000;
		maxY = 1000;
		maxZ = 1000;
		minX = -1000;
		minY = -1000;
		minZ = -1000;
		set = false;
		selecting = false;
		showGuide = false;
		locked = true;
	}

	function search() {
		if (game && set) {
			game.executeSearches();
		}
	}

	function start() {
		if (!selecting && !set && game && !game.volSelect.active) {
			game.volSelect.start();
			selecting = true;
			locked = false;
		} else if (set && !game.volSelect.active) {
			game.volSelect.reset();
			game.volSelect.start();
			selecting = true;
			set = false;
		}
	}

	function finalize() {
		if (game.volSelect.placingSelector) {
			game.volSelect.finalize();
			set = true;
			selecting = false;
		}
	}

	function cancel() {
		if (game.volSelect.placingSelector) {
			game.volSelect.cancel();
			resetParams();
		}
	}

	function reset() {
		if (game.volSelect.locked && !game.volSelect.active) {
			game.volSelect.reset();
		}
	}
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
		<div>Volume Selector</div>
	</div>
	{#if !closed}
		<div class="content">
			<Slider
				disabled={set || locked}
				min={Math.floor(game.structure.minX)}
				max={Math.ceil(game.structure.maxX)}
				label="Maximum X"
				softMin={minX}
				bind:value={maxX}
			/>
			<Slider
				disabled={set || locked}
				min={Math.floor(game.structure.minY)}
				max={Math.ceil(game.structure.maxY)}
				label="Maximum Y"
				softMin={minY}
				bind:value={maxY}
			/>
			<Slider
				disabled={set || locked}
				min={Math.floor(game.structure.minZ)}
				max={Math.ceil(game.structure.maxZ)}
				label="Maximum Z"
				softMin={minZ}
				bind:value={maxZ}
			/>
			<Slider
				disabled={set || locked}
				min={Math.floor(game.structure.minX)}
				max={Math.ceil(game.structure.maxX)}
				label="Minimum X"
				softMax={maxX}
				bind:value={minX}
			/>
			<Slider
				disabled={set || locked}
				min={Math.floor(game.structure.minY)}
				max={Math.ceil(game.structure.maxY)}
				label="Minimum Y"
				softMax={maxY}
				bind:value={minY}
			/>
			<Slider
				disabled={set || locked}
				max={Math.ceil(game.structure.maxZ)}
				min={Math.floor(game.structure.minZ)}
				label="Minimum Z"
				softMax={maxZ}
				bind:value={minZ}
			/>
			<div class="button-row">
				<Button type={selecting ? 'cancel' : 'action'} on:click={selecting ? cancel : start}>{selecting ? 'Cancel' : 'Place!'}</Button>
				<Button type={set ? 'cancel' : 'action'} on:click={set ? reset : finalize}>{set ? 'Reset' : 'Set!'}</Button>
				<Button type="action" on:click={search}>Search!</Button>
			</div>
			<div class="check-row">
				<label for="guidemesh-box">Show Guide Mesh?</label>
				<input type="checkbox" id="guidemesh-box" bind:checked={showGuide} />
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

	.main .content .slider-row input {
		transform: translateY(0.2em);
	}

	.main .content .button-row {
		display: flex;
		flex-direction: row;
	}

	.main .content .check-row {
		margin-top: 0.2em;
	}
</style>
