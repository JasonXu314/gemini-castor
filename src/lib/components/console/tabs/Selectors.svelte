<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import type GameLite from '$lib/game';
	import type MySocket from '$lib/utils/sock';
	import BasePairSelectMenu from './selector-menus/BasePairSelectMenu.svelte';
	import GeneralMenu from './selector-menus/GeneralMenu.svelte';
	import RadiusSelectMenu from './selector-menus/RadiusSelectMenu.svelte';
	import VolumeSelectMenu from './selector-menus/VolumeSelectMenu.svelte';

	export let game: GameLite;
	export let closed: boolean;
	export let inSession: boolean;
	export let inControl: boolean;
	export let socket: MySocket<SocketReceiveMsgs, SocketSendMsgs>;

	let openMenu: number = 0;

	const titles = ['General Menu', 'Radius Selector', 'Volume Selector', 'Base Pair Selector'];
</script>

<div class="console" class:hidden={closed}>
	<div class="titles">
		{#each titles as title, i}
			<div class="title" class:selected={i === openMenu} on:click={() => (openMenu = i)}>{title}</div>
		{/each}
	</div>
	<div class="content">
		<GeneralMenu {game} closed={openMenu !== 0} />
		<RadiusSelectMenu {game} closed={openMenu !== 1} {inSession} {inControl} {socket} />
		<VolumeSelectMenu {game} closed={openMenu !== 2} {inSession} {inControl} />
		<BasePairSelectMenu {game} closed={openMenu !== 3} {inSession} {inControl} />
	</div>
	<div class="btns">
		<Button
			type="cancel"
			on:click={() => {
				if (game && game.sortsActive) {
					game.reset();
				}
			}}>Clear All</Button
		>
	</div>
</div>

<style>
	.console {
		color: white;
		background: rgba(0, 0, 0, 0);
		padding: 0.5em 1em;
		display: flex;
		flex-direction: row;
	}

	.console.hidden {
		display: none;
	}

	.console .titles .title {
		color: white;
		background: rgba(0, 0, 0, 0);
		padding: 0.25em 0.5em;
		border: 1px solid white;
		margin-bottom: -1px;
		cursor: pointer;
	}

	.console .titles .title.selected {
		border-right: none;
	}

	.console .content {
		border: 1px solid white;
		border-left: none;
		margin-left: -1px;
		position: relative;
	}

	.console .content::after {
		content: '';
		position: absolute;
		left: 0;
		bottom: 0;
		border-left: 1px solid white;
		height: calc(100% + 1px - 4 * (1.5em + 3px));
	}

	.console .btns {
		display: flex;
		flex-direction: column;
		margin-left: 1em;
	}
</style>
