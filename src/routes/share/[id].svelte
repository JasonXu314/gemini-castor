<script lang="ts">
	import { page } from '$app/stores';
	import Button from '$lib/components/Button.svelte';
	import Console from '$lib/components/console/Console.svelte';
	import GameLite from '$lib/game';
	import { BACKEND_URL } from '$lib/utils/constants';
	import { decodeEpiData, decodeRefGenes, decodeStruct } from '$lib/utils/serializations';
	import MySocket from '$lib/utils/sock';
	import { historyStore } from '$lib/utils/stores';
	import { compareSorts } from '$lib/utils/utils';
	import axios from 'axios';
	import { onMount, setContext } from 'svelte';

	let canvas: HTMLCanvasElement,
		game: GameLite,
		sortHist: Sort[] = [],
		sortsActive: boolean = false,
		fetching: boolean = false,
		settingAnnotation: boolean = false,
		annotationName: string = '',
		socketId: string,
		socket: MySocket<SocketReceiveMsgs, SocketSendMsgs>,
		liveSession: LiveSessionData | null = null,
		id: string;

	$: historyStore.set(sortHist);

	setContext<HistoryContext>('HISTORY_CONTEXT', {
		renameSort: (sort: Sort) => {
			const { _id, name } = sort;
			axios.patch<Sort[]>(`${BACKEND_URL}/history`, { id, _id, name }).catch(() => alert('Failed to rename sort; name will be lost on refresh'));
		},
		deleteSort: (sort: Sort) => {
			const { _id, name } = sort;
			axios.delete<Sort[]>(`${BACKEND_URL}/history`, { data: { id, _id, name } }).catch(() => alert('Failed to delete sort'));
		}
	});

	page.subscribe((page) => {
		id = page.params.id;
	});

	onMount(tryFetch);

	function tryFetch() {
		if (id && !game && !fetching) {
			axios.get<Model & { socketId: string }>(`${BACKEND_URL}/models/${id}`).then((res) => {
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
							axios.post<Sort[]>(`${BACKEND_URL}/history`, { sort, id });
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

					const mainSock = new MySocket<SocketReceiveMsgs, SocketSendMsgs>(BACKEND_URL.replace('http', 'ws'), [
						'ANN_ADD',
						'ANN_DEL',
						'HIST_ADD',
						'HIST_DEL',
						'HIST_EDIT',
						'START_LIVE',
						'JOIN_LIVE',
						'LEAVE_LIVE',
						'CAM_CHANGE'
					]);

					mainSock.send({ type: 'LINK', id: res.data.socketId, roomId: id });
					socketId = res.data.socketId;

					mainSock.on('HIST_ADD', ({ newSort }) => {
						if (!sortHist.some((existingSort) => compareSorts(existingSort, newSort))) {
							sortHist = [...sortHist, newSort];
							game.sortsDone++;
						}
					});

					mainSock.on('HIST_DEL', ({ id }) => {
						sortHist = sortHist.filter((sort) => sort._id !== id);
					});

					mainSock.on('HIST_EDIT', ({ id, name }) => {
						sortHist = sortHist.map((sort) => {
							if (sort._id === id) {
								sort.name = name;
							}
							return sort;
						});
					});

					mainSock.on('ANN_ADD', ({ newAnnotation }) => {
						game.epiData.addRawAnnotation(newAnnotation);
					});

					mainSock.on('ANN_DEL', ({ mesh }) => {
						game.epiData.removeRawAnnotation(mesh);
					});

					socket = mainSock;

					if (res.data.live) {
						liveSession = res.data.session;
					}
				});
			});
			fetching = true;
		} else if (!id) {
			console.log(`Model id undefined: ${id}`);
		}
	}
</script>

<svelte:window
	on:sveltekit:navigation-start={() => {
		game.stop();
	}}
/>
<div class="main">
	<canvas
		class="canvas"
		bind:this={canvas}
		width={typeof window === 'undefined' ? 800 : window.innerWidth}
		height={typeof window === 'undefined' ? 600 : window.innerHeight}
	/>
	{#if game}
		<Console {game} {socket} {socketId} {liveSession} />
	{/if}

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
