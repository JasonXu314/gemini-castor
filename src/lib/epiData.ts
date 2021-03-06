import {
	AbstractMesh,
	Color3,
	Curve3,
	Mesh,
	MeshBuilder,
	StandardMaterial,
	Vector3,
	VertexData
} from '$lib/utils/babylon';
import axios from 'axios';
import type GUIModule from './gui';
import type StructureModule from './structure';
import { BACKEND_URL } from './utils/constants';
import OurBush3D from './utils/ourBush';
import { EventSrc, Logger } from './utils/utils';

interface EpiDataEvents {
	ARC_SHOW: undefined;
	FLAG_SHOW: undefined;
}

/** Class to handle all operations regarding epiData data and rendering */
export default class EpiDataModule {
	/** Logging module */
	private logger: Logger;

	// GUI stuff
	public annotationsShown: boolean;

	// Flag Data
	private flagMeshes: Record<number, Map<RawFlagTrackData, Mesh>> | null;
	private flagIndexMap: Map<RawFlagTrackData, number>;
	public flagBush: OurBush3D<FBushData>;
	public defaultFlagData: RawFlagTrackData[] | null;
	public flagTracks: Record<number, FlagTrackLite>;
	public flagsShown: boolean;
	public currentRenderedFlagData: RawFlagTrackData[] | null;
	public annotatedFlagMeshes: Map<FBushData, AbstractMesh>;

	// Arc Data
	private arcMeshes: Record<number, Map<RawArcTrackData, RenderedArc>> | null;
	private arcIndexMap: Map<RawArcTrackData, number>;
	public arcBush: OurBush3D<ABushData>;
	public defaultArcData: RawArcTrackData[] | null;
	public arcTracks: Record<number, ArcTrackLite>;
	public arcsShown: boolean;
	public currentRenderedArcData: RawArcTrackData[] | null;
	public annotatedArcMeshes: Map<ABushData, AbstractMesh[]>;

	public events: EventSrc<EpiDataEvents>;

	/**
	 * Creates a new epiData module
	 * @param data the data to be used when rendering
	 * @param structure the structure module to be used
	 * @param scene the scene to render in
	 */
	constructor(
		public data: RawEpiData,
		private structure: StructureModule,
		private gui: GUIModule,
		private scene: Scene,
		private modelId: string
	) {
		this.logger = new Logger('EpiData');

		this.flagMeshes = null;
		this.flagIndexMap = new Map();
		this.flagBush = new OurBush3D<FBushData>();
		this.defaultFlagData = null;
		this.flagTracks = {};
		this.flagsShown = true;
		this.currentRenderedFlagData = null;
		this.annotatedFlagMeshes = new Map();

		this.arcMeshes = null;
		this.arcIndexMap = new Map();
		this.arcBush = new OurBush3D<ABushData>();
		this.defaultArcData = null;
		this.arcTracks = {};
		this.arcsShown = true;
		this.currentRenderedArcData = null;
		this.annotatedArcMeshes = new Map();

		this.events = new EventSrc(['ARC_SHOW', 'FLAG_SHOW']);

		this.annotationsShown = true;

		this.logger.log('Initialized');
	}

	/**
	 * Populates the bush with data, and generates the default epiData data
	 * TODO: implement k-means clustering for (hopefully) faster search times
	 */
	public generateEpiData(): void {
		let flagIndex = 0;
		this.data.flags.forEach((track) => {
			track.data.forEach((trackData) => {
				const { x: sx, y: sy, z: sz } = trackData.startPos;
				const { x: ex, y: ey, z: ez } = trackData.stopPos;

				this.flagBush.insert({
					maxX: Math.max(sx, ex),
					minX: Math.min(sx, ex),
					maxY: Math.max(sy, ey),
					minY: Math.min(sy, ey),
					maxZ: Math.max(sz, ez),
					minZ: Math.min(sz, ez),
					raw: trackData
				});
				this.flagIndexMap.set(trackData, flagIndex++);
			});
			this.flagTracks[track.id] = track;
		});

		let arcIndex = 0;
		this.data.arcs.forEach((track) => {
			track.data.forEach((trackData) => {
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
					raw: trackData
				});
				this.arcIndexMap.set(trackData, arcIndex++);
			});
			this.arcTracks[track.id] = track;
		});

		this.defaultFlagData = this.data.flags.reduce((acc, flag) => [...acc, ...flag.data], []);
		this.defaultArcData = this.data.arcs.reduce((acc, arc) => [...acc, ...arc.data], []);
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
		const newFlags = this.flagMeshes
			? fitFlags.filter((flag) => flag.id in this.flagMeshes && !this.flagMeshes[flag.id].has(flag))
			: fitFlags;

		if (this.flagMeshes) {
			// Enable the flags that were previously disabled that are supposed to be rendered in this call
			fitFlags.forEach((flag) => {
				if (
					flag.id in this.flagMeshes &&
					this.flagMeshes[flag.id].has(flag) &&
					!this.flagMeshes[flag.id].get(flag).isEnabled()
				) {
					const mesh = this.flagMeshes[flag.id].get(flag);
					mesh.setEnabled(true);

					this.gui.enableAnnotation(mesh);
				}
			});

			// Disable the flags that were previously enabled that are NOT supposed to be rendered in this call
			Object.values(this.flagMeshes)
				.reduce<[RawFlagTrackData, Mesh][]>((arr, map) => [...arr, ...map.entries()], [])
				.forEach(([flag, mesh]) => {
					if (!fitFlags.includes(flag) && mesh.isEnabled()) {
						mesh.setEnabled(false);

						this.gui.disableAnnotation(mesh);
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

			// scaling value for flag height/width
			const scale = 50 * flag.value / this.flagTracks[flag.id].max;

			// shape for flag mesh
			const shape = [
				new Vector3(-1, 0, 0).scale(scale),
				new Vector3(-1, 5, 0).scale(scale),
				new Vector3(1, 5, 0).scale(scale),
				new Vector3(1, 0, 0).scale(scale),
				new Vector3(-1, 0, 0).scale(scale)
			];

			const flagIndex = this.flagIndexMap.get(flag);
			const flagName = `flag-${flagIndex}`;
			const mesh = MeshBuilder.ExtrudeShape(
				flagName,
				{
					shape,
					path,
					sideOrientation: Mesh.DOUBLESIDE,
					cap: Mesh.CAP_ALL,
					updatable: true
				},
				this.scene
			);

			// Apply optimizations
			mesh.freezeWorldMatrix();
			mesh.doNotSyncBoundingInfo = true;
			mesh.cullingStrategy = AbstractMesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY;
			mesh.convertToUnIndexedMesh();

			const { r, g, b } = this.flagTracks[flag.id].color;

			const mat = new StandardMaterial('flag-mat', this.scene);
			mat.diffuseColor = new Color3(r / 255, g / 255, b / 255);
			mat.freeze();
			mesh.material = mat;

			// Update meshes so they can be disposed later
			if (flag.id in this.flagMeshes) {
				this.flagMeshes[flag.id].set(flag, mesh);
			} else {
				this.flagMeshes[flag.id] = new Map([[flag, mesh]]);
			}
		});

		this.gui.checkAnnotations();
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
		const newArcs = this.arcMeshes
			? fitArcs.filter((arc) => arc.id in this.arcMeshes && !this.arcMeshes[arc.id].has(arc))
			: fitArcs;

		if (this.arcMeshes) {
			// Enable the arcs that were previously disabled that are supposed to be rendered in this call
			fitArcs.forEach((arc) => {
				if (
					arc.id in this.arcMeshes &&
					this.arcMeshes[arc.id].has(arc) &&
					!this.arcMeshes[arc.id].get(arc).enabled
				) {
					const meshes = this.arcMeshes[arc.id].get(arc);
					meshes.enabled = true;
					meshes.lines.setEnabled(true);
					meshes.cubes.forEach((cube) => cube.setEnabled(true));
					meshes.tris.forEach((tri) => tri.setEnabled(true));
					const bushEntry = this.getBushEntry(meshes.lines) as ABushData;

					const annotatedMeshes = this.annotatedArcMeshes.get(bushEntry);
					if (annotatedMeshes) {
						annotatedMeshes.forEach((mesh) => {
							this.gui.enableAnnotation(mesh);
						});
					}
				}
			});

			// Disable the arcs that were previously enabled that are NOT supposed to be rendered in this call
			Object.values(this.arcMeshes)
				.reduce<[RawArcTrackData, RenderedArc][]>((arr, map) => [...arr, ...map.entries()], [])
				.forEach(([arc, mesh]) => {
					if (!fitArcs.includes(arc) && mesh.enabled) {
						mesh.enabled = false;
						mesh.lines.setEnabled(false);
						mesh.cubes.forEach((cube) => cube.setEnabled(false));
						mesh.tris.forEach((tri) => tri.setEnabled(false));
						const bushEntry = this.getBushEntry(mesh.lines) as ABushData;

						const annotatedMeshes = this.annotatedArcMeshes.get(bushEntry);
						if (annotatedMeshes) {
							annotatedMeshes.forEach((mesh) => {
								this.gui.disableAnnotation(mesh);
							});
						}
					}
				});
		}

		if (!this.arcMeshes) {
			this.arcMeshes = {};
		}

		newArcs.forEach((arc) => {
			// if the arc locus does not span more than one point
			const sbp = arc.startTag1 === arc.startTag2;
			const startPoint1 = new Vector3(arc.startPos1.x, arc.startPos1.y, arc.startPos1.z);
			const stopPoint1 = new Vector3(arc.stopPos1.x, arc.stopPos1.y, arc.stopPos1.z);
			const startPoint2 = sbp ? null : new Vector3(arc.startPos2.x, arc.startPos2.y, arc.startPos2.z);
			const stopPoint2 = sbp ? null : new Vector3(arc.stopPos2.x, arc.stopPos2.y, arc.stopPos2.z);
			const midPoint = sbp
				? null
				: new Vector3(
						(startPoint1.x + startPoint2.x + stopPoint1.x + stopPoint2.x) / 4,
						(startPoint1.y + startPoint2.y + stopPoint1.y + stopPoint2.y) / 4,
						(startPoint1.z + startPoint2.z + stopPoint1.z + stopPoint2.z) / 4
				  );
			const startJoint = sbp
				? null
				: new Vector3(
						(startPoint1.x + startPoint2.x + midPoint.x) / 3,
						(startPoint1.y + startPoint2.y + midPoint.y) / 3,
						(startPoint1.z + startPoint2.z + midPoint.z) / 3
				  );
			const stopJoint = sbp
				? null
				: new Vector3(
						(stopPoint1.x + stopPoint2.x + midPoint.x) / 3,
						(stopPoint1.y + stopPoint2.y + midPoint.y) / 3,
						(stopPoint1.z + stopPoint2.z + midPoint.z) / 3
				  );

			const lines = sbp ? [startPoint1, stopPoint1] : [startJoint, stopJoint];
			const cubes = sbp ? [startPoint1, stopPoint1] : [startPoint1, startPoint2, stopPoint1, stopPoint2];
			const triangles = sbp
				? []
				: [
						[startPoint1, startJoint, startPoint2],
						[stopPoint1, stopJoint, stopPoint2]
				  ];
			const arcIndex = this.arcIndexMap.get(arc);

			// Scale of arc line mesh
			const scale = 50;

			// path of line
			const path = Curve3.CreateCatmullRomSpline(lines, 10, false).getPoints();

			// Defines shape that will be extruded
			const shape = [
				new Vector3(1, 1, 0),
				new Vector3(0, 0, 0),
				new Vector3(0, 1, 0),
				new Vector3(-0.2, 1.3, 0),
				new Vector3(-1, 1, 0)
			];

			const linesName = `arc-${arcIndex}-lines`;
			const { r: lmr, g: lmg, b: lmb } = this.arcTracks[arc.id].color;

			const linesMat = new StandardMaterial('arc-lines-mat', this.scene);
			linesMat.diffuseColor = new Color3(lmr / 255, lmg / 255, lmb / 255);
			const linesMesh = MeshBuilder.ExtrudeShape(
				linesName,
				{
					shape,
					path,
					rotation: Math.PI / 3,
					scale,
					sideOrientation: Mesh.DOUBLESIDE,
					updatable: true
				},
				this.scene
			);
			linesMesh.material = linesMat;

			// Optimize
			// mesh.freezeWorldMatrix();
			// mesh.doNotSyncBoundingInfo = true;
			// mesh.convertToUnIndexedMesh();
			// mesh.cullingStrategy = BABYLON.AbstractMesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY;

			const cubeMeshes = cubes.map((cube, i) => {
				const cubeName = `arc-${arcIndex}-cube-${i}`;
				const cubeMesh = MeshBuilder.CreateBox(
					cubeName,
					{
						size: 50,
						updatable: true
					},
					this.scene
				);
				cubeMesh.position = cube;

				const mat = new StandardMaterial('arc-cube-mat', this.scene);
				cubeMesh.material = mat;

				return cubeMesh;
			});

			const tris = triangles.map((tri, i) => {
				const triName = `arc-${arcIndex}-tri-${i}`;
				const triMesh = new Mesh(triName, this.scene);
				const pos = [tri[0].x, tri[0].y, tri[0].z, tri[1].x, tri[1].y, tri[1].z, tri[2].x, tri[2].y, tri[2].z];
				const ind = [0, 1, 2];
				const norm = [];
				const vertData = new VertexData();
				VertexData.ComputeNormals(pos, ind, norm);
				vertData.positions = pos;
				vertData.indices = ind;
				vertData.normals = norm;
				vertData.applyToMesh(triMesh);

				const mat = new StandardMaterial('arc-tri-mat', this.scene);
				triMesh.material = mat;

				return triMesh;
			});

			const renderedArc: RenderedArc = {
				enabled: true,
				cubes: cubeMeshes,
				lines: linesMesh,
				tris
			};

			// Update meshes so they can be disposed later
			if (arc.id in this.arcMeshes) {
				this.arcMeshes[arc.id].set(arc, renderedArc);
			} else {
				this.arcMeshes[arc.id] = new Map([[arc, renderedArc]]);
			}
		});

		this.gui.checkAnnotations();
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
				this.gui.checkVisible();
			} else {
				this.renderFlags(this.currentRenderedFlagData);
				this.flagsShown = true;
				this.gui.checkVisible();
			}
		}
	}

	/** Gives user option to toggle off the arc rendering */
	public setArcsShown(shown: boolean): void {
		if (shown !== this.arcsShown) {
			if (!shown) {
				Object.values(this.arcMeshes).forEach((track) => {
					[...track.values()].forEach((renderedArc) => {
						renderedArc.enabled = false;
						renderedArc.cubes.forEach((cube) => cube.setEnabled(false));
						renderedArc.tris.forEach((tri) => tri.setEnabled(false));
						renderedArc.lines.setEnabled(false);
					});
				});
				this.arcsShown = false;
				this.gui.checkVisible();
			} else {
				this.renderArcs(this.currentRenderedArcData);
				this.arcsShown = true;
				this.gui.checkVisible();
			}
		}
	}

	/** Gives user option to toggle off the annotation rendering */
	public setAnnotationsShown(shown: boolean): void {
		if (shown !== this.annotationsShown) {
			if (!shown) {
				[
					...this.annotatedFlagMeshes.values(),
					...[...this.annotatedArcMeshes.values()].reduce((acc, meshes) => [...acc, ...meshes], [])
				].forEach((mesh) => {
					this.gui.disableAnnotation(mesh);
				});
				this.annotationsShown = false;
			} else {
				[
					...this.annotatedFlagMeshes.values(),
					...[...this.annotatedArcMeshes.values()].reduce((acc, meshes) => [...acc, ...meshes], [])
				].forEach((mesh) => {
					this.gui.enableAnnotation(mesh);
				});
				this.annotationsShown = true;
			}
		}
	}

	/** Utility function to get the bush data for a mesh in the "game" (public because might be used outside, later?) */
	public getBushEntry(mesh: AbstractMesh): ABushData | FBushData {
		// get the bounding data of the mesh as a starting point
		const bounds = mesh.getBoundingInfo().boundingBox;
		const { x: maxX, y: maxY, z: maxZ } = bounds.maximumWorld;
		const { x: minX, y: minY, z: minZ } = bounds.minimumWorld;
		const isArc = mesh.name.startsWith('arc');

		return (
			(isArc ? this.arcBush : this.flagBush)
				.search({ maxX, maxY, maxZ, minX, minY, minZ })
				// @ts-ignore this is bad, but it makes the code a lot cleaner
				.find((entry: ABushData | FBushData) => {
					const rawEntry = entry.raw;

					if (isArc) {
						// if the selected mesh is part of a flag, we need to find which part of the flag it is
						const type = mesh.name.includes('lines')
							? 'lines'
							: mesh.name.includes('cube')
							? 'cubes'
							: 'tris';

						const renderedArc = this.arcMeshes[rawEntry.id].get(rawEntry as RawArcTrackData);
						// Sometimes, selection is imprecise (ie. includes data that isn't rendered), ignore those
						if (!renderedArc) {
							return false;
						}
						if (type === 'lines') {
							// just run a direct equality check
							return renderedArc.lines === mesh;
						} else {
							// see if any of the cubes or triangles are the selected mesh
							return renderedArc[type].includes(mesh as Mesh);
						}
					} else {
						// just run a direct equality check
						return this.flagMeshes[rawEntry.id].get(rawEntry as RawFlagTrackData) === mesh;
					}
				}) as ABushData | FBushData
		);
	}

	/** Creates an annotation for the given mesh; will not notify server if doNotNotify is set */
	public addAnnotation(mesh: AbstractMesh, annotation: string, doNotNotify: boolean = false): void {
		const isArc = mesh.name.startsWith('arc');
		const bushEntry = this.getBushEntry(mesh);

		this.gui.makeAnnotation(mesh, annotation);

		if (isArc) {
			const meshes = this.annotatedArcMeshes.get(bushEntry as ABushData);
			if (meshes) {
				meshes.push(mesh);
			} else {
				this.annotatedArcMeshes.set(bushEntry as ABushData, [mesh]);
			}
		} else {
			this.annotatedFlagMeshes.set(bushEntry as FBushData, mesh);
		}

		if (!doNotNotify) {
			// Notify server that a new annotation has been added
			axios.post<RawAnnotation[]>(`${BACKEND_URL}/annotations`, {
				id: this.modelId,
				annotation: { mesh: mesh.name, text: annotation }
			});
		}
	}

	/** Removes whatever annotation from the given mesh (if there is one) */
	public removeAnnotation(mesh: AbstractMesh, doNotNotify: boolean = false): void {
		const isArc = mesh.name.startsWith('arc');
		const bushEntry = this.getBushEntry(mesh);

		this.gui.removeAnnotationFromMesh(mesh);

		if (isArc) {
			// remove from the right list
			const meshes = this.annotatedArcMeshes.get(bushEntry as ABushData)!;

			meshes.splice(meshes.indexOf(mesh), 1);

			if (meshes.length === 0) {
				this.annotatedArcMeshes.delete(bushEntry as ABushData);
			}
		} else {
			this.annotatedFlagMeshes.delete(bushEntry as FBushData);
		}

		if (!doNotNotify) {
			// Notify server that an annotation has been removed
			axios.delete<RawAnnotation[]>(`${BACKEND_URL}/annotations`, { data: { id: this.modelId, name: mesh.name } });
		}
	}

	/**
	 * Gets detailed information about the epigenetic feature represented by the given mesh
	 * @param mesh The mesh to get the epigenetic feature information for
	 */
	public getInfo(mesh: AbstractMesh): EpiDataFeature {
		const isArc = mesh.name.startsWith('arc');
		const bushEntry = this.getBushEntry(mesh);

		return {
			type: isArc ? 'arc' : 'flag',
			data: bushEntry.raw,
			track: bushEntry.raw.id,
			mesh
		} as EpiDataFeature;
	}

	/** Clears the arcs */
	public clearArcs(): void {
		this.logger.log('Clearing Arcs');
		for (const i in this.arcMeshes) {
			this.arcMeshes[i].forEach((renderedArc) => {
				renderedArc.lines.dispose();
				renderedArc.cubes.forEach((cube) => cube.dispose());
				renderedArc.tris.forEach((tri) => tri.dispose());
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
