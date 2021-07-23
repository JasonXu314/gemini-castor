<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import FancyInput from '$lib/components/FancyInput.svelte';
	import type GameLite from '$lib/game';
	import type MySocket from '$lib/utils/sock';
	import { Vector3 } from 'babylonjs';

	export let game: GameLite;
	export let socket: MySocket<SocketReceiveMsgs, SocketSendMsgs>;
	export let socketId: string;
	export let liveSession: LiveSessionData | null;
	export let closed: boolean;

	let name: string = '',
		hasLive: boolean = false,
		inSession: boolean = false,
		hostId: string | null = null,
		participants: LiveParticipant[] = [],
		unsub: () => void | null;

	$: hasLive = !!liveSession;
	$: participants = liveSession ? liveSession.participants : [];
	$: hostId = liveSession ? liveSession.hostID : null;

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

		const { x, y, z } = data.camPos;
		const { x: rx, y: ry, z: rz } = data.camRot;

		game.camera.position = new Vector3(x, y, z);
		game.camera.rotation = new Vector3(rx, ry, rz);

		if (data.hostID === socketId) {
			inSession = true;
			game.events.on('CAM_CHANGE', () => {
				const { x, y, z } = game.camera.position;
				const { x: rx, y: ry, z: rz } = game.camera.rotation;

				socket.send({
					type: 'CAM_CHANGE',
					camPos: { x, y, z },
					camRot: { x: rx, y: ry, z: rz }
				});
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

			socket.on('CAM_CHANGE', ({ camPos, camRot }) => {
				const { x, y, z } = camPos;
				const { x: rx, y: ry, z: rz } = camRot;

				game.camera.position = new Vector3(x, y, z);
				game.camera.rotation = new Vector3(rx, ry, rz);
			});
		}
	});
</script>

<div class="console" class:hidden={closed}>
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
		}}>{hasLive ? (inSession ? (hostId === socketId ? 'End Live Session' : 'Leave Live Session') : 'Join Live Session') : 'Create Live Session'}</Button
	>
	<FancyInput dark disabled={inSession} id="name" label="Name" bind:value={name} />
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
</style>
