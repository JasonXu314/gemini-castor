<script lang="ts">
	import { page } from '$app/stores';
	import Button from '$lib/components/Button.svelte';
	import BasePairSelectMenu from '$lib/components/menus/BasePairSelectMenu.svelte';
	import GeneralMenu from '$lib/components/menus/GeneralMenu.svelte';
	import RadiusSelectMenu from '$lib/components/menus/RadiusSelectMenu.svelte';
	import VolumeSelectMenu from '$lib/components/menus/VolumeSelectMenu.svelte';
	import PastSort from '$lib/components/PastSort.svelte';
	import GameLite from '$lib/game';
	import { BACKEND_URL } from '$lib/utils/constants';
	import { decodeEpiData, decodeRefGenes, decodeStruct } from '$lib/utils/serializations';
	import { compareSorts, EventSrc } from '$lib/utils/utils';
	import axios from 'axios';
	import { onMount } from 'svelte';

	let canvas: HTMLCanvasElement,
		game: GameLite,
		sortHist: Sort[] = [],
		sortsActive: boolean = false,
		sortsClosed: boolean = false,
		histClosed: boolean = false,
		fetching: boolean = false,
		settingAnnotation: boolean = false,
		annotationName: string = '';
	const events: EventSrc<MainEvents> = new EventSrc<MainEvents>(['RECALL_SORT']);
	let id: string;

	page.subscribe((page) => {
		id = page.params.id;
	});

	onMount(tryFetch);

	function tryFetch() {
		if (id && !game && !fetching) {
			axios.get<Model>(`${BACKEND_URL}/models/${id}`).then((res) => {
				Promise.all([
					axios.get<Blob>(`${BACKEND_URL}/${id}.gref`, { responseType: 'blob' }).then((res) => {
						return new Promise<RawRefGene[]>((resolve) => {
							const fr = new FileReader();

							fr.onloadend = () => {
								resolve(decodeRefGenes(fr.result as Buffer));
							};

							fr.readAsArrayBuffer(res.data);
						});
					}),
					axios.get<Blob>(`${BACKEND_URL}/${id}.struct`, { responseType: 'blob' }).then((res) => {
						return new Promise<RawStructureCoord[]>((resolve) => {
							const fr = new FileReader();

							fr.onloadend = () => {
								resolve(decodeStruct(fr.result as Buffer));
							};

							fr.readAsArrayBuffer(res.data);
						});
					}),
					axios.get<Blob>(`${BACKEND_URL}/${id}.epi`, { responseType: 'blob' }).then((res) => {
						return new Promise<{ arcs: RawArcTrackData[]; flags: RawFlagTrackData[] }>((resolve) => {
							const fr = new FileReader();

							fr.onloadend = () => {
								resolve(decodeEpiData(fr.result as Buffer));
							};

							fr.readAsArrayBuffer(res.data);
						});
					})
				]).then((stuff) => {
					game = new GameLite(
						canvas,
						{
							id,
							refGenes: stuff[0],
							structure: stuff[1],
							epiData: stuff[2],
							viewRegion: res.data.modelData.viewRegion,
							arcsVisible: res.data.modelData.arcsVisible,
							flagsVisible: res.data.modelData.flagsVisible
						},
						res.data.sortHist.length + 1,
						res.data.annotations
					);
					sortHist = res.data.sortHist;
					game.start();
					game.events.on('RESET', (sort) => {
						if (!sortHist.some((existingSort) => compareSorts(existingSort, sort))) {
							sortHist = [...sortHist, sort];
							axios.post<Sort[]>(`${BACKEND_URL}/history`, { sort, id }).then((res) => {
								if (sortHist.length !== res.data.length || !sortHist.every((existingSort, i) => compareSorts(existingSort, res.data[i]))) {
									sortHist = res.data;
									game.sortsDone = sortHist.length + 1;
								}
							});
							game.sortsDone++;
						}
						sortsActive = false;
					});
					game.events.on('ACTIVE', () => {
						sortsActive = true;
					});
					game.events.on('START_SET_ANN_NAME', (defName: string) => {
						settingAnnotation = true;
						annotationName = defName;
					});

					setInterval(() => {
						axios.get<Sort[]>(`${BACKEND_URL}/history?id=${id}`).then((res) => {
							if (sortHist.length !== res.data.length || !sortHist.every((existingSort, i) => compareSorts(existingSort, res.data[i]))) {
								sortHist = res.data;
								game.sortsDone = sortHist.length + 1;
							}
						});
					}, 5000);
				});
			});
			fetching = true;
		} else if (!id) {
			console.log(`Model id undefined: ${id}`);
		}
	}

	function clear() {
		if (game && game.sortsActive) {
			game.reset();
		}
	}

	function renameSort(sort: Sort) {
		const { _id, name } = sort;
		axios
			.patch<Sort[]>(`${BACKEND_URL}/history`, { id, _id, name })
			.then((res) => {
				sortHist = res.data;
				game.sortsDone = sortHist.length + 1;
			})
			.catch(() => alert('Failed to rename sort; name will be lost on refresh'));
	}

	function delSort(sort: Sort) {
		const backupHist = sortHist;
		const { _id, name } = sort;
		axios
			.delete<Sort[]>(`${BACKEND_URL}/history`, { data: { id, _id, name } })
			.then((res) => {
				sortHist = res.data;
				game.sortsDone = sortHist.length + 1;
			})
			.catch(() => {
				sortHist = backupHist;
				game.sortsDone = sortHist.length + 1;
				alert('Failed to delete sort');
			});
		sortHist = sortHist.filter((sort) => sort._id !== _id);
		game.sortsDone = sortHist.length + 1;
	}
</script>

<div class="main">
	<canvas
		class="canvas"
		bind:this={canvas}
		width={typeof window === 'undefined' ? 1200 : window.innerWidth}
		height={typeof window === 'undefined' ? 800 : window.innerHeight}
	/>
	<div class="action-menu" class:sortclosed={sortsClosed}>
		{#if sortsClosed}
			<img
				class="arrow"
				src="/images/triangle-top-arrow.svg"
				alt=""
				on:click={() => {
					sortsClosed = !sortsClosed;
				}}
			/>
		{:else}
			<img
				class="arrow"
				src="/images/triangle-right-arrow.svg"
				alt=""
				on:click={() => {
					sortsClosed = !sortsClosed;
				}}
			/>
		{/if}
		<Button type="cancel" on:click={clear}>Clear Sorts</Button>
		<GeneralMenu {game} />
		<BasePairSelectMenu {events} {game} />
		<RadiusSelectMenu {events} {game} {canvas} />
		<VolumeSelectMenu {events} {game} />
	</div>
	<div class="past-sorts" class:histclosed={histClosed}>
		{#if histClosed}
			<img
				class="arrow"
				src="/images/triangle-top-arrow.svg"
				alt=""
				on:click={() => {
					histClosed = !histClosed;
				}}
			/>
		{:else}
			<img
				class="arrow"
				src="/images/triangle-right-arrow.svg"
				alt=""
				on:click={() => {
					histClosed = !histClosed;
				}}
			/>
		{/if}
		{#each sortHist as sort}
			<PastSort
				{sort}
				disabled={sortsActive}
				on:blur={() => {
					renameSort(sort);
				}}
				recall={() => {
					events.dispatch('RECALL_SORT', sort);
				}}
				del={() => {
					delSort(sort);
				}}
			/>
		{/each}
	</div>

	{#if settingAnnotation}
		<div class="annotation-menu">
			<h4>Annotation Name</h4>
			<textarea bind:value={annotationName} />
			<Button
				type="action"
				on:click={() => {
					game.events.dispatch('SET_ANN_NAME', annotationName);
					settingAnnotation = false;
					annotationName = '';
				}}>Confirm</Button
			>
			<Button
				type="cancel"
				on:click={() => {
					settingAnnotation = false;
					annotationName = '';
					game.events.dispatch('CANCEL_SET_ANN_NAME');
				}}>Cancel</Button
			>
		</div>
	{/if}
	{#if settingAnnotation}
		<div
			class="blur"
			on:click={() => {
				settingAnnotation = false;
				annotationName = '';
				game.events.dispatch('CANCEL_SET_ANN_NAME');
			}}
		/>
	{/if}
</div>

<style>
	.action-menu {
		position: absolute;
		bottom: 0px;
		background: white;
		padding: 1em;
		min-width: max-content;
		box-sizing: content-box;
	}

	.main .past-sorts {
		position: absolute;
		bottom: 0px;
		background: white;
		right: 0px;
		padding: 1em;
		min-width: max-content;
		box-sizing: content-box;
	}

	.sortclosed {
		height: 1em;
		width: 1em;
		overflow: hidden;
	}

	.histclosed {
		height: 0.6em;
		width: 1em;
		overflow: hidden;
	}

	.arrow {
		height: 1em;
		width: 1em;
		margin-right: 0.25em;
		cursor: pointer;
	}

	.canvas {
		display: block;
	}

	:global(.canvas.cp) {
		cursor: pointer;
	}

	.blur {
		position: absolute;
		left: 0;
		top: 0;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur 4px;
		height: 100vh;
		width: 100vw;
	}

	.annotation-menu {
		position: absolute;
		background: white;
		padding: 0.5em 1em;
		border-radius: 4px;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 2;
	}
</style>
