<script lang="ts">
	import type GameLite from '$lib/game';
	import GeneralMenu from './region-highlight-menus/GeneralMenu.svelte';
	import RadiusHighlightMenu from './region-highlight-menus/RadiusHighlightMenu.svelte';
	import VolumeHighlightMenu from './region-highlight-menus/VolumeHighlightMenu.svelte';

	export let game: GameLite;
	export let closed: boolean;

	let openMenu: number = 0;

	const titles = ['General Menu', 'Radius Highlight', 'Volume Highlight'];
</script>

<div class="console" class:hidden={closed}>
	<div class="titles">
		{#each titles as title, i}
			<div class="title" class:selected={i === openMenu} on:click={() => (openMenu = i)}>{title}</div>
		{/each}
	</div>
	<div class="content">
		<GeneralMenu {game} closed={openMenu !== 0} />
		<RadiusHighlightMenu {game} closed={openMenu !== 1} />
		<VolumeHighlightMenu {game} closed={openMenu !== 2} />
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
		height: calc(100% + 1px - 3 * (1.5em + 3px));
	}
</style>
