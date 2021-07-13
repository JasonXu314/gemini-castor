import axios from 'axios';
import pkg from 'babylonjs';
import gui from 'babylonjs-gui';
// import { AdvancedDynamicTexture, Rectangle, TextBlock } from 'babylonjs-gui';
import type StructureModule from './structure';
import { BACKEND_URL } from './utils/constants';
import OurBush3D from './utils/ourBush';
import { EventSrc, Logger } from './utils/utils';
// import { AbstractMesh, Color3, Curve3, Mesh, MeshBuilder, StandardMaterial, Vector3 } from 'babylonjs';
const { AdvancedDynamicTexture, Rectangle, TextBlock } = gui;
const { AbstractMesh, Color3, Curve3, Mesh, MeshBuilder, StandardMaterial, Vector3 } = pkg;

interface EpiDataEvents {
	ARC_SHOW: undefined;
	FLAG_SHOW: undefined;
}

/** Class to handle all operations regarding epiData data and rendering */
export default class EpiDataModule {
	/** Logging module */
	private logger: Logger;

	// GUI stuff
	private gui: AdvancedDynamicTexture;
	private unloadedAnnotations: RawAnnotation[];
	public annotationsShown: boolean;

	// IDs for names
	private currFlagID: number;
	private currArcID: number;

	// Flag Data
	private flagMeshes: Record<number, Map<RawFlagTrackData, Mesh>> | null;
	public flagBush: OurBush3D<FBushData>;
	public defaultFlagData: RawFlagTrackData[] | null;
	public flagTracks: Record<number, FlagTrackLite>;
	public flagsShown: boolean;
	public currentRenderedFlagData: RawFlagTrackData[] | null;
	public annotatedFlags: FBushData[];
	public flagAnnotations: Map<FBushData, Rectangle>;

	// Arc Data
	private arcMeshes: Record<number, Map<RawArcTrackData, Mesh>> | null;
	public arcBush: OurBush3D<ABushData>;
	public defaultArcData: RawArcTrackData[] | null;
	public arcTracks: Record<number, ArcTrackLite>;
	public arcsShown: boolean;
	public currentRenderedArcData: RawArcTrackData[] | null;
	public annotatedArcs: ABushData[];
	public arcAnnotations: Map<ABushData, Rectangle>;

	public events: EventSrc<EpiDataEvents>;

	/**
	 * Creates a new epiData module
	 * @param data the data to be used when rendering
	 * @param structure the structure module to be used
	 * @param scene the scene to render in
	 */
	constructor(public data: RawEpiData, private structure: StructureModule, private scene: Scene, private modelId: string) {
		this.logger = new Logger('EpiData');

		this.flagMeshes = null;
		this.flagBush = new OurBush3D<FBushData>();
		this.defaultFlagData = null;
		this.flagTracks = {};
		this.flagsShown = true;
		this.currentRenderedFlagData = null;
		this.annotatedFlags = [];
		this.flagAnnotations = new Map();
		this.currFlagID = 0;

		this.arcMeshes = null;
		this.arcBush = new OurBush3D<ABushData>();
		this.defaultArcData = null;
		this.arcTracks = {};
		this.arcsShown = true;
		this.currentRenderedArcData = null;
		this.annotatedArcs = [];
		this.arcAnnotations = new Map();
		this.currArcID = 0;

		this.events = new EventSrc(['ARC_SHOW', 'FLAG_SHOW']);

		this.gui = AdvancedDynamicTexture.CreateFullscreenUI('annotation-ui');
		this.annotationsShown = true;
		this.unloadedAnnotations = [];

		setInterval(() => {
			axios.get<RawAnnotation[]>(`${BACKEND_URL}/annotations?id=${this.modelId}`).then((res) => {
				const serverAnnotations = res.data;

				const newAnnotations = serverAnnotations.filter((ann) => {
					const mesh = this.scene.getMeshByName(ann.mesh);

					return mesh && !this.hasAnnotation(mesh);
				});
				const deletedAnnotations = [
					...[...this.arcAnnotations.values()].filter((rect) => !serverAnnotations.find((ann) => ann.mesh === rect.linkedMesh.name)),
					...[...this.flagAnnotations.values()].filter((rect) => !serverAnnotations.find((ann) => ann.mesh === rect.linkedMesh.name))
				];

				newAnnotations.forEach((ann) => {
					const mesh = this.scene.getMeshByName(ann.mesh);
					this.addAnnotation(mesh, ann.text, true);
				});
				deletedAnnotations.forEach((rect) => this.removeAnnotation(rect.linkedMesh as AbstractMesh, true));
			});
		}, 5000);

		this.logger.log('Initialized');
	}

	/**
	 * Populates the bush with data, and generates the default epiData data
	 * TODO: implement k-means clustering for (hopefully) faster search times
	 */
	public generateEpiData(): void {
		this.data.flags.forEach((trackData) => {
			const { x: sx, y: sy, z: sz } = trackData.startPos;
			const { x: ex, y: ey, z: ez } = trackData.stopPos;

			this.flagBush.insert({
				maxX: Math.max(sx, ex),
				minX: Math.min(sx, ex),
				maxY: Math.max(sy, ey),
				minY: Math.min(sy, ey),
				maxZ: Math.max(sz, ez),
				minZ: Math.min(sz, ez),
				raw: trackData,
				annotation: null
			});
			if (trackData.id in this.flagTracks) {
				const track = this.flagTracks[trackData.id];
				track.data.push(trackData);
				if (trackData.value > track.max) {
					track.max = trackData.value;
				}
			} else {
				this.flagTracks[trackData.id] = {
					data: [trackData],
					max: trackData.value,
					color: { r: Math.random(), g: Math.random(), b: Math.random() }
				};
			}
		});

		this.data.arcs.forEach((trackData) => {
			const { x: s1x, y: s1y, z: s1z } = trackData.startPos1;
			const { x: e1x, y: e1y, z: e1z } = trackData.stopPos1;
			const { x: s2x, y: s2y, z: s2z } = trackData.startPos2;
			const { x: e2x, y: e2y, z: e2z } = trackData.stopPos2;

			this.arcBush.insert({
				maxX: Math.max(s1x, e1x, s2x, e2x),
				minX: Math.min(s1x, e1x, s2x, e2x),
				maxY: Math.max(s1y, e1y, s2y, e2y),
				minY: Math.min(s1y, e1y, s2y, e2y),
				maxZ: Math.max(s1z, e1z, s2z, e2z),
				minZ: Math.min(s1z, e1z, s2z, e2z),
				raw: trackData,
				annotation: null
			});
			if (trackData.id in this.arcTracks) {
				const track = this.arcTracks[trackData.id];
				track.data.push(trackData);
				if (trackData.score > track.max) {
					track.max = trackData.score;
				}
			} else {
				this.arcTracks[trackData.id] = { data: [trackData], max: trackData.score, color: { r: Math.random(), g: Math.random(), b: Math.random() } };
			}
		});

		this.defaultFlagData = this.data.flags;
		this.defaultArcData = this.data.arcs;
	}

	/**
	 * Renders all the flags from ``flags`` whose values exceed minVal% of the their track's max value (ie. if a track is
	 * ``[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]``, and minVal is 30, only the ``3, 4, 5, 6, 7, 8, 9, and 10`` value flags would be rendered)
	 * @param flags the flags to render to babylon
	 * @param minVal the minimum value for a flag to be rendered, in percent of track maximum value
	 */
	public renderFlags(flags: RawFlagTrackData[], minVal: number = 30): void {
		this.logger.log('Rendering Flags');

		// Only consider flags who exceed the minVal
		const fitFlags = flags.filter((flag) => flag.value >= (minVal / 100) * this.flagTracks[flag.id].max);

		// Flags whose meshes need to be generated
		const newFlags = this.flagMeshes ? fitFlags.filter((flag) => flag.id in this.flagMeshes && !this.flagMeshes[flag.id].has(flag)) : fitFlags;

		if (this.flagMeshes) {
			// Enable the flags that were previously disabled that are supposed to be rendered in this call
			fitFlags.forEach((flag) => {
				if (flag.id in this.flagMeshes && this.flagMeshes[flag.id].has(flag) && !this.flagMeshes[flag.id].get(flag).isEnabled()) {
					this.flagMeshes[flag.id].get(flag).setEnabled(true);
				}
			});

			// Disable the flags that were previously enabled that are NOT supposed to be rendered in this call
			Object.values(this.flagMeshes)
				.reduce<[RawFlagTrackData, Mesh][]>((arr, map) => [...arr, ...map.entries()], [])
				.forEach(([flag, mesh]) => {
					if (!fitFlags.includes(flag) && mesh.isEnabled()) {
						mesh.setEnabled(false);
					}
				});
		}

		if (!this.flagMeshes) {
			this.flagMeshes = {};
		}

		newFlags.forEach((flag) => {
			// The path along the structure that is encompassed by this flag
			const path: Vector3[] = (
				flag.stopTag - flag.startTag <= 1
					? this.structure.data.slice(flag.startTag, flag.startTag + 2)
					: this.structure.data.slice(flag.startTag, flag.stopTag)
			).map(({ x, y, z }) => new Vector3(x, y, z));

			const flagName = `flag-${flag.id}`;
			const mesh = MeshBuilder.CreateTube(
				flagName,
				{
					path: path,
					radius: Math.log(flag.value + 5) * 20,
					cap: Mesh.CAP_ALL,
					updatable: true
				},
				this.scene
			);
			const annotation = this.unloadedAnnotations.find((ann) => ann.mesh === flagName);
			if (annotation) {
				this.addAnnotation(mesh, annotation.text);
			}

			// Apply optimizations
			mesh.freezeWorldMatrix();
			mesh.doNotSyncBoundingInfo = true;
			mesh.cullingStrategy = AbstractMesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY;
			mesh.convertToUnIndexedMesh();

			const { r, g, b } = this.flagTracks[flag.id].color;

			const mat = new StandardMaterial(`flag-mat-${flag.id}`, this.scene);
			mat.diffuseColor = new Color3(r, g, b);
			mat.freeze();
			mesh.material = mat;

			// Update meshes so they can be disposed later
			if (flag.id in this.flagMeshes) {
				this.flagMeshes[flag.id].set(flag, mesh);
			} else {
				this.flagMeshes[flag.id] = new Map([[flag, mesh]]);
			}
		});

		this.currentRenderedFlagData = fitFlags;
		this.events.dispatch('FLAG_SHOW');
	}

	/**
	 * Renders all the arcs from ``arcs`` whose scores exceed minVal% of the their track's max score (ie. if a track is
	 * ``[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]``, and minVal is 30, only the ``3, 4, 5, 6, 7, 8, 9, and 10`` score arcs would be rendered)
	 * @param arcs the arcs to render to babylon
	 * @param minVal the minimum score for a arc to be rendered, in percent of track maximum score
	 */
	public renderArcs(arcs: RawArcTrackData[], minVal: number = 30): void {
		this.logger.log('Rendering Arcs');

		// Only consider arcs who exceed minVal
		const fitArcs = arcs.filter((arc) => arc.score >= (minVal / 100) * this.arcTracks[arc.id].max);

		// Arcs whose meshes need to be generated
		const newArcs = this.arcMeshes ? fitArcs.filter((arc) => arc.id in this.arcMeshes && !this.arcMeshes[arc.id].has(arc)) : fitArcs;

		if (this.arcMeshes) {
			// Enable the arcs that were previously disabled that are supposed to be rendered in this call
			fitArcs.forEach((arc) => {
				if (arc.id in this.arcMeshes && this.arcMeshes[arc.id].has(arc) && !this.arcMeshes[arc.id].get(arc).isEnabled()) {
					this.arcMeshes[arc.id].get(arc).setEnabled(true);
				}
			});

			// Disable the arcs that were previously enabled that are NOT supposed to be rendered in this call
			Object.values(this.arcMeshes)
				.reduce<[RawArcTrackData, Mesh][]>((arr, map) => [...arr, ...map.entries()], [])
				.forEach(([arc, mesh]) => {
					if (!fitArcs.includes(arc) && mesh.isEnabled()) {
						mesh.setEnabled(false);
					}
				});
		}

		if (!this.arcMeshes) {
			this.arcMeshes = {};
		}

		newArcs.forEach((arc) => {
			// Define control point to use in bezier curve
			const controlPoint1 = new Vector3(
				(arc.startPos1.x + arc.stopPos2.x) / 2,
				(arc.startPos1.y + arc.stopPos2.y) / 2,
				(arc.startPos1.z + arc.stopPos2.z) / 2
			);
			const startPoint1 = new Vector3(arc.startPos1.x, arc.startPos1.y, arc.startPos1.z);
			const stopPoint2 = new Vector3(arc.stopPos2.x, arc.stopPos2.y, arc.stopPos2.z);
			const arcBezier1 = Curve3.CreateQuadraticBezier(startPoint1, controlPoint1, stopPoint2, 20).getPoints();

			// if the arc locus does not span more than one point
			if (arc.startTag1 === arc.startTag2 && arc.stopTag1 === arc.stopTag2) {
				const mesh = MeshBuilder.CreateLines(
					`arc-${arc.id in this.arcMeshes ? this.arcMeshes[arc.id].size : 0}`,
					{
						points: arcBezier1,
						updatable: true
					},
					this.scene
				);
				mesh.color = new Color3(1, 0.75, 0);

				// Optimize
				mesh.freezeWorldMatrix();
				mesh.doNotSyncBoundingInfo = true;
				mesh.convertToUnIndexedMesh();
				mesh.cullingStrategy = BABYLON.AbstractMesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY;

				// Update meshes so they can be disposed later
				if (arc.id in this.arcMeshes) {
					this.arcMeshes[arc.id].set(arc, mesh);
				} else {
					this.arcMeshes[arc.id] = new Map([[arc, mesh]]);
				}
			} else {
				// if the arc locus spans more than one point
				// stop1 => start2
				const controlPoint2 = new Vector3(
					(arc.startPos2.x + arc.stopPos1.x) / 2,
					(arc.startPos2.y + arc.stopPos1.y) / 2,
					(arc.startPos2.z + arc.stopPos1.z) / 2
				);
				const startPoint2 = new Vector3(arc.startPos2.x, arc.startPos2.y, arc.startPos2.z);
				const stopPoint1 = new Vector3(arc.stopPos1.x, arc.stopPos1.y, arc.stopPos1.z);
				const arcBezier2 = Curve3.CreateQuadraticBezier(startPoint2, controlPoint2, stopPoint1, 20).getPoints();

				const pathArray = [arcBezier1, arcBezier2];
				const mesh = MeshBuilder.CreateRibbon(
					`arc-${this.currArcID++}`,
					{
						pathArray: pathArray,
						sideOrientation: Mesh.DOUBLESIDE,
						updatable: true
					},
					this.scene
				);
				mesh.visibility = 0.5;
				const arcMat = new StandardMaterial(`arc-mat-${this.currArcID}`, this.scene);
				arcMat.diffuseColor = new Color3(1, 0.75, 0);
				mesh.material = arcMat;
				arcMat.freeze();
				mesh.convertToUnIndexedMesh();

				// Optimize
				mesh.freezeWorldMatrix();
				mesh.doNotSyncBoundingInfo = true;
				mesh.convertToUnIndexedMesh();
				mesh.cullingStrategy = BABYLON.AbstractMesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY;

				// Update meshes so they can be disposed later
				if (arc.id in this.arcMeshes) {
					this.arcMeshes[arc.id].set(arc, mesh);
				} else {
					this.arcMeshes[arc.id] = new Map([[arc, mesh]]);
				}
			}
		});

		this.currentRenderedArcData = fitArcs;
		this.events.dispatch('ARC_SHOW');
	}

	/** Gives user option to toggle off the flag rendering */
	public setFlagsShown(shown: boolean): void {
		if (shown !== this.flagsShown) {
			if (!shown) {
				Object.values(this.flagMeshes).forEach((track) => {
					[...track.values()].forEach((mesh) => {
						mesh.setEnabled(false);
					});
				});
				this.flagsShown = false;
			} else {
				this.renderFlags(this.currentRenderedFlagData);
				this.flagsShown = true;
			}
		}
	}

	/** Gives user option to toggle off the arc rendering */
	public setArcsShown(shown: boolean): void {
		if (shown !== this.arcsShown) {
			if (!shown) {
				Object.values(this.arcMeshes).forEach((track) => {
					[...track.values()].forEach((mesh) => {
						mesh.setEnabled(false);
					});
				});
				this.arcsShown = false;
			} else {
				this.renderArcs(this.currentRenderedArcData);
				this.arcsShown = true;
			}
		}
	}

	/** Gives user option to toggle off the annotation rendering */
	public setAnnotationsShown(shown: boolean): void {
		if (shown !== this.annotationsShown) {
			if (!shown) {
				this.flagAnnotations.forEach((ann) => {
					ann.isVisible = false;
				});
				this.arcAnnotations.forEach((ann) => {
					ann.isVisible = false;
				});
				this.annotationsShown = false;
			} else {
				this.flagAnnotations.forEach((ann) => {
					ann.isVisible = true;
				});
				this.arcAnnotations.forEach((ann) => {
					ann.isVisible = true;
				});
				this.annotationsShown = true;
			}
		}
	}

	/** Utility function to get the bush data for a mesh in the "game" (public because might be used outside, later?) */
	public getBushEntry(mesh: AbstractMesh): ABushData | FBushData {
		const bounds = mesh.getBoundingInfo().boundingBox;
		const { x: maxX, y: maxY, z: maxZ } = bounds.maximumWorld;
		const { x: minX, y: minY, z: minZ } = bounds.minimumWorld;
		const isArc = mesh.name.startsWith('arc');

		return (
			(isArc ? this.arcBush : this.flagBush)
				.search({ maxX, maxY, maxZ, minX, minY, minZ })
				// @ts-ignore this is bad, but it makes the code a lot cleaner
				.find((entry) => {
					const arc = entry.raw;

					return (isArc ? this.arcMeshes : this.flagMeshes)[arc.id].get(arc) === mesh;
				}) as ABushData | FBushData
		);
	}

	/** Attempts to create the GUI elements for the given annotations */
	public loadAnnotations(annotations: RawAnnotation[]): void {
		annotations.forEach((ann) => {
			const mesh = this.scene.getMeshByName(ann.mesh);
			if (mesh) {
				this.addAnnotation(mesh, ann.text, true);
			} else {
				this.unloadedAnnotations.push(ann);
			}
		});
	}

	/** Checks if a mesh is already annotated */
	public hasAnnotation(mesh: AbstractMesh): boolean {
		const bushEntry = this.getBushEntry(mesh);

		return !!bushEntry.annotation;
	}

	/** Creates an annotation for the given mesh; will not notify server if doNotNotify is set */
	public addAnnotation(mesh: AbstractMesh, annotation: string, doNotNotify: boolean = false): void {
		const isArc = mesh.name.startsWith('arc');
		const bushEntry = this.getBushEntry(mesh);

		if (bushEntry) {
			bushEntry.annotation = annotation;
		}

		// Make annotation BABYLON ui thingy
		const rect = new Rectangle(mesh.name + '-annotation-body');
		rect.background = 'rgba(0, 0, 0, 0.5)';
		rect.height = annotation.split('\n').length * 24 + 16 + 'px';
		rect.width =
			annotation
				.split('\n')
				.map((str) => str.length)
				.reduce((max, num) => Math.max(max, num), 0) *
				12 +
			'px';

		const text = new TextBlock(mesh.name + '-annotation-text', annotation);
		text.color = 'white';
		rect.addControl(text);
		rect.isVisible = this.annotationsShown;
		this.gui.addControl(rect);
		rect.linkWithMesh(mesh);

		// @ts-ignore this is bad, but it makes the code a lot cleaner
		(isArc ? this.arcAnnotations : this.flagAnnotations).set(bushEntry, rect);
		// @ts-ignore this is bad, but it makes the code a lot cleaner
		(isArc ? this.annotatedArcs : this.annotatedFlags).push(bushEntry);

		if (!doNotNotify) {
			axios
				.post<RawAnnotation[]>(`${BACKEND_URL}/annotations`, { id: this.modelId, annotation: { mesh: mesh.name, text: annotation } })
				.then((res) => {
					const serverAnnotations = res.data;

					const newAnnotations = serverAnnotations.filter((ann) => {
						const mesh = this.scene.getMeshByName(ann.mesh);

						return mesh && !this.hasAnnotation(mesh);
					});
					const deletedAnnotations = [
						...[...this.arcAnnotations.values()].filter((rect) => !serverAnnotations.find((ann) => ann.mesh === rect.linkedMesh.name)),
						...[...this.flagAnnotations.values()].filter((rect) => !serverAnnotations.find((ann) => ann.mesh === rect.linkedMesh.name))
					];

					newAnnotations.forEach((ann) => {
						const mesh = this.scene.getMeshByName(ann.mesh);
						this.addAnnotation(mesh, ann.text, true);
					});
					deletedAnnotations.forEach((rect) => this.removeAnnotation(rect.linkedMesh as AbstractMesh, true));
				});
		}
	}

	/** Removes whatever annotation from the given mesh (if there is one) */
	public removeAnnotation(mesh: AbstractMesh, doNotNotify: boolean = false): void {
		const isArc = mesh.name.startsWith('arc');
		const bushEntry = this.getBushEntry(mesh);

		if (bushEntry) {
			// @ts-ignore this is bad, but it makes the code a lot cleaner
			(isArc ? this.annotatedArcs : this.annotatedFlags).splice(this.annotatedFlags.indexOf(bushEntry), 1);
		}
		bushEntry.annotation = null;

		// @ts-ignore this is bad, but it makes the code a lot cleaner
		(isArc ? this.arcAnnotations : this.flagAnnotations).get(bushEntry).dispose();
		// @ts-ignore this is bad, but it makes the code a lot cleaner
		(isArc ? this.arcAnnotations : this.flagAnnotations).delete(bushEntry);
		if (isArc) {
			this.annotatedArcs = this.annotatedArcs.filter((data) => data !== bushEntry);
		} else {
			this.annotatedFlags = this.annotatedFlags.filter((data) => data !== bushEntry);
		}

		if (!doNotNotify) {
			axios.delete<RawAnnotation[]>(`${BACKEND_URL}/annotations`, { data: { id: this.modelId, name: mesh.name } }).then((res) => {
				const serverAnnotations = res.data;

				const newAnnotations = serverAnnotations.filter((ann) => {
					const mesh = this.scene.getMeshByName(ann.mesh);

					return mesh && !this.hasAnnotation(mesh);
				});
				const deletedAnnotations = [
					...[...this.arcAnnotations.values()].filter((rect) => !serverAnnotations.find((ann) => ann.mesh === rect.linkedMesh.name)),
					...[...this.flagAnnotations.values()].filter((rect) => !serverAnnotations.find((ann) => ann.mesh === rect.linkedMesh.name))
				];

				newAnnotations.forEach((ann) => {
					const mesh = this.scene.getMeshByName(ann.mesh);
					this.addAnnotation(mesh, ann.text, true);
				});
				deletedAnnotations.forEach((rect) => this.removeAnnotation(rect.linkedMesh as AbstractMesh, true));
			});
		}
	}

	/** Clears the arcs */
	public clearArcs(): void {
		this.logger.log('Clearing Arcs');
		for (const i in this.arcMeshes) {
			this.arcMeshes[i].forEach((mesh) => {
				mesh.dispose();
			});
		}
		this.arcMeshes = null;
	}

	/** Clears the flags */
	public clearFlags(): void {
		this.logger.log('Clearing Flags');
		for (const i in this.flagMeshes) {
			this.flagMeshes[i].forEach((mesh) => {
				mesh.dispose();
			});
		}
		this.flagMeshes = null;
	}
}
