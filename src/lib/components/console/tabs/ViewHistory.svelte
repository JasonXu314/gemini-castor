<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import FancyInput from '$lib/components/FancyInput.svelte';
	import PastView from '$lib/components/PastView.svelte';
	import type GameLite from '$lib/game';
	import { BACKEND_URL } from '$lib/utils/constants';
	import { viewStore } from '$lib/utils/stores';
	import axios from 'axios';
	import { getContext } from 'svelte';
	import { v4 as uuid } from 'uuid';

	export let game: GameLite;
	export let recallView: (view: View) => void;
	export let closed: boolean;

	const { renameView, deleteView } = getContext<ViewContext>('VIEW_CONTEXT');

	let viewHist: View[] = [],
		viewName: string = `View ${viewHist.length + 1}`,
		errMsg: string | null = null;

	viewStore.subscribe((val) => (viewHist = val));

	$: {
		if (/^View \d+$/.test(viewName)) {
			viewName = `View ${viewHist.length + 1}`;
		}
	}

	function saveView() {
		if (viewName.trim().length > 0) {
			const { x, y, z } = game.camera.position;
			const { x: rx, y: ry, z: rz } = game.camera.rotation;
			const view = { _id: uuid(), name: viewName.trim(), pos: { x, y, z }, rot: { x: rx, y: ry, z: rz } };
			axios.post<View[]>(`${BACKEND_URL}/views`, {
				id: game.rawData.id,
				view
			});
			viewStore.update((prevViews) => [...prevViews, view]);
			errMsg = null;
		} else {
			errMsg = 'View name must not be empty!';
		}
	}

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
	<div class="controls">
		<FancyInput id="view-name" label="View Name" bind:value={viewName} dark />
		<Button on:click={saveView} type="action">Save View</Button>
		{#if errMsg}
			<div class="err">{errMsg}</div>
		{/if}
	</div>
	{#each viewHist as view}
		<PastView
			{view}
			disabled={game.sortsActive}
			rename={(newName) => {
				try {
					renameView({ ...view, name: newName });
					errMsg = null;
				} catch (err) {
					errMsg = err.message;
					throw new Error();
				}
			}}
			recall={() => recallView(view)}
			del={() => deleteView(view)}
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

	.console .controls {
		margin-right: 1em;
	}

	.err {
		color: red;
	}
</style>
