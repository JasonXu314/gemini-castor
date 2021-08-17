<script lang="ts">
	import PastSort from '$lib/components/PastSort.svelte';
	import type GameLite from '$lib/game';
	import { historyStore } from '$lib/utils/stores';
	import { getContext } from 'svelte';

	export let game: GameLite;
	export let recallSort: (sort: Sort) => void;
	export let closed: boolean;
	export let inSession: boolean;
	export let inControl: boolean;

	const { deleteSort, renameSort } = getContext<HistoryContext>('HISTORY_CONTEXT');

	let sortHist: Sort[];

	historyStore.subscribe((val) => (sortHist = val));

	type ScrollEvent = WheelEvent & {
		currentTarget: EventTarget & HTMLDivElement;
	};

	function scroll(evt: ScrollEvent) {
		if (evt.deltaY !== 0 && evt.deltaX === 0 && !evt.shiftKey) {
			evt.currentTarget.scrollBy({ left: evt.deltaY });
		}
	}
</script>

<div class="console" class:hidden={closed} on:wheel={scroll}>
	{#each sortHist as sort}
		<PastSort
			{sort}
			disabled={game.sortsActive || (inSession && !inControl)}
			rename={(newName) => {
				try {
					renameSort({ ...sort, name: newName });
				} catch (err) {
					alert(err.message);
					throw new Error();
				}
			}}
			recall={() => recallSort(sort)}
			del={() => deleteSort(sort)}
		/>
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
