<script lang="ts">
	import type GameLite from '$lib/game';
	import Button from '../../../Button.svelte';
	import Slider from '../../../Slider.svelte';

	export let game: GameLite;
	export let closed: boolean;

	let radius: number = 300,
		initPos: boolean = false,
		settingParams: boolean = false,
		paramsSet: boolean = false,
		showGuide: boolean = false,
		x: number = 0,
		y: number = 0,
		z: number = 0;

	game.events.on('RECALL_SORT', (sort: Sort) => {
		if (sort.radSelect) {
			settingParams = true;
			showGuide = true;
			radius = game.radSelect.radius;
			x = game.radSelect.position.x;
			y = game.radSelect.position.y;
			z = game.radSelect.position.z;
		}
	});

	$: {
		if (settingParams) {
			game.radSelect.updateRadius(radius);
		}
	}

	$: if (settingParams) game.radSelect.updatePos('x', x);
	$: if (settingParams) game.radSelect.updatePos('y', y);
	$: if (settingParams) game.radSelect.updatePos('z', z);

	$: {
		if (initPos && !showGuide) {
			showGuide = true;
		} else if (paramsSet && !game.radSelect.active && !showGuide) {
			showGuide = true;
		} else if (game) {
			game.radSelect.setGuideShown(showGuide);
		}
	}

	$: {
		if (game) {
			game.radSelect.onReset = resetParams;
			game.events.on('RESET', resetParams);
			game.events.on('ACTIVE', () => {
				if (!game.radSelect.active) {
					resetParams();
				}
			});
		}
	}

	function resetParams() {
		initPos = false;
		settingParams = false;
		paramsSet = false;
		showGuide = false;
		radius = 300;
		x = 0;
		y = 0;
		z = 0;
	}

	function start(): void {
		if (!initPos && !paramsSet && game && !game.radSelect.active) {
			game.radSelect
				.start()
				.then(() => {
					initPos = false;
					settingParams = true;
					radius = Math.ceil(game.radSelect.radius);
					x = Math.round(game.radSelect.position.x);
					y = Math.round(game.radSelect.position.y);
					z = Math.round(game.radSelect.position.z);
				})
				.catch(() => {
					initPos = false;
				});
			initPos = true;

			setTimeout(() => {
				game.canvas.focus();
			}, 0);
		}
	}

	function search(): void {
		if (paramsSet) {
			game.executeSearches();
		}
	}

	function finalize(): void {
		if (settingParams) {
			game.radSelect.finalize();
			settingParams = false;
			paramsSet = true;
		}
	}

	function cancel(): void {
		if (settingParams || initPos) {
			game.radSelect.cancel();
			initPos = false;
			settingParams = false;
			radius = 300;
			x = 0;
			y = 0;
			z = 0;
		}
	}

	function reset(): void {
		if (paramsSet) {
			game.radSelect.reset();
		}
	}
</script>

<div class="main" class:hidden={closed}>
	<Slider dark disabled={game && game.radSelect.active} min={100} max={3000} label="Radius" bind:value={radius} />
	<Slider
		dark
		disabled={game && game.radSelect.active}
		min={Math.floor(game.structure.minX)}
		max={Math.ceil(game.structure.maxX)}
		label="x"
		bind:value={x}
	/>
	<Slider
		dark
		disabled={game && game.radSelect.active}
		min={Math.floor(game.structure.minY)}
		max={Math.ceil(game.structure.maxY)}
		label="y"
		bind:value={y}
	/>
	<Slider
		dark
		disabled={game && game.radSelect.active}
		min={Math.floor(game.structure.minZ)}
		max={Math.ceil(game.structure.maxZ)}
		label="z"
		bind:value={z}
	/>
	<label class="check-row" for="show-guide">
		Show Guide Mesh?
		<input type="checkbox" id="show-guide" disabled={initPos} bind:checked={showGuide} />
	</label>
	<Button type={initPos || settingParams ? 'cancel' : 'action'} on:click={initPos || settingParams ? cancel : start}
		>{initPos || settingParams ? 'Double-click anywhere to set selector center, or click here to cancel' : 'Place!'}</Button
	>
	<Button type={paramsSet ? 'cancel' : 'action'} on:click={paramsSet ? reset : finalize}>{paramsSet ? 'Reset' : 'Set!'}</Button>
	<Button type="action" disabled={initPos} on:click={search}>Search!</Button>
</div>

<style>
	.main {
		padding: 0.25em 1em 0.25em 0.5em;
	}

	.main.hidden {
		display: none;
	}

	.main .check-row {
		margin-right: 0.5em;
	}
</style>
