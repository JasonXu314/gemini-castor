<script lang="ts">
	import type GameLite from '$lib/game';
	import { Vector3 } from '$lib/utils/babylon';
	import { BACKEND_URL } from '$lib/utils/constants';
	import { padNum } from '$lib/utils/utils';
	import axios from 'axios';
	import Button from '../../Button.svelte';


	export let game: GameLite;
	export let closed: boolean;

	let selectedFeature: EpiDataFeature | null = null,
		selectedHighlight: RawHighlight | null = null,
		tempName: string | null = null,
		colorString: string | null = null;
	let hasAnnotation: boolean =
		selectedFeature === null && selectedHighlight === null
			? false
			: game.gui.hasAnnotation(
					selectedFeature ? selectedFeature.mesh : game.scene.getMeshByName(`highlight-${selectedHighlight.id}`)
			  );

	game.events.on('SELECT_FEATURE', (feature: EpiDataFeature) => {
		selectedFeature = feature;
		if (selectedHighlight) {
			selectedHighlight = null;
			tempName = null;
			colorString = null;
		}
	});
	game.events.on('SELECT_HIGHLIGHT', (highlight: RawHighlight) => {
		selectedHighlight = highlight;
		tempName = highlight.name;
		if (selectedFeature) {
			selectedFeature = null;
		}
	});
	game.events.on('DESELECT_FEATURE', () => {
		selectedFeature = null;
		selectedHighlight = null;
		tempName = null;
		colorString = null;
	});

	$: hasAnnotation =
		selectedFeature === null && selectedHighlight === null
			? false
			: game.gui.hasAnnotation(
					selectedFeature ? selectedFeature.mesh : game.scene.getMeshByName(`highlight-${selectedHighlight.id}`)
			  );

	$: if (selectedHighlight) {
		const { r, g, b } = selectedHighlight.color;
		colorString = `#${padNum((r * 255).toString(16))}${padNum((g * 255).toString(16))}${padNum(
			(b * 255).toString(16)
		)}`;
	}

	game.gui.events.on('CREATED_ANNOTATION', (mesh: Mesh) => {
		if (selectedFeature && mesh === selectedFeature.mesh) {
			hasAnnotation = true;
		} else if (selectedHighlight && mesh.name === `highlight-${selectedHighlight.id}`) {
			hasAnnotation = true;
		}
	});

	game.gui.events.on('DELETED_ANNOTATION', (mesh: Mesh) => {
		if (selectedFeature && mesh === selectedFeature.mesh) {
			hasAnnotation = false;
		} else if (selectedHighlight && mesh.name === `highlight-${selectedHighlight.id}`) {
			hasAnnotation = false;
		}
	});

	game.highlights.events.on('DELETED_HIGHLIGHT', (highlight: RawHighlight) => {
		if (selectedHighlight && highlight.id === selectedHighlight.id) {
			selectedHighlight = null;
			tempName = null;
			colorString = null;
		}
	});

	game.highlights.events.on('EDITED_HIGHLIGHT', ({ id, name }) => {
		if (selectedHighlight && id === selectedHighlight.id) {
			selectedHighlight = { ...selectedHighlight, name };
			tempName = name;
		}
	});

	game.highlights.events.on('CHANGED_HIGHLIGHT_COLOR', ({ id, color }) => {
		if (selectedHighlight && id === selectedHighlight.id) {
			console.log(color);
			selectedHighlight = { ...selectedHighlight, color };
		}
	});

	function viewRad(): void {
		const params = selectedHighlight.params as RadSelectParams;
		const {
			position: { x, y, z },
			radius
		} = params;
		const meshPos = new Vector3(x, y, z);
		const camToPos = game.camera.position.subtract(meshPos);
		game.camera.setTarget(meshPos);
		game.camera.position = game.camera.position.subtract(
			camToPos.scale((camToPos.length() - (radius + 2500)) / camToPos.length())
		);
	}

	(window as any).getSelected = () => selectedFeature || selectedHighlight;
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
					<Button
						type="action"
						on:click={() => {
							const boundingInfo = selectedFeature.mesh.getBoundingInfo().boundingSphere;
							const meshPos = boundingInfo.center;
							const rad = boundingInfo.radius;
							const camToPos = game.camera.position.subtract(meshPos);
							game.camera.setTarget(meshPos);
							game.camera.position = game.camera.position.subtract(
								camToPos.scale((camToPos.length() - (rad + 2500)) / camToPos.length())
							);
						}}>View</Button
					>
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
					<Button
						type="action"
						on:click={() => {
							const boundingInfo = selectedFeature.mesh.getBoundingInfo().boundingSphere;
							const meshPos = boundingInfo.center;
							const rad = boundingInfo.radius;
							const camToPos = game.camera.position.subtract(meshPos);
							game.camera.setTarget(meshPos);
							game.camera.position = game.camera.position.subtract(
								camToPos.scale((camToPos.length() - (rad + 2500)) / camToPos.length())
							);
						}}>View</Button
					>
					<Button
						type="action"
						on:click={() => {
							if (!hasAnnotation) {
								game.getAnnotationName(selectedHighlight.name)
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
	{:else if selectedHighlight}
		{#if selectedHighlight.type === 'radius'}
			<div class="info-container arc">
				<div class="left">
					<div>
						<input
							type="text"
							class="subtle-input"
							bind:value={tempName}
							on:blur={() => {
								if (tempName !== selectedHighlight.name) {
									axios.patch(`${BACKEND_URL}/highlights`, {
										id: game.rawData.id,
										_id: selectedHighlight.id,
										name: tempName
									});
								}
							}}
						/>
					</div>
					<div class="middle">
						<h4 class="title">Position</h4>
						<div class="info">
							({selectedHighlight.params.position.x.toFixed(2)}, {selectedHighlight.params.position.y.toFixed(
								2
							)}, {selectedHighlight.params.position.z.toFixed(2)})
						</div>
						<h4 class="title">Radius</h4>
						<div class="info">{selectedHighlight.params.radius}</div>
					</div>
				</div>
				<div class="middle">
					<input
						class="color-input"
						type="color"
						on:change={(evt) => {
							colorString = evt.currentTarget.value;
							const r = parseInt(colorString.slice(1, 3), 16) / 255;
							const g = parseInt(colorString.slice(3, 5), 16) / 255;
							const b = parseInt(colorString.slice(5, 7), 16) / 255;

							game.highlights.changeHighlightColor(selectedHighlight.id, { r, g, b });
							axios.patch(`${BACKEND_URL}/highlights`, {
								id: game.rawData.id,
								_id: selectedHighlight.id,
								color: { r, g, b }
							});
						}}
						value={colorString}
					/>
				</div>
				<div class="right">
					<Button type="action" on:click={viewRad}>View</Button>
					<Button
						type={hasAnnotation ? 'cancel' : 'action'}
						on:click={() => {
							const mesh = game.scene.getMeshByName(`highlight-${selectedHighlight.id}`);
							if (!hasAnnotation) {
								game.getAnnotationName(selectedHighlight.name)
									.then((annotation) => {
										game.gui.makeAnnotation(mesh, annotation);
										axios.post(`${BACKEND_URL}/annotations`, {
											id: game.rawData.id,
											annotation: { mesh: mesh.name, text: annotation }
										});
										hasAnnotation = true;
									})
									.catch(() => {});
							} else {
								game.gui.removeAnnotationFromMesh(mesh);
								axios.delete(`${BACKEND_URL}/annotations`, {
									data: { id: game.rawData.id, name: mesh.name }
								});
								hasAnnotation = false;
							}
						}}>{hasAnnotation ? 'Delete Annotation' : 'Add Annotation'}</Button
					>
					<Button
						type="cancel"
						on:click={() => {
							axios.delete(`${BACKEND_URL}/highlights`, {
								data: { id: game.rawData.id, _id: selectedHighlight.id }
							});
							game.highlights.deleteHighlight(selectedHighlight.id);
						}}>Delete Highlight</Button
					>
				</div>
			</div>
		{:else}
			<div class="info-container arc">
				<div class="left">
					<div>
						<input
							type="text"
							class="subtle-input"
							bind:value={tempName}
							on:blur={() => {
								if (tempName !== selectedHighlight.name) {
									axios.patch(`${BACKEND_URL}/highlights`, {
										id: game.rawData.id,
										_id: selectedHighlight.id,
										name: tempName
									});
								}
							}}
						/>
					</div>
					<div class="middle">
						<h4 class="title">Bounds</h4>
						<div class="info">
							<div>
								Min X: {selectedHighlight.params.minX} Min Y: {selectedHighlight.params.minY} Min Z: {selectedHighlight
									.params.minZ}
							</div>
							<div>
								Max X: {selectedHighlight.params.maxX} Max Y: {selectedHighlight.params.maxY} Max Z: {selectedHighlight
									.params.maxZ}
							</div>
						</div>
					</div>
				</div>
				<div class="middle">
					<input
						class="color-input"
						type="color"
						on:change={(evt) => {
							console.log('hi');
							colorString = evt.currentTarget.value;
							const r = parseInt(colorString.slice(1, 3), 16) / 255;
							const g = parseInt(colorString.slice(3, 5), 16) / 255;
							const b = parseInt(colorString.slice(5, 7), 16) / 255;

							game.highlights.changeHighlightColor(selectedHighlight.id, { r, g, b });
							axios.patch(`${BACKEND_URL}/highlights`, {
								id: game.rawData.id,
								_id: selectedHighlight.id,
								color: { r, g, b }
							});
						}}
						value={colorString}
					/>
				</div>
				<div class="right">
					<Button type="action" on:click={viewRad}>View</Button>
					<Button
						type={hasAnnotation ? 'cancel' : 'action'}
						on:click={() => {
							const mesh = game.scene.getMeshByName(`highlight-${selectedHighlight.id}`);
							if (!hasAnnotation) {
								game.getAnnotationName(selectedHighlight.name)
									.then((annotation) => {
										game.gui.makeAnnotation(mesh, annotation);
										axios.post(`${BACKEND_URL}/annotations`, {
											id: game.rawData.id,
											annotation: { mesh: mesh.name, text: annotation }
										});
										hasAnnotation = true;
									})
									.catch(() => {});
							} else {
								game.gui.removeAnnotationFromMesh(mesh);
								axios.delete(`${BACKEND_URL}/annotations`, {
									data: { id: game.rawData.id, name: mesh.name }
								});
								hasAnnotation = false;
							}
						}}>{hasAnnotation ? 'Delete Annotation' : 'Add Annotation'}</Button
					>
					<Button
						type="cancel"
						on:click={() => {
							axios.delete(`${BACKEND_URL}/highlights`, {
								data: { id: game.rawData.id, _id: selectedHighlight.id }
							});
							game.highlights.deleteHighlight(selectedHighlight.id);
						}}>Delete Highlight</Button
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

	.subtle-input {
		border: 0;
		border-bottom: 1px solid #cccccc;
		background: rgba(0, 0, 0, 0);
		color: white;
	}

	.color-input {
		width: 4em;
		height: 4em;
	}
</style>
