import {
	Color3,
	Color4,
	Engine,
	HemisphericLight,
	MeshBuilder,
	ParticlesOptimization,
	Scene,
	SceneOptimizer,
	SceneOptimizerOptions,
	ShadowsOptimization,
	UniversalCamera,
	Vector3
} from '$lib/utils/babylon';
import { v4 as uuid } from 'uuid';
import BasePairSelectorModule from './bps';
import EpiDataModule from './epiData';
import RadiusSelectorModule from './radiusSelector';
import StructureModule from './structure';
import { compareVectors, EventSrc, findShortest, Logger, modColor, serializeParams2, serializeParams3, strictCompareVectors } from './utils/utils';
import VolumeSelectorModule from './volumeSelector';

interface GameLiteEvents {
	RESET: Sort;
	ACTIVE: undefined;
	START_SET_ANN_NAME: string;
	CANCEL_SET_ANN_NAME: undefined;
	SET_ANN_NAME: string;
	SELECT_FEATURE: EpiDataFeature;
	DESELECT_FEATURE: undefined;
	RECALL_SORT: Sort;
	CAM_CHANGE: undefined;
}

const optimizerOptions = new SceneOptimizerOptions();
optimizerOptions.addOptimization(new ParticlesOptimization());
optimizerOptions.addOptimization(new ShadowsOptimization());

/** Main class for the "Lite" version of GEMINI (loading from saved data) */
export default class GameLite {
	private logger: Logger;

	private engine: Engine;
	private xAxis: LinesMesh;
	private yAxis: LinesMesh;
	private zAxis: LinesMesh;
	private optimizer: SceneOptimizer;

	// Caches
	private structCache: Record<string, RawStructureCoord[]>;
	private epiDataCache: Record<string, RawEpiData>;

	// To track camera movement
	private prevCamPos: Vector3;
	private prevCamRot: Vector3;

	public scene: Scene;
	public camera: UniversalCamera;
	public light: HemisphericLight;
	public running: boolean;
	public sortsActive: boolean;

	// Modules
	public structure: StructureModule;
	public epiData: EpiDataModule;
	public radSelect: RadiusSelectorModule;
	public volSelect: VolumeSelectorModule;
	public bpsSelect: BasePairSelectorModule;

	// Utilities
	private renderStructure: Promise<void> | null;
	public events: EventSrc<GameLiteEvents>;
	public sortsDone: number;

	// Raycasting stuff
	public hoverMesh: AbstractMesh | null;
	public originalColor: Color3 | null;

	// Selected mesh
	public selectedMesh: AbstractMesh | null;
	public selectedOriginalColor: Color3 | null;

	/**
	 * Makes a new instance of the game
	 * @param canvas the canvas to render on
	 * @param rawData raw data for loading saved model
	 */
	constructor(public canvas: HTMLCanvasElement, public rawData: RawGameMetadata, initSortId: number, annotations: RawAnnotation[]) {
		// Initialize utility stuff
		this.logger = new Logger('Main');
		this.engine = new Engine(canvas.getContext('webgl'));
		this.scene = new Scene(this.engine);
		this.running = false;
		this.sortsActive = false;
		this.sortsDone = initSortId;

		// Initialize caches
		this.structCache = {};
		this.epiDataCache = {};

		// Initialize events
		this.events = new EventSrc([
			'RESET',
			'ACTIVE',
			'START_SET_ANN_NAME',
			'CANCEL_SET_ANN_NAME',
			'SET_ANN_NAME',
			'SELECT_FEATURE',
			'DESELECT_FEATURE',
			'RECALL_SORT',
			'CAM_CHANGE'
		]);

		// Set up scene optimizers
		this.optimizer = new SceneOptimizer(this.scene, optimizerOptions);
		this.optimizer.start();

		// Set up camera + light
		this.light = new HemisphericLight('light', new Vector3(0, 1, 0), this.scene);
		this.light.specular = Color3.White();
		this.camera = new UniversalCamera('unicam', new Vector3(0, 0, 10000), this.scene);
		this.camera.setTarget(new Vector3(0, 0, 0));
		this.camera.maxZ = 20000;
		this.camera.keysUp[0] = 87;
		this.camera.keysDown[0] = 83;
		this.camera.keysLeft[0] = 65;
		this.camera.keysRight[0] = 68;
		this.camera.keysUpward[0] = 32;
		this.camera.keysDownward[0] = 16;
		this.camera.speed = 500;
		this.camera.angularSensibility = 200;
		this.camera.attachControl(false);
		this.camera.inertia = 0.75;
		this.hoverMesh = null;
		this.originalColor = null;

		// Alert babylon upon resizing of canvas
		window.addEventListener('resize', () => {
			this.logger.log('Resizing');
			this.engine.resize();
		});

		// Adding coordinate axes
		this.xAxis = MeshBuilder.CreateLines(
			'x axis',
			{
				points: [new Vector3(-10000, 0, 0), new Vector3(10000, 0, 0)],
				colors: [new Color4(1, 1, 1, 1), new Color4(1, 1, 1, 1)],
				useVertexAlpha: false
			},
			this.scene
		);
		this.xAxis.isPickable = false;
		this.yAxis = MeshBuilder.CreateLines(
			'y axis',
			{
				points: [new Vector3(0, -10000, 0), new Vector3(0, 10000, 0)],
				colors: [new Color4(1, 1, 1, 1), new Color4(1, 1, 1, 1)],
				useVertexAlpha: false
			},
			this.scene
		);
		this.yAxis.isPickable = false;
		this.zAxis = MeshBuilder.CreateLines(
			'z axis',
			{
				points: [new Vector3(0, 0, -10000), new Vector3(0, 0, 10000)],
				colors: [new Color4(1, 1, 1, 1), new Color4(1, 1, 1, 1)],
				useVertexAlpha: false
			},
			this.scene
		);
		this.zAxis.isPickable = false;

		// Initializing modules & generating data
		this.structure = new StructureModule(rawData.structure, this.scene);
		this.structure.generateStructData();
		this.renderStructure = this.structure.renderStruct(this.structure.defaultStructureData);
		this.epiData = new EpiDataModule(rawData.epiData, this.structure, this.scene, rawData.id);
		this.epiData.generateEpiData();
		this.epiData.renderFlags(
			Object.values(this.epiData.flagTracks).reduce((arr, track) => [...arr, ...track.data], []),
			80
		);
		// this.epiData.renderArcs(Object.values(this.epiData.arcTracks).reduce((arr, track) => [...arr, ...track.data], []));
		this.epiData.renderArcs(this.epiData.defaultArcData);

		// Loading in existing annotations, but only after things are rendered for the first time
		setTimeout(() => {
			this.epiData.loadAnnotations(annotations);
		}, 0);

		// Initializing sort modules
		this.radSelect = new RadiusSelectorModule(canvas, this.scene, this.structure, this.epiData, rawData.viewRegion, this);
		this.volSelect = new VolumeSelectorModule(this.scene, this.structure, this.epiData);
		this.bpsSelect = new BasePairSelectorModule(this.scene, this.structure, this.epiData, this.radSelect, rawData.viewRegion);

		// Add listeners for click detection
		this.scene.onPointerDown = (evt) => {
			if (!this.radSelect.initPos && (evt.button === 0 || evt.button === 2)) {
				if (this.hoverMesh) {
					// Keep track of the mesh the mouse was over when mousing down
					const downMesh = this.hoverMesh;

					this.scene.onPointerMove = () => {
						if (!this.hoverMesh) {
							// If the cursor ever leaves the mesh that was moused down on, we can ignore the sequence, as it should not select a mesh
							this.scene.onPointerUp = undefined;
							this.scene.onPointerMove = undefined;
						}
					};
					this.scene.onPointerUp = (evt) => {
						// if left button click and the mouse is still over the same mesh, AND the mesh is not already selected
						if (evt.button === 0 && this.hoverMesh && this.hoverMesh === downMesh && this.selectedMesh !== downMesh) {
							if (this.selectedMesh) {
								// if a mesh is already selected, fix the color
								(this.selectedMesh.material as StandardMaterial).diffuseColor = this.selectedOriginalColor;
							}
							this.selectedMesh = downMesh;
							this.selectedOriginalColor = this.originalColor;

							// tell the console that the user clicked on a mesh
							// @ts-ignore no clue why ts fucks up here, but it should work nonetheless
							this.events.dispatch('SELECT_FEATURE', this.epiData.getInfo(this.selectedMesh));
						}
						// if right button click and the mouse is still over the same mesh
						if (evt.button === 2 && this.hoverMesh === downMesh && this.selectedMesh) {
							(this.selectedMesh.material as StandardMaterial).diffuseColor = this.selectedOriginalColor;
							this.selectedMesh = null;
							this.selectedOriginalColor = null;

							// tell the console that the user deselected the mesh
							this.events.dispatch('DESELECT_FEATURE');
						}
						this.scene.onPointerUp = undefined;
						this.scene.onPointerMove = undefined;
					};
					// if the mouse is not over a mesh, and the user is right clicking
				} else if (evt.button === 2) {
					this.scene.onPointerMove = () => {
						if (this.hoverMesh) {
							// if the user ever goes over a mesh, we should not deselect the current selected mesh
							this.scene.onPointerUp = undefined;
							this.scene.onPointerMove = undefined;
						}
					};
					this.scene.onPointerUp = (evt) => {
						// if the user has right clicked on empty space
						if (evt.button === 2 && !this.hoverMesh) {
							(this.selectedMesh.material as StandardMaterial).diffuseColor = this.selectedOriginalColor;
							this.selectedMesh = null;
							this.selectedOriginalColor = null;

							// tell the console that the user deselected the mesh
							this.events.dispatch('DESELECT_FEATURE');
						}
						this.scene.onPointerUp = undefined;
						this.scene.onPointerMove = undefined;
					};
				}
			}
		};

		// Listen for when the user wants to recall a sort (also hijacked for sort sync feature)
		this.events.on('RECALL_SORT', (sort: Sort) => {
			if (sort.radSelect) {
				this.radSelect.setParams(sort.radSelect);
			}
			if (sort.volSelect) {
				this.volSelect.setParams(sort.volSelect);
			}
			if (sort.bpsSelect) {
				this.bpsSelect.recallSort(sort.bpsSelect);
			}
		});

		// For debugging purposes (probably should be commented for production)
		(window as any).game = this;

		this.logger.log('Initialized');
	}

	/** Handles multiple sorts at once; should usually be called instead of .execute on actual modules */
	public executeSearches(): void {
		// Finding all sorts that are ready to go
		const prepSorts = [this.radSelect, this.volSelect, this.bpsSelect].filter((sel) => sel.locked);

		// Handle cases where only 1 sort is ready
		if (this.radSelect.locked && !this.volSelect.locked && !this.bpsSelect.locked) {
			this.radSelect.execute();
			this.sortsActive = true;

			this.volSelect.reset();
			this.bpsSelect.reset();

			this.events.dispatch('ACTIVE');
		} else if (!this.radSelect.locked && this.volSelect.locked && !this.bpsSelect.locked) {
			this.logger.time('VolSelect');
			this.volSelect.execute();
			this.logger.timeEnd('VolSelect');
			this.sortsActive = true;

			this.radSelect.reset();
			this.bpsSelect.reset();

			this.events.dispatch('ACTIVE');
		} else if (!this.radSelect.locked && !this.volSelect.locked && this.bpsSelect.locked) {
			this.logger.time('BPSSelect');
			this.bpsSelect.execute();
			this.logger.timeEnd('BPSSelect');
			this.sortsActive = true;

			this.radSelect.reset();
			this.volSelect.reset();

			this.events.dispatch('ACTIVE');
			// Handle cases where exactly 2 sorts are ready
		} else if (prepSorts.length === 2) {
			this.logger.log('2 sorts ready', prepSorts);
			this.logger.time('Sorting');
			const coords1 = prepSorts[0].selectStructure();
			const epiData1 = prepSorts[0].selectEpiData();
			prepSorts[0].active = true;

			const coords2 = prepSorts[1].selectStructure();
			const epiData2 = prepSorts[1].selectEpiData();
			prepSorts[1].active = true;
			this.logger.timeEnd('Sorting');

			// Reset the not-ready sort
			[this.radSelect, this.volSelect, this.bpsSelect].find((sort) => !prepSorts.includes(sort)).reset();

			this.logger.time('Filtering');

			const serializedParams = serializeParams2(prepSorts[0], prepSorts[1]);

			const finalCoords =
				serializedParams in this.structCache
					? this.structCache[serializedParams]
					: coords1.length < coords2.length
					? coords1.filter((coord) => coords2.includes(coord))
					: coords2.filter((coord) => coords1.includes(coord));

			const finalArcs =
				serializedParams in this.epiDataCache
					? this.epiDataCache[serializedParams].arcs
					: epiData1.arcs.length > epiData2.arcs.length
					? epiData1.arcs.filter((arc) => epiData2.arcs.includes(arc))
					: epiData2.arcs.filter((arc) => epiData1.arcs.includes(arc));
			const finalFlags =
				serializedParams in this.epiDataCache
					? this.epiDataCache[serializedParams].flags
					: epiData1.flags.length > epiData2.flags.length
					? epiData1.flags.filter((flag) => epiData2.flags.includes(flag))
					: epiData2.flags.filter((flag) => epiData1.flags.includes(flag));
			const finalEpi: RawEpiData = {
				arcs: finalArcs,
				flags: finalFlags
			};

			if (!(serializedParams in this.structCache)) {
				this.structCache[serializedParams] = finalCoords;
			}
			if (!(serializedParams in this.epiDataCache)) {
				this.epiDataCache[serializedParams] = finalEpi;
			}
			this.logger.timeEnd('Filtering');

			this.logger.time('Rendering');
			this.structure.renderStruct(finalCoords);
			this.epiData.renderArcs(finalEpi.arcs);
			this.epiData.renderFlags(finalEpi.flags, 80);
			this.logger.timeEnd('Rendering');

			this.sortsActive = true;
			this.events.dispatch('ACTIVE');
			// Handle case where all 3 sorts are ready
		} else if (prepSorts.length === 3) {
			this.logger.log('3 sorts ready');
			const radCoords = this.radSelect.selectStructure();
			const radEpiResults = this.radSelect.selectEpiData();
			this.radSelect.active = true;
			const volCoords = this.volSelect.selectStructure();
			const volEpiResults = this.volSelect.selectEpiData();
			this.volSelect.active = true;
			const bpsCoords = this.bpsSelect.selectStructure();
			const bpsEpiResults = this.bpsSelect.selectEpiData();
			this.bpsSelect.active = true;

			const serializedParams = serializeParams3(this.volSelect, this.radSelect, this.bpsSelect);

			const [shortCoords, otherCoords] = findShortest(radCoords, volCoords, bpsCoords);
			const finalCoords =
				serializedParams in this.structCache
					? this.structCache[serializedParams]
					: shortCoords.filter((coord) => otherCoords.every((arr) => arr.includes(coord)));
			this.structure.renderStruct(finalCoords);

			const [shortArcs, otherArcs] = findShortest(radEpiResults.arcs, volEpiResults.arcs, bpsEpiResults.arcs);
			const finalArcs =
				serializedParams in this.epiDataCache
					? this.epiDataCache[serializedParams].arcs
					: shortArcs.filter((arc) => otherArcs.every((arr) => arr.includes(arc)));

			const [shortFlags, otherFlags] = findShortest(radEpiResults.flags, volEpiResults.flags, bpsEpiResults.flags);
			const finalFlags =
				serializedParams in this.epiDataCache
					? this.epiDataCache[serializedParams].flags
					: shortFlags.filter((flag) => otherFlags.every((arr) => arr.includes(flag)));

			const finalEpi: RawEpiData = {
				arcs: finalArcs,
				flags: finalFlags
			};

			if (!(serializedParams in this.structCache)) {
				this.structCache[serializedParams] = finalCoords;
			}
			if (!(serializedParams in this.epiDataCache)) {
				this.epiDataCache[serializedParams] = finalEpi;
			}

			this.epiData.renderArcs(finalEpi.arcs);
			this.epiData.renderFlags(finalEpi.flags, 80);

			this.sortsActive = true;
			this.events.dispatch('ACTIVE');
		}
	}

	/** Resets the active sorts; should be the ONLY time that .reset is called on the sorts with the override true */
	public reset(): void {
		if (this.sortsActive) {
			// Save the data of the sorts that were just cleared
			const sort: Sort = {
				_id: uuid(),
				name: `Sort ${this.sortsDone}`,
				radSelect: this.radSelect.active
					? {
							position: {
								x: this.radSelect.position.x,
								y: this.radSelect.position.y,
								z: this.radSelect.position.z
							},
							radius: this.radSelect.radius
					  }
					: null,
				volSelect: this.volSelect.active
					? {
							minX: this.volSelect.minX,
							maxX: this.volSelect.maxX,
							minY: this.volSelect.minY,
							maxY: this.volSelect.maxY,
							minZ: this.volSelect.minZ,
							maxZ: this.volSelect.maxZ
					  }
					: null,
				bpsSelect: this.bpsSelect.active
					? {
							radius: this.bpsSelect.radius,
							regions: this.bpsSelect.regions
					  }
					: null
			};

			// Force reset the sorts that were active
			if (this.radSelect.active) {
				this.radSelect.reset(true);
			}
			if (this.volSelect.active) {
				this.volSelect.reset(true);
			}
			if (this.bpsSelect.active) {
				this.bpsSelect.reset(true);
			}
			// Reset any of the sorts that were not
			this.radSelect.reset();
			this.volSelect.reset();
			this.bpsSelect.reset();

			// Reset the structure & epi data
			this.structure.renderStruct(this.structure.defaultStructureData);
			this.epiData.renderArcs(this.epiData.defaultArcData);
			this.epiData.renderFlags(this.epiData.defaultFlagData, 80);
			this.sortsActive = false;

			// Notify console that sorts were reset
			this.events.dispatch('RESET', sort);
		}
	}

	/** Start the model, and run render loop */
	public start(): void {
		if (!this.running) {
			this.logger.log('Starting');
			this.engine.runRenderLoop(() => {
				this.scene.render();

				if (this.radSelect.initPos) {
					this.radSelect.updateGuide();
				}

				// If the camera changed a significant amount, tell the console that (used for live session camera syncing)
				if (!compareVectors(this.camera.position, this.prevCamPos) || !strictCompareVectors(this.camera.rotation, this.prevCamRot)) {
					this.events.dispatch('CAM_CHANGE');
					this.prevCamPos = this.camera.position.clone();
					this.prevCamRot = this.camera.rotation.clone();
				}

				// Raycasting for mesh selection & hover lighting effects
				const hit = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
				if (hit.hit) {
					if (this.hoverMesh && this.hoverMesh !== hit.pickedMesh) {
						// If the cursor was already hovering on a mesh that isn't the currently hovered mesh, "dehover" it first
						if (this.hoverMesh !== this.selectedMesh) {
							// If the previously hovered mesh is NOT the selected mesh, revert the color
							(this.hoverMesh.material as StandardMaterial).diffuseColor = this.originalColor;
							this.originalColor = null;
						}
						this.hoverMesh = null;
					}

					if (!this.hoverMesh) {
						// If the cursor is not currently hovering on a mesh, keep track of it
						if (hit.pickedMesh !== this.selectedMesh) {
							// if the currently hovered mesh is NOT already selected, modify its color to indicate that it is being hovered on
							this.originalColor = (hit.pickedMesh.material as StandardMaterial).diffuseColor;
							(hit.pickedMesh.material as StandardMaterial).diffuseColor = modColor(this.originalColor);
						}
						this.hoverMesh = hit.pickedMesh;
						this.canvas.classList.add('cp');
					}
				} else if (this.hoverMesh) {
					// If the cursor is NOT hovering on a mesh, but previously was, dehover it
					if (this.selectedMesh !== this.hoverMesh) {
						// If the previously hovered mesh is NOT the selected mesh, revert the color
						(this.hoverMesh.material as StandardMaterial).diffuseColor = this.originalColor;
						this.originalColor = null;
					}
					this.hoverMesh = null;
					this.canvas.classList.remove('cp');
				}
			});
			this.running = true;
		}
	}

	/**
	 * Programmatically selects a mesh by name, used by selection sync feature
	 * @param name the name of the mesh
	 */
	public selectMesh(name: string): void {
		const mesh = this.scene.getMeshByName(name);

		if (this.selectedMesh === mesh) {
			// no need to change anything
			return;
		}

		if (this.selectedMesh) {
			// if the currently selected mesh is not the same as the mesh we want to select, revert the color
			this.hoverMesh = this.selectedMesh;
			this.originalColor = this.selectedOriginalColor;
		}

		// select the mesh (same as above)
		if (this.hoverMesh && this.hoverMesh === mesh) {
			this.selectedMesh = mesh;
			this.selectedOriginalColor = this.originalColor;

			// @ts-ignore no clue why ts fucks up here, but it should work nonetheless
			this.events.dispatch('SELECT_FEATURE', this.epiData.getInfo(this.selectedMesh));
		} else {
			this.selectedMesh = mesh;
			this.selectedOriginalColor = (mesh.material as StandardMaterial).diffuseColor;
			(mesh.material as StandardMaterial).diffuseColor = modColor(this.selectedOriginalColor);

			// @ts-ignore no clue why ts fucks up here, but it should work nonetheless
			this.events.dispatch('SELECT_FEATURE', this.epiData.getInfo(this.selectedMesh));
		}
	}

	/** Sets whether the coordinate axes are shown */
	public setAxesShown(shown: boolean): void {
		if (this.xAxis.isEnabled() !== shown) {
			this.xAxis.setEnabled(shown);
			this.yAxis.setEnabled(shown);
			this.zAxis.setEnabled(shown);
		}
	}

	/** Stop rendering of the model (for performance) */
	public stop(): void {
		if (this.running) {
			this.engine.stopRenderLoop();
			this.running = false;
		}
	}

	/** Stops the game and releases all resources */
	public destroy(): void {
		if (this.running) {
			this.stop();
		}
		this.engine.dispose();
		this.scene.dispose();
	}

	/** Renders 1 frame of the game, to generate an image for the previews in the gallery */
	public async preview(): Promise<void> {
		// wait for the structure to finish rendering (async because points cloud system)
		await this.renderStructure;

		// wait 1 frame for stuff to render, to allow annotations to render
		setTimeout(() => {
			this.scene.render();
		}, 0);
	}

	/**
	 * Prompts the user for a name for the new annotation
	 * @param defName the default name of the annotation
	 * @return a promise that resolves to the name of new annotation
	 */
	public async getAnnotationName(defName: string): Promise<string> {
		this.events.dispatch('START_SET_ANN_NAME', defName);

		return new Promise((resolve, reject) => {
			const unsub = this.events.on('SET_ANN_NAME', resolve);
			this.events.on('CANCEL_SET_ANN_NAME', () => {
				unsub();
				reject();
			});
		});
	}
}
