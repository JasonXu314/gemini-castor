<script lang="ts">
	import type GameLite from '$lib/game';
	import type MySocket from '$lib/utils/sock';
	import Button from '../../../Button.svelte';
	import Slider from '../../../Slider.svelte';

	export let game: GameLite;
	export let closed: boolean;
	export let inSession: boolean;
	export let inControl: boolean;
	export let socket: MySocket<SocketReceiveMsgs, SocketSendMsgs>;

	let maxX: number = 1000,
		minX: number = -1000,
		maxY: number = 1000,
		minY: number = -1000,
		maxZ: number = 1000,
		minZ: number = -1000,
		selecting: boolean = false,
		set: boolean = false,
		showGuide: boolean = false;

	game.events.on('RECALL_SORT', (sort: Sort) => {
		if (sort.volSelect) {
			showGuide = true;
			selecting = true;
			maxX = game.volSelect.maxX;
			minX = game.volSelect.minX;
			maxY = game.volSelect.maxY;
			minY = game.volSelect.minY;
			maxZ = game.volSelect.maxZ;
			minZ = game.volSelect.minZ;
		}
	});

	$: if (game && selecting && maxX > minX && maxX <= game.structure.maxX) {
		game.volSelect.updateBound('maxX', maxX);
	}
	$: if (game && selecting && minX < maxX && minX >= game.structure.minX) {
		game.volSelect.updateBound('minX', minX);
	}
	$: if (game && selecting && maxY > minY && maxY <= game.structure.maxY) {
		game.volSelect.updateBound('maxY', maxY);
	}
	$: if (game && selecting && minY < maxY && minY >= game.structure.minY) {
		game.volSelect.updateBound('minY', minY);
	}
	$: if (game && selecting && maxZ > minZ && maxZ <= game.structure.maxZ) {
		game.volSelect.updateBound('maxZ', maxZ);
	}
	$: if (game && selecting && minZ < maxZ && minZ >= game.structure.minZ) {
		game.volSelect.updateBound('minZ', minZ);
	}

	$: {
		if (selecting && !showGuide) {
			showGuide = true;
		} else if (game) {
			game.volSelect.setGuideShown(showGuide);
		}
	}

	$: {
		if (game) {
			game.volSelect.onReset = resetParams;
			game.events.on('RESET', resetParams);
			game.events.on('ACTIVE', () => {
				if (!game.volSelect.active) {
					resetParams();
				}
			});
		}
	}

	socket.on(
		'VOLUME_PARAM_CHANGE',
		({ maxX: _maxX, maxY: _maxY, maxZ: _maxZ, minX: _minX, minY: _minY, minZ: _minZ }) => {
			if (inSession && !inControl) {
				if (_maxX !== undefined) maxX = _maxX;
				if (_maxY !== undefined) maxY = _maxY;
				if (_maxZ !== undefined) maxZ = _maxZ;
				if (_minX !== undefined) minX = _minX;
				if (_minY !== undefined) minY = _minY;
				if (_minZ !== undefined) minZ = _minZ;
			}
		}
	);

	socket.on('VOLUME_START', () => {
		if (inSession && !inControl) {
			start();
		}
	});

	socket.on('VOLUME_SET', () => {
		if (inSession && !inControl) {
			finalize();
		}
	});

	socket.on('VOLUME_RESET', () => {
		if (inSession && !inControl) {
			reset();
		}
	});

	socket.on('VOLUME_CANCEL', () => {
		if (inSession && !inControl) {
			cancel();
		}
	});

	function resetParams() {
		maxX = 1000;
		maxY = 1000;
		maxZ = 1000;
		minX = -1000;
		minY = -1000;
		minZ = -1000;
		set = false;
		selecting = false;
		showGuide = false;
	}

	function search() {
		if (game && set) {
			game.executeSearches();
			if (inSession && inControl) {
				socket.send({ type: 'EXECUTE_SELECTORS' });
			}
		}
	}

	function start() {
		if (!selecting && !set && game && !game.volSelect.active) {
			game.volSelect.start();
			selecting = true;
			if (inSession && inControl) {
				socket.send({ type: 'VOLUME_START' });
			}
		}
	}

	function finalize() {
		if (game.volSelect.placingSelector) {
			game.volSelect.finalize();
			set = true;
			selecting = false;
			if (inSession && inControl) {
				socket.send({ type: 'VOLUME_SET' });
			}
		}
	}

	function cancel() {
		if (game.volSelect.placingSelector) {
			game.volSelect.cancel();
			resetParams();
			if (inSession && inControl) {
				socket.send({ type: 'VOLUME_CANCEL' });
			}
		}
	}

	function reset() {
		if (game.volSelect.locked && !game.volSelect.active) {
			game.volSelect.reset();
			if (inSession && inControl) {
				socket.send({ type: 'VOLUME_RESET' });
			}
		}
	}
</script>

<div class="main" class:hidden={closed}>
	<Slider
		dark
		disabled={set || (inSession && !inControl)}
		min={Math.floor(game.structure.minX)}
		max={Math.ceil(game.structure.maxX)}
		label="Maximum X"
		softMin={minX}
		bind:value={maxX}
	/>
	<Slider
		dark
		disabled={set || (inSession && !inControl)}
		min={Math.floor(game.structure.minY)}
		max={Math.ceil(game.structure.maxY)}
		label="Maximum Y"
		softMin={minY}
		bind:value={maxY}
	/>
	<Slider
		dark
		disabled={set || (inSession && !inControl)}
		min={Math.floor(game.structure.minZ)}
		max={Math.ceil(game.structure.maxZ)}
		label="Maximum Z"
		softMin={minZ}
		bind:value={maxZ}
	/>
	<Slider
		dark
		disabled={set || (inSession && !inControl)}
		min={Math.floor(game.structure.minX)}
		max={Math.ceil(game.structure.maxX)}
		label="Minimum X"
		softMax={maxX}
		bind:value={minX}
	/>
	<Slider
		dark
		disabled={set || (inSession && !inControl)}
		min={Math.floor(game.structure.minY)}
		max={Math.ceil(game.structure.maxY)}
		label="Minimum Y"
		softMax={maxY}
		bind:value={minY}
	/>
	<Slider
		dark
		disabled={set || (inSession && !inControl)}
		max={Math.ceil(game.structure.maxZ)}
		min={Math.floor(game.structure.minZ)}
		label="Minimum Z"
		softMax={maxZ}
		bind:value={minZ}
	/>
	<div class="button-row">
		<Button
			disabled={inSession && !inControl}
			type={selecting ? 'cancel' : 'action'}
			on:click={selecting ? cancel : start}>{selecting ? 'Cancel' : 'Place!'}</Button
		>
		<Button disabled={inSession && !inControl} type={set ? 'cancel' : 'action'} on:click={set ? reset : finalize}
			>{set ? 'Reset' : 'Set!'}</Button
		>
		<Button disabled={inSession && !inControl} type="action" on:click={search}>Search!</Button>
	</div>
	<div class="check-row">
		<label for="guidemesh-box">Show Guide Mesh?</label>
		<input type="checkbox" id="guidemesh-box" bind:checked={showGuide} />
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
