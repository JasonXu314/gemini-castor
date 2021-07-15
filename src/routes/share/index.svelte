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
	<h4 class="title">Gallery</h4>
	{#if !models}
		<div>Loading...</div>
	{:else}
		<ul class="gallery">
			{#each models as model}
				<li class="model">
					<img class="preview" src={`${BACKEND_URL}/${model._id}-preview.png`} alt="No Preview Available" />
					<h4>{model.name}</h4>
					<a href="/share/{model._id}">View</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.main {
		padding: 0.5em 1em;
	}

	.title {
		font-size: 2em;
		margin-bottom: 0.5em;
	}

	.gallery {
		list-style: none;
	}

	.model {
		border: 1px solid black;
		border-radius: 8px;
		margin: 0.5em;
		float: left;
		padding: 2em 1em;
	}

	.model .preview {
		max-height: 200px;
	}
</style>
