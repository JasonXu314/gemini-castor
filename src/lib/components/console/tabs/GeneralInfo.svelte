<script lang="ts">
	import type GameLite from '$lib/game';
	import Button from '../../Button.svelte';


	export let game: GameLite;
	export let closed: boolean;

	let selectedFeature: EpiDataFeature | null = null;
	let hasAnnotation: boolean = selectedFeature === null ? false : game.epiData.hasAnnotation(selectedFeature.mesh);

	game.events.on('SELECT_FEATURE', (feature: EpiDataFeature) => (selectedFeature = feature));
	game.events.on('DESELECT_FEATURE', () => (selectedFeature = null));

	$: hasAnnotation = selectedFeature === null ? false : game.epiData.hasAnnotation(selectedFeature.mesh);

	game.epiData.events.on('CREATED_ANNOTATION', (mesh: Mesh) => {
		if (selectedFeature && mesh === selectedFeature.mesh) {
			hasAnnotation = true;
		}
	});
	game.epiData.events.on('DELETED_ANNOTATION', (mesh: Mesh) => {
		if (selectedFeature && mesh === selectedFeature.mesh) {
			hasAnnotation = false;
		}
	});

	(window as any).getSelectedMesh = () => selectedFeature.mesh;
</script>

<div class="console" class:hidden={closed}>
	{#if selectedFeature}
		{#if selectedFeature.type === 'flag'}
			<div class="info-container flag">
				<div class="left">
					<div class="top">
						<h4 class="name">{selectedFeature.mesh.name}</h4>
						<small class="id">Track ID: {selectedFeature.data.id}</small>
					</div>
					<div class="middle">
						<h4 class="title">Locus</h4>
						<div class="info">Chr: {selectedFeature.data.locus.chr}</div>
						<div class="info">Start: {selectedFeature.data.locus.start}</div>
						<div class="info">Stop: {selectedFeature.data.locus.end}</div>
					</div>
					<div class="bottom">
						<h4 class="title">Strength</h4>
						<div class="info">{selectedFeature.data.value}</div>
					</div>
				</div>
				<div class="right">
					<Button type="action">View</Button>
					<Button
						type={hasAnnotation ? 'cancel' : 'action'}
						on:click={() => {
							if (!hasAnnotation) {
								game.getAnnotationName(selectedFeature.mesh.name)
									.then((annotation) => {
										game.epiData.addAnnotation(selectedFeature.mesh, annotation);
										hasAnnotation = true;
									})
									.catch(() => {});
							} else {
								game.epiData.removeAnnotation(selectedFeature.mesh);
								hasAnnotation = false;
							}
						}}>{hasAnnotation ? 'Delete Annotation' : 'Add Annotation'}</Button
					>
				</div>
			</div>
		{:else}
			<div class="info-container arc">
				<div class="left">
					<div class="top">
						<h4 class="name">{selectedFeature.mesh.name}</h4>
						<small class="id">Track ID: {selectedFeature.data.id}</small>
					</div>
					<div class="middle">
						<h4 class="title">Locus 1</h4>
						<div class="info">Chr: {selectedFeature.data.locus1.chr}</div>
						<div class="info">Start: {selectedFeature.data.locus1.start}</div>
						<div class="info">Stop: {selectedFeature.data.locus1.end}</div>
						<h4 class="title">Locus 2</h4>
						<div class="info">Chr: {selectedFeature.data.locus2.chr}</div>
						<div class="info">Start: {selectedFeature.data.locus2.start}</div>
						<div class="info">Stop: {selectedFeature.data.locus2.end}</div>
					</div>
				</div>
				<div class="center">
					<h4 class="title">Strength</h4>
					<div class="info">{selectedFeature.data.score}</div>
				</div>
				<div class="right">
					<Button type="action">View</Button>
					<Button
						type="action"
						on:click={() => {
							if (!hasAnnotation) {
								game.getAnnotationName(selectedFeature.mesh.name)
									.then((annotation) => {
										game.epiData.addAnnotation(selectedFeature.mesh, annotation);
										hasAnnotation = true;
									})
									.catch(() => {});
							} else {
								game.epiData.removeAnnotation(selectedFeature.mesh);
								hasAnnotation = false;
							}
						}}>{hasAnnotation ? 'Delete Annotation' : 'Add Annotation'}</Button
					>
				</div>
			</div>
		{/if}
	{:else}
		Select a feature in the model and its general information will pop up here!
	{/if}
</div>

<style>
	.console {
		color: white;
		background: rgba(0, 0, 0, 0);
		padding: 0.5em 1em;
	}

	.console.hidden {
		display: none;
	}

	.info-container.flag {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
	}

	.info-container.arc {
		display: grid;
		grid-template-columns: 2fr 1fr 2fr;
	}

	.top {
		border-bottom: 1px solid white;
		padding: 0 0.4em;
		width: fit-content;
	}

	.top .name,
	.top .id {
		display: inline-block;
	}

	.top .id {
		font-size: x-small;
	}

	.middle {
		margin: 0.5em 0.5em 0.25em;
	}

	.middle .title {
		margin-bottom: 0.25em;
	}

	.middle .info {
		display: inline-block;
		margin-left: 0.5em;
	}

	.bottom {
		margin-left: 0.5em;
	}

	.bottom .info {
		margin-left: 0.5em;
	}
</style>
