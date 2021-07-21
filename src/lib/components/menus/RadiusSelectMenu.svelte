<script lang="ts">
	import type GameLite from '$lib/game';
	import type { EventSrc } from '$lib/utils/utils';
	import Button from '../Button.svelte';
	import Slider from '../Slider.svelte';

	export let closed: boolean = true;
	export let game: GameLite;
	export let canvas: HTMLCanvasElement;
	export let events: EventSrc<MainEvents>;

	let radius: number = 300,
		initPos: boolean = false,
		settingParams: boolean = false,
		paramsSet: boolean = false,
		ctrlLocked: boolean = true,
		showGuide: boolean = false,
		x: number = 0,
		y: number = 0,
		z: number = 0;

	events.on('RECALL_SORT', (sort: Sort) => {
		if (sort.radSelect) {
			radius = sort.radSelect.radius;
			game.radSelect.start().then(() => {
				initPos = false;
				settingParams = true;
				ctrlLocked = false;
				game.radSelect.updatePosition({ x: sort.radSelect.position.x, y: sort.radSelect.position.y, z: sort.radSelect.position.z });
				game.radSelect.updateRadius(sort.radSelect.radius);
				x = sort.radSelect.position.x;
				y = sort.radSelect.position.y;
				z = sort.radSelect.position.z;
			});
			canvas.dispatchEvent(new Event('dblclick'));
		}
	});

	$: {
		if (settingParams) {
			game.radSelect.updateRadius(radius);
		}
	}

	$: if (settingParams) game.radSelect.updatePos('x', Number(x));
	$: if (settingParams) game.radSelect.updatePos('y', Number(y));
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
		ctrlLocked = true;
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
			ctrlLocked = false;

			setTimeout(() => {
				canvas.focus();
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
		}
	}

	function reset(): void {
		if (paramsSet) {
			game.radSelect.reset();
		}
	}
</script>

<div class="main">
	<div
		class="title"
		on:click={() => {
			closed = !closed;
		}}
	>
		{#if closed}
			<img class="arrow" src="/images/triangle-right-arrow.svg" alt="" />
		{:else}
			<img class="arrow" src="/images/triangle-top-arrow.svg" alt="" />
		{/if}
		<div>Radius Selector</div>
	</div>
	{#if !closed}
		<div class="content">
			<Slider disabled={(game && game.radSelect.active) || ctrlLocked} min={100} max={3000} label="Radius" bind:value={radius} />
			<Slider
				disabled={(game && game.radSelect.active) || ctrlLocked}
				min={Math.floor(game.structure.minX)}
				max={Math.ceil(game.structure.maxX)}
				label="x"
				bind:value={x}
			/>
			<Slider
				disabled={(game && game.radSelect.active) || ctrlLocked}
				min={Math.floor(game.structure.minY)}
				max={Math.ceil(game.structure.maxY)}
				label="y"
				bind:value={y}
			/>
			<Slider
				disabled={(game && game.radSelect.active) || ctrlLocked}
				min={Math.floor(game.structure.minZ)}
				max={Math.ceil(game.structure.maxZ)}
				label="z"
				bind:value={z}
			/>
			<div class="check-row">
				Show Guide Mesh?
				<input type="checkbox" disabled={initPos} bind:checked={showGuide} />
			</div>
			<Button type={initPos || settingParams ? 'cancel' : 'action'} on:click={initPos || settingParams ? cancel : start}
				>{initPos || settingParams ? 'Double-click anywhere to set selector center, or click here to cancel' : 'Place!'}</Button
			>
			<Button type={paramsSet ? 'cancel' : 'action'} on:click={paramsSet ? reset : finalize}>{paramsSet ? 'Reset' : 'Set!'}</Button>
			<Button type={'action'} disabled={initPos} on:click={search}>Search!</Button>
		</div>
	{/if}
</div>

<style>
	.main {
		border: 1px solid black;
		padding: 0.25em 1em 0.25em 0.5em;
	}

	.main .title {
		cursor: pointer;
		display: flex;
		flex-direction: row;
		padding-right: 0.5em;
	}

	.main .title .arrow {
		max-height: 1em;
		max-width: 1em;
		margin-right: 0.25em;
	}

	.main .title div {
		min-width: max-content;
	}

	.main .content {
		padding-left: 1em;
		margin-top: 0.2em;
	}
</style>
