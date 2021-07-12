<script lang="ts">
	import type GameLite from '$lib/game';
	import type { EventSrc } from '$lib/utils/utils';
	import Button from '../Button.svelte';
	import FancyInput from '../FancyInput.svelte';
	import Slider from '../Slider.svelte';

	export let closed: boolean = true;
	export let game: GameLite;
	export let events: EventSrc<MainEvents>;

	let chrRange: string = '',
		radius: number = 500,
		locked: boolean = false,
		errMsg: string | null = null,
		debounce: number = typeof window === 'undefined' ? -1 : window.setTimeout(tryUpdate, 5000);

	events.on('RECALL_SORT', (sort: Sort) => {
		if (sort.bpsSelect) {
			chrRange = sort.bpsSelect.regions;
			radius = sort.bpsSelect.radius;
			locked = false;
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
		chrRange = '';
		radius = 500;
		locked = false;
	}

	function set() {
		if (!locked && chrRange !== '') {
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
			game.bpsSelect.updateRegion(chrRange);
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
		<div>Base Pair Selector</div>
	</div>
	{#if !closed}
		<div class="content">
			<FancyInput id="chrs" label="Chromosome Segments" on:blur={tryUpdate} on:change={resetDebounce} bind:value={chrRange} />
			{#if errMsg}
				<div class="err">{errMsg}</div>
			{/if}
			<Slider disabled={locked} min={0} max={1000} label="Radius" bind:value={radius} />
			<Button type="action" on:click={set}>Set!</Button>
			<Button type="action" disabled={!locked} on:click={search}>Search!</Button>
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

	.err {
		color: red;
	}
</style>
