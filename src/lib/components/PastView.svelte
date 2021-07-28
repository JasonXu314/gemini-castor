<script lang="ts">
	import Button from './Button.svelte';

	export let view: View;
	export let recall: () => void;
	export let del: () => void;
	export let disabled: boolean;
</script>

<div class="main">
	<input class="subtle-input" type="text" on:blur bind:value={view.name} />
	<span>
		<h4>Position:</h4>
		({view.pos.x.toFixed(2)}, {view.pos.y.toFixed(2)}, {view.pos.z.toFixed(2)})
	</span>
	<span>
		<h4>Orientation:</h4>
		({view.rot.x.toFixed(2)}, {view.rot.y.toFixed(2)}, {view.rot.z.toFixed(2)})
	</span>
	<div>
		<Button smol type="action" {disabled} on:click={recall}>Recall View</Button>
		<Button smol type="cancel" {disabled} on:click={del}>Delete View</Button>
	</div>
</div>

<style>
	.main {
		margin: 0.25em 1em;
	}

	.main .subtle-input {
		border: 0;
		border-bottom: 1px solid #cccccc;
		background: rgba(0, 0, 0, 0);
		color: white;
	}
</style>
