<script lang="ts">
	import type GameLite from '$lib/game';

	export let game: GameLite;
	export let closed: boolean;

	let showHighlights: boolean = true;

	$: if (game) game.highlights.setHighlightsShown(showHighlights);
</script>

<div class="main" class:hidden={closed}>
	<div class="check-row">
		<label for="struct-box">Show Highlights</label>
		<input type="checkbox" id="struct-box" bind:checked={showHighlights} />
	</div>
</div>

<style>
	.main {
		padding: 0.25em 1em 0.25em 0.5em;
	}

	.main.hidden {
		display: none;
	}
</style>
