<script lang="ts">
	import { page } from '$app/stores';
	import Button from '$lib/components/Button.svelte';
	import Console from '$lib/components/console/Console.svelte';
	import FancyInput from '$lib/components/FancyInput.svelte';
	import GameLite from '$lib/game';
	import { BACKEND_URL } from '$lib/utils/constants';
	import { decodeEpiData, decodeRefGenes, decodeStruct } from '$lib/utils/serializations';
	import MySocket from '$lib/utils/sock';
	import { historyStore, viewStore } from '$lib/utils/stores';
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
		askLive: boolean = false,
		liveName: string,
		rejectLive: () => void,
		resolveLive: (name: string) => void,
		id: string;

	$: historyStore.set(sortHist);

	setContext<HistoryContext>('HISTORY_CONTEXT', {
		renameSort: ({ _id, name }: Sort) => {
			axios
				.patch<Sort[]>(`${BACKEND_URL}/history`, { id, _id, name })
				.catch(() => alert('Failed to rename sort; name will be lost on refresh'));
		},
		deleteSort: ({ _id, name }: Sort) => {
			axios
				.delete<Sort[]>(`${BACKEND_URL}/history`, { data: { id, _id, name } })
				.catch(() => alert('Failed to delete sort'));
		}
	});

	setContext<ViewContext>('VIEW_CONTEXT', {
		renameView: ({ _id, name }: View) => {
			axios
				.patch<View[]>(`${BACKEND_URL}/views`, { id, _id, name })
				.catch(() => alert('Failed to rename view; name will be lost on refresh'));
		},
		deleteView: ({ _id, name }: View) => {
			axios
				.delete<View[]>(`${BACKEND_URL}/views`, { data: { id, _id, name } })
				.catch(() => alert('Failed to delete view'));
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
						return new Promise<{ arcs: ArcTrackLite[]; flags: FlagTrackLite[] }>((resolve) => {
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
						res.data.annotations,
						res.data.highlights
					);
					sortHist = res.data.sortHist;
					viewStore.set(res.data.views);
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
						'HIGHLIGHT_ADD',
						'HIGHLIGHT_DEL',
						'HIGHLIGHT_EDIT',
						'VIEW_ADD',
						'VIEW_DEL',
						'VIEW_EDIT',
						'START_LIVE',
						'JOIN_LIVE',
						'LEAVE_LIVE',
						'CAM_CHANGE',
						'SELECT_MESH',
						'TRANSFER_CONTROL',
						'REQUEST_CONTROL'
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

					mainSock.on('HIGHLIGHT_ADD', ({ newHighlight }) => {
						if (!game.highlights.highlights.has(newHighlight.id)) {
							game.highlights.loadHighlight(newHighlight);
						}
					});

					mainSock.on('HIGHLIGHT_EDIT', ({ id, name }) => {
						game.highlights.editHighlight(id, name);
					});

					mainSock.on('HIGHLIGHT_DEL', ({ id }) => {
						if (game.highlights.highlights.has(id)) {
							game.highlights.deleteHighlight(id);
						}
					});

					mainSock.on('VIEW_ADD', ({ newView }) => viewStore.update((prevViews) => [...prevViews, newView]));
					mainSock.on('VIEW_DEL', ({ id }) =>
						viewStore.update((prevViews) => prevViews.filter((view) => view._id !== id))
					);
					mainSock.on('VIEW_EDIT', ({ id, name }) =>
						viewStore.update((prevViews) =>
							prevViews.map((view) => {
								if (view._id === id) {
									view.name = name;
								}
								return view;
							})
						)
					);

					mainSock.on('ANN_ADD', ({ newAnnotation }) => {
						game.gui.loadAnnotation(newAnnotation);
					});

					mainSock.on('ANN_DEL', ({ mesh }) => {
						game.gui.removeAnnotationByName(mesh);
					});

					socket = mainSock;

					if (res.data.live) {
						liveSession = res.data.session;

						getLiveName()
							.then((name) => {
								mainSock.send({
									type: 'JOIN_LIVE',
									name
								});
								new Promise<void>((resolve) => {
									mainSock.on('JOIN_LIVE', ({ id }) => {
										if (id === socketId) {
											resolve();
										}
									});
								}).then(() => {
									askLive = false;
								});
								resolveLive = null;
								rejectLive = null;
							})
							.catch(() => {
								askLive = false;
								resolveLive = null;
								rejectLive = null;
							});
					}
				});
			});
			fetching = true;
		} else if (!id) {
			console.log(`Model id undefined: ${id}`);
		}
	}

	async function getLiveName(): Promise<string> {
		askLive = true;
		return new Promise((resolve, reject) => {
			resolveLive = resolve;
			rejectLive = reject;
		});
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
		width={typeof window === 'undefined' ? 800 : window.innerWidth - 1}
		height={typeof window === 'undefined' ? 600 : window.innerHeight - 1}
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
	{#if askLive}
		<div class="live-menu">
			<h4 class="alert">
				{liveSession.participants.find(({ id }) => id === liveSession.hostID).name} is hosting a live session on this
				model, would you like to join?
			</h4>
			<FancyInput bind:value={liveName} label="Name" id="live-name" />
			<div class="button-row">
				<Button
					type="action"
					on:click={() => {
						if (liveName.trim().length > 0 && resolveLive) {
							resolveLive(liveName);
						}
					}}>Join</Button
				>
				<Button
					type="cancel"
					on:click={() => {
						if (rejectLive) {
							rejectLive();
						}
					}}>Cancel</Button
				>
			</div>
		</div>
	{/if}
	{#if askLive}
		<div
			class="blur"
			on:click={() => {
				if (rejectLive) {
					rejectLive();
				}
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

	.live-menu {
		position: absolute;
		background: white;
		padding: 0.5em 1em;
		border-radius: 4px;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 2;
	}

	.live-menu .alert {
		margin-bottom: 0.25em;
	}

	.live-menu .button-row {
		margin-top: 0.5em;
	}
</style>
