<script lang="ts">
	import type GameLite from '$lib/game';
	import { Vector3 } from '$lib/utils/babylon';
	import { LINE_BLACK, LINE_WHITE, STEEL, WHITE } from '$lib/utils/constants';
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

	let inSession: boolean, inControl: boolean;

	let collapsed: boolean = false,
		tabNum: number = 0,
		background = STEEL,
		camera: 'uni' | 'arc' = 'uni';

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

	function toggleBackground() {
		background = background === STEEL ? WHITE : STEEL;
		game.scene.clearColor = background;
		game.xAxis.color = background === STEEL ? LINE_WHITE : LINE_BLACK;
		game.yAxis.color = background === STEEL ? LINE_WHITE : LINE_BLACK;
		game.zAxis.color = background === STEEL ? LINE_WHITE : LINE_BLACK;
	}

	function toggleCamera() {
		camera = camera === 'uni' ? 'arc' : 'uni';
		game.setCam(camera);
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
		<Button type="tab" on:click={toggleBackground}>BG: {background === STEEL ? 'steel' : 'white'}</Button>
		<Button type="tab" on:click={toggleCamera}
			>Cam: {camera === 'arc' ? 'Arc Rotate Camera' : 'Universal Camera'}</Button
		>
	</div>
	<div class="body" class:hidden={collapsed}>
		<GeneralInfo closed={tabNum !== 0} {game} />
		<Selectors closed={tabNum !== 1} {game} {inSession} {inControl} {socket} />
		<RegionHighlights closed={tabNum !== 2} {game} />
		<SortHistory closed={tabNum !== 3} {recallSort} {game} {inSession} {inControl} />
		<ViewHistory closed={tabNum !== 4} {recallView} {game} />
		<LiveSession closed={tabNum !== 5} {game} {socket} {socketId} {liveSession} bind:inSession bind:inControl />
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
