<script lang="ts">
	import { page } from '$app/stores';
	import GameLite from '$lib/game';
	import { BACKEND_URL } from '$lib/utils/constants';
	import { decodeEpiData, decodeRefGenes, decodeStruct } from '$lib/utils/serializations';
	import axios from 'axios';
	import { onMount } from 'svelte';

	let id: string, canvas: HTMLCanvasElement;

	page.subscribe((page) => {
		id = page.params.id;
	});

	onMount(tryFetch);

	function tryFetch() {
		axios.get<Model>(`${BACKEND_URL}/models/${id}?nosocket=true`).then((res) => {
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
				const game = new GameLite(
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
				game.preview();
			});
		});
	}
</script>

<canvas
	class="canvas"
	bind:this={canvas}
	width={typeof window === 'undefined' ? 800 : window.innerWidth - 1}
	height={typeof window === 'undefined' ? 600 : window.innerHeight - 1}
/>

<style>
	.canvas {
		display: block;
	}
</style>
