<script lang="ts">
	import Button from './Button.svelte';

	export let sort: Sort;
	export let recall: () => void;
	export let del: () => void;
	export let disabled: boolean;
</script>

<div class="main">
	<input class="subtle-input" type="text" on:blur bind:value={sort.name} />
	{#if sort.radSelect}
		<h4>Radius Selector</h4>
		<p>Position: ({sort.radSelect.position.x.toFixed(2)}, {sort.radSelect.position.y.toFixed(2)}, {sort.radSelect.position.z.toFixed(2)})</p>
		<p>Radius: {sort.radSelect.radius}</p>
	{/if}
	{#if sort.volSelect}
		<h4>Volume Selector</h4>
		<p>minX: {sort.volSelect.minX}</p>
		<p>minY: {sort.volSelect.minY}</p>
		<p>minZ: {sort.volSelect.minZ}</p>
		<p>maxX: {sort.volSelect.maxX}</p>
		<p>maxY: {sort.volSelect.maxY}</p>
		<p>maxZ: {sort.volSelect.maxZ}</p>
	{/if}
	{#if sort.bpsSelect}
		<h4>BPS Selector</h4>
		<p>Region: {sort.bpsSelect.regions}</p>
		<p>Radius: {sort.bpsSelect.radius}</p>
	{/if}
	<Button smol type="action" {disabled} on:click={recall}>Recall Sort</Button>
	<Button smol type="cancel" {disabled} on:click={del}>Delete Sort</Button>
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
