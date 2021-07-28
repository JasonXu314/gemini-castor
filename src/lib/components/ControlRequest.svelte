<script lang="ts">
	import { onMount } from 'svelte';
	import Button from './Button.svelte';

	export let req: LiveParticipant;
	export let accept: () => void;
	export let deny: () => void;

	let mounted = false;

	onMount(() => {
		setTimeout(() => {
			mounted = true;
		}, 0);
	});
</script>

<div class="main" class:mounted>
	<div class="top">
		<h4 class="name">{req.name}</h4>
		<Button smol type="action" on:click={accept}>Transfer</Button>
		<Button smol type="cancel" on:click={deny}>Decline</Button>
	</div>
	<h6 class="name">Is requesting control</h6>
	<small class="id">{req.id}</small>
</div>

<style>
	.main {
		color: white;
		opacity: 0;
		background: rgba(0, 0, 0, 0);
		padding: 0.25em 0.5em;
		transition: all linear 0.25s;
		transform: translateX(100%);
	}

	.main.mounted {
		opacity: 1;
		background: rgba(0, 0, 0, 0.5);
		transform: translateX(0);
		transition: all linear 0.25s;
	}
</style>
