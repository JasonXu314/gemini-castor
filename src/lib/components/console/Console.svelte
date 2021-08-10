<script lang="ts">
	import type GameLite from '$lib/game';
	import { Vector3 } from '$lib/utils/babylon';
	import type MySocket from '$lib/utils/sock';
	import Button from '../Button.svelte';
	import GeneralInfo from './tabs/GeneralInfo.svelte';
	import LiveSession from './tabs/LiveSession.svelte';
	import RegionHighlights from './tabs/RegionHighlights.svelte';
	import Selectors from './tabs/Selectors.svelte';
	import SortHistory from './tabs/SortHistory.svelte';
	import ViewHistory from './tabs/ViewHistory.svelte';

	export let game: GameLite;
	export let socket: MySocket<SocketReceiveMsgs, SocketSendMsgs>;
	export let socketId: string;
	export let liveSession: LiveSessionData | null;

	let collapsed: boolean = false,
		tabNum: number = 0;

	function recallSort(sort: Sort) {
		tabNum = 1;
		game.events.dispatch('RECALL_SORT', sort);
	}

	function recallView(view: View) {
		const { x, y, z } = view.pos;
		const { x: rx, y: ry, z: rz } = view.rot;
		game.camera.position = new Vector3(x, y, z);
		game.camera.rotation = new Vector3(rx, ry, rz);
	}
</script>

<div class="main" class:collapsed>
	<div class="nav">
		<Button type="tab" on:click={() => (collapsed = !collapsed)}>Collapse</Button>
		<Button type="tab" on:click={() => (tabNum = 0)}>General Info</Button>
		<Button type="tab" on:click={() => (tabNum = 1)}>Selectors</Button>
		<Button type="tab" on:click={() => (tabNum = 2)}>Highlights</Button>
		<Button type="tab" on:click={() => (tabNum = 3)}>History</Button>
		<Button type="tab" on:click={() => (tabNum = 4)}>Views</Button>
		<Button type="tab" on:click={() => (tabNum = 5)}>Live Session</Button>
	</div>
	<div class="body" class:hidden={collapsed}>
		<GeneralInfo closed={tabNum !== 0} {game} />
		<Selectors closed={tabNum !== 1} {game} />
		<RegionHighlights closed={tabNum !== 2} {game} />
		<SortHistory closed={tabNum !== 3} {recallSort} {game} />
		<ViewHistory closed={tabNum !== 4} {recallView} {game} />
		<LiveSession closed={tabNum !== 5} {game} {socket} {socketId} {liveSession} />
	</div>
</div>

<style>
	.main {
		position: absolute;
		display: flex;
		flex-direction: column;
		bottom: 0;
		left: 0;
		background: rgba(0, 0, 0, 0.5);
		width: 100%;
	}

	.hidden {
		display: none;
	}

	.main .nav {
		display: flex;
		flex-direction: row;
		border-bottom: 1px solid white;
		background: black;
	}

	.main .body {
		min-height: 10em;
	}
</style>
