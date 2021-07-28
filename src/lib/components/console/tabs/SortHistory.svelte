<script lang="ts">
	import PastSort from '$lib/components/PastSort.svelte';
	import type GameLite from '$lib/game';
	import { historyStore } from '$lib/utils/stores';
	import { getContext } from 'svelte';

	export let game: GameLite;
	export let recallSort: (sort: Sort) => void;
	export let closed: boolean;

	const { deleteSort, renameSort } = getContext<HistoryContext>('HISTORY_CONTEXT');

	let sortHist: Sort[];

	historyStore.subscribe((val) => (sortHist = val));
</script>

<div class="console" class:hidden={closed}>
	{#each sortHist as sort}
		<PastSort {sort} disabled={game.sortsActive} on:blur={() => renameSort(sort)} recall={() => recallSort(sort)} del={() => deleteSort(sort)} />
	{/each}
</div>

<style>
	.console {
		color: white;
		background: rgba(0, 0, 0, 0);
		padding: 0.5em 1em;
		display: flex;
		flex-direction: row;
		overflow-x: scroll;
	}

	.console.hidden {
		display: none;
	}

	.console::-webkit-scrollbar {
		height: 0;
	}
</style>
