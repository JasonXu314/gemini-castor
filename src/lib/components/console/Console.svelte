<script lang="ts">
	import type GameLite from '$lib/game';
	import type MySocket from '$lib/utils/sock';
	import Button from '../Button.svelte';
	import GeneralInfo from './tabs/GeneralInfo.svelte';
	import LiveSession from './tabs/LiveSession.svelte';
	import Selectors from './tabs/Selectors.svelte';
	import SortHistory from './tabs/SortHistory.svelte';

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
</script>

<div class="main" class:collapsed>
	<div class="nav">
		<Button type="tab" on:click={() => (collapsed = !collapsed)}>Collapse</Button>
		<Button type="tab" on:click={() => (tabNum = 0)}>General Info</Button>
		<Button type="tab" on:click={() => (tabNum = 1)}>Selectors</Button>
		<Button type="tab" on:click={() => (tabNum = 2)}>History</Button>
		<Button type="tab" on:click={() => (tabNum = 3)}>Live Session</Button>
	</div>
	<div class="body" class:hidden={collapsed}>
		<GeneralInfo closed={tabNum !== 0} {game} />
		<Selectors closed={tabNum !== 1} {game} />
		<SortHistory closed={tabNum !== 2} {recallSort} {game} />
		<LiveSession closed={tabNum !== 3} {game} {socket} {socketId} {liveSession} />
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
