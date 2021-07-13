<script lang="ts">
	import { BACKEND_URL } from '$lib/utils/constants';
	import axios from 'axios';
	import { onMount } from 'svelte';

	let models: Model[] | null = null;

	onMount(() => {
		axios.get<Model[]>(`${BACKEND_URL}/models`).then((res) => {
			models = res.data;
		});
	});
</script>

<div class="main">
	{#if !models}
		<div>Loading...</div>
	{:else}
		{#each models as model}
			<div class="model">
				<img class="preview" src={`${BACKEND_URL}/${model._id}-preview.png`} alt="No Preview Available" />
				<h4>{model.name}</h4>
				<a href="/share/{model._id}">View</a>
			</div>
		{/each}
	{/if}
</div>

<style>
	.model .preview {
		max-height: 400px;
	}
</style>
