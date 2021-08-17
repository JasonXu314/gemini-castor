<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import FancyInput from '$lib/components/FancyInput.svelte';
	import type GameLite from '$lib/game';
	import { Vector3 } from '$lib/utils/babylon';
	import type MySocket from '$lib/utils/sock';
	import { getContext } from 'svelte';

	export let game: GameLite;
	export let socket: MySocket<SocketReceiveMsgs, SocketSendMsgs>;
	export let socketId: string;
	export let liveSession: LiveSessionData | null;
	export let closed: boolean;
	export let inSession: boolean = false;
	export let inControl: boolean = false;

	let name: string = '',
		hasLive: boolean = false,
		hostId: string | null = null,
		controllerId: string | null = null,
		participants: LiveParticipant[] = [],
		transferControl: boolean = false,
		unsub: () => void | null;

	const { pushRequest } = getContext<ControlRequestContext>('CONTROL_REQUEST_CONTEXT');

	$: hasLive = !!liveSession;
	$: participants = liveSession ? liveSession.participants : [];
	$: hostId = liveSession ? liveSession.hostID : null;
	$: controllerId = liveSession ? liveSession.controllerID : null;
	$: inControl = inSession && controllerId === socketId;

	$: {
		if (liveSession) {
			if (!inSession) {
				if (unsub) {
					unsub();
				}
				unsub = socket.on('CAM_CHANGE', ({ camPos, camRot }) => {
					liveSession.camPos = camPos;
					liveSession.camRot = camRot;
				});
			} else {
				if (unsub) {
					unsub();
				}
				unsub = null;
			}
		}
	}

	socket.on('START_LIVE', ({ data }) => {
		liveSession = data;

		if (data.hostID === socketId) {
			inSession = true;

			socket.on('REQUEST_CONTROL', (req) => {
				pushRequest(req);
			});
		}
	});

	socket.on('JOIN_LIVE', ({ id, name }) => {
		participants = [...participants, { id, name }];

		if (id === socketId) {
			inSession = true;

			const { x, y, z } = liveSession.camPos;
			const { x: rx, y: ry, z: rz } = liveSession.camRot;

			game.camera.position = new Vector3(x, y, z);
			game.camera.rotation = new Vector3(rx, ry, rz);
			if (unsub) {
				unsub();
			}
			unsub = null;
		}
	});

	socket.on('LEAVE_LIVE', ({ id }) => {
		participants = participants.filter(({ id: pId }) => pId !== id);
		if (id === socketId) {
			inSession = false;
		}
		if (id === controllerId) {
			controllerId = hostId;
		}
	});

	socket.on('END_LIVE', () => {
		liveSession = null;
		inSession = false;
	});

	socket.on('TRANSFER_CONTROL', ({ id }) => {
		controllerId = id;
	});

	socket.on('CAM_CHANGE', ({ camPos, camRot }) => {
		if (inSession && controllerId !== socketId) {
			const { x, y, z } = camPos;
			const { x: rx, y: ry, z: rz } = camRot;

			game.camera.position = new Vector3(x, y, z);
			game.camera.rotation = new Vector3(rx, ry, rz);
			game.camera.inertia = 0;

			setTimeout(() => {
				game.camera.inertia = 0.75;
			}, 0);
		}
	});

	socket.on('SELECT_MESH', ({ mesh }) => {
		if (inSession && controllerId !== socketId) {
			game.selectMesh(mesh);
		}
	});

	socket.on('EXECUTE_SELECTORS', () => {
		if (inSession && !inControl) {
			game.executeSearches();
		}
	});

	socket.on('CLEAR_SELECTORS', () => {
		if (inSession && !inControl) {
			game.reset();
		}
	});

	socket.on('RECALL_SORT', ({ sort }) => {
		if (inSession && !inControl) {
			game.events.dispatch('RECALL_SORT', sort);
		}
	});

	game.events.on('CAM_CHANGE', () => {
		if (inSession && controllerId === socketId) {
			const { x, y, z } = game.camera.position;
			const { x: rx, y: ry, z: rz } = game.camera.rotation;

			socket.send({
				type: 'CAM_CHANGE',
				camPos: { x, y, z },
				camRot: { x: rx, y: ry, z: rz }
			});
		}
	});

	game.radSelect.events.on('PARAMS_CHANGE', (params) => {
		if (inSession && inControl) {
			socket.send({ type: 'RADIUS_PARAM_CHANGE', ...params });
		}
	});

	game.volSelect.events.on('PARAMS_CHANGE', (params) => {
		if (inSession && inControl) {
			socket.send({ type: 'VOLUME_PARAM_CHANGE', ...params });
		}
	});

	game.bpsSelect.events.on('PARAMS_CHANGE', (params) => {
		if (inSession && inControl) {
			socket.send({ type: 'BPS_PARAM_CHANGE', ...params });
		}
	});

	game.events.on('ACTIVE', () => {
		if (inSession && inControl) {
			socket.send({ type: 'EXECUTE_SELECTORS' });
		}
	});

	game.events.on('RESET', () => {
		if (inSession && inControl) {
			socket.send({ type: 'CLEAR_SELECTORS' });
		}
	});

	game.events.on('SELECT_FEATURE', (selectedFeature: EpiDataFeature) => {
		if (inSession && inControl) {
			socket.send({
				type: 'SELECT_MESH',
				mesh: selectedFeature.mesh.name
			});
		}
	});

	game.events.on('SELECT_HIGHLIGHT', (selectedHighlight: RawHighlight) => {
		if (inSession && inControl) {
			socket.send({
				type: 'SELECT_MESH',
				mesh: `highlight-${selectedHighlight.id}`
			});
		}
	});

	game.events.on('RECALL_SORT', (sort) => {
		if (inSession && inControl) {
			socket.send({
				type: 'RECALL_SORT',
				sort
			});
		}
	});
</script>

<div class="console" class:hidden={closed}>
	<div class="controls">
		<Button
			type={hasLive && inSession ? 'cancel' : 'action'}
			on:click={() => {
				if (!hasLive) {
					if (name.trim().length > 0) {
						const { x, y, z } = game.camera.position;
						const { x: rx, y: ry, z: rz } = game.camera.rotation;

						socket.send({
							type: 'START_LIVE',
							camPos: { x, y, z },
							camRot: { x: rx, y: ry, z: rz },
							name
						});
					}
				} else {
					if (inSession) {
						if (hostId === socketId) {
							socket.send({ type: 'END_LIVE' });
						} else {
							socket.send({ type: 'LEAVE_LIVE' });
						}
					} else {
						if (name.trim().length > 0) {
							socket.send({
								type: 'JOIN_LIVE',
								name
							});
						}
					}
				}
			}}
			>{hasLive
				? inSession
					? hostId === socketId
						? 'End Live Session'
						: 'Leave Live Session'
					: 'Join Live Session'
				: 'Create Live Session'}</Button
		>
		<FancyInput dark disabled={inSession} id="name" label="Name" bind:value={name} />
	</div>
	<div class="participants">
		{#each participants as participant}
			<div class="participant">
				<div class="top">
					<h4 class="name">{participant.name}</h4>
					{#if transferControl && socketId !== participant.id}
						<Button
							smol
							type="action"
							on:click={() => {
								socket.send({ type: 'TRANSFER_CONTROL', id: participant.id });
								transferControl = false;
							}}>Transfer</Button
						>
					{/if}
				</div>
				<small class="id">{participant.id}</small>
			</div>
		{/each}
	</div>
	{#if hasLive && inSession}
		<div class="btns">
			{#if hostId === socketId && controllerId === socketId}
				<Button
					type={transferControl ? 'cancel' : 'action'}
					on:click={() => {
						transferControl = !transferControl;
					}}>{transferControl ? 'Cancel' : 'Transfer Control'}</Button
				>
			{:else if hostId === socketId && controllerId !== socketId}
				<Button
					type="cancel"
					on:click={() => {
						socket.send({ type: 'REVERT_CONTROL' });
					}}>Reclaim Control</Button
				>
			{:else if hostId !== socketId && controllerId === socketId}
				<Button
					type="cancel"
					on:click={() => {
						socket.send({ type: 'REVERT_CONTROL' });
					}}>Release Control</Button
				>
			{:else}
				<Button
					type="action"
					on:click={() => {
						socket.send({ type: 'REQUEST_CONTROL', id: socketId });
					}}>Request Control</Button
				>
			{/if}
		</div>
	{/if}
</div>

<style>
	.console {
		color: white;
		background: rgba(0, 0, 0, 0);
		padding: 0.5em 1em;
		display: flex;
		flex-direction: row;
	}

	.console.hidden {
		display: none;
	}

	.participants {
		display: flex;
		flex-direction: column;
		margin: 0 2em;
		overflow-x: hidden;
		overflow-y: scroll;
		max-height: 300px;
		padding-bottom: 1px;
	}

	.participants::-webkit-scrollbar {
		width: 0;
	}

	.participants .participant {
		border: 1px solid white;
		color: white;
		padding: 0.25em 0.5em;
		margin-bottom: -1px;
	}

	.top {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
	}

	.id {
		font-size: xx-small;
	}

	.btns {
		display: flex;
		flex-direction: column;
	}
</style>
