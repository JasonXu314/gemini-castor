<script lang="ts">
	import type GameLite from '$lib/game';
	import Button from '../../../Button.svelte';
	import Slider from '../../../Slider.svelte';

	export let game: GameLite;
	export let closed: boolean;

	let radius: number = 300,
		initPos: boolean = false,
		settingParams: boolean = false,
		x: number = 0,
		y: number = 0,
		z: number = 0;

	$: if (settingParams) game.highlights.updateRadius(radius);

	$: if (settingParams) game.highlights.updateRadiusPos('x', x);
	$: if (settingParams) game.highlights.updateRadiusPos('y', y);
	$: if (settingParams) game.highlights.updateRadiusPos('z', z);

	function resetParams() {
		initPos = false;
		settingParams = false;
		radius = 300;
		x = 0;
		y = 0;
		z = 0;
	}

	function start(): void {
		if (!initPos && game) {
			game.highlights
				.startRadius()
				.then(() => {
					initPos = false;
					settingParams = true;
					radius = Math.ceil(game.highlights.radiusHighlight.radius);
					x = Math.round(game.highlights.radiusHighlight.position.x);
					y = Math.round(game.highlights.radiusHighlight.position.y);
					z = Math.round(game.highlights.radiusHighlight.position.z);
				})
				.catch(() => {
					initPos = false;
					resetParams();
				});
			initPos = true;

			setTimeout(() => {
				game.canvas.focus();
			}, 0);
		}
	}

	function create(): void {
		if (settingParams) {
			game.highlights.createRadiusHighlight();
			resetParams();
		}
	}

	function cancel(): void {
		if (settingParams || initPos) {
			game.highlights.cancel();
			initPos = false;
			settingParams = false;
			radius = 300;
			x = 0;
			y = 0;
			z = 0;
		}
	}

	function reset(): void {
		if (settingParams) {
			game.highlights.reset();
		}
	}
</script>

<div class="main" class:hidden={closed}>
	<Slider dark min={100} max={3000} label="Radius" bind:value={radius} />
	<Slider dark min={Math.floor(game.structure.minX)} max={Math.ceil(game.structure.maxX)} label="x" bind:value={x} />
	<Slider dark min={Math.floor(game.structure.minY)} max={Math.ceil(game.structure.maxY)} label="y" bind:value={y} />
	<Slider dark min={Math.floor(game.structure.minZ)} max={Math.ceil(game.structure.maxZ)} label="z" bind:value={z} />
	<Button type={initPos || settingParams ? 'cancel' : 'action'} on:click={initPos || settingParams ? cancel : start}
		>{initPos || settingParams
			? 'Double-click anywhere to set selector center, or click here to cancel'
			: 'Place!'}</Button
	>
	<Button type="cancel" on:click={reset}>Reset</Button>
	<Button type="action" disabled={initPos} on:click={create}>Create!</Button>
</div>

<style>
	.main {
		padding: 0.25em 1em 0.25em 0.5em;
	}

	.main.hidden {
		display: none;
	}
</style>
