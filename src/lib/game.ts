import {
	AbstractMesh,
	Color3,
	Color4,
	Engine,
	HemisphericLight,
	LinesMesh,
	MeshBuilder,
	ParticlesOptimization,
	Scene,
	SceneOptimizer,
	SceneOptimizerOptions,
	ShadowsOptimization,
	StandardMaterial,
	UniversalCamera,
	Vector3
} from 'babylonjs';
import BasePairSelectorModule from './bps';
import EpiDataModule from './epiData';
import RadiusSelectorModule from './radiusSelector';
import StructureModule from './structure';
import { EventSrc, findShortest, Logger, serializeParams2, serializeParams3 } from './utils/utils';
import VolumeSelectorModule from './volumeSelector';

interface GameLiteEvents {
	RESET: Sort;
	ACTIVE: undefined;
	INC_SORT: undefined;
	START_SET_ANN_NAME: string;
	CANCEL_SET_ANN_NAME: undefined;
	SET_ANN_NAME: string;
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
	public events: EventSrc<GameLiteEvents>;
	public sortsDone: number;

	// Raycasting stuff
	public hoverMesh: AbstractMesh | null;
	public originalColor: Color3 | null;

	/**
	 * Makes a new instance of the game
	 * @param canvas the canvas to render on
	 * @param rawData raw data for loading saved model
	 */
	constructor(private canvas: HTMLCanvasElement, private rawData: RawGameMetadata) {
		// Initialize utility stuff
		this.logger = new Logger('Main');
		this.engine = new Engine(canvas.getContext('webgl'));
		this.scene = new Scene(this.engine);
		this.running = false;
		this.sortsActive = false;
		this.sortsDone = 1;

		// Initialize caches
		this.structCache = {};
		this.epiDataCache = {};

		// Initialize events
		this.events = new EventSrc(['RESET', 'ACTIVE', 'INC_SORT', 'START_SET_ANN_NAME', 'CANCEL_SET_ANN_NAME', 'SET_ANN_NAME']);

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
		this.structure.renderStruct(this.structure.defaultStructureData);
		this.epiData = new EpiDataModule(rawData.epiData, this.structure, this.scene);
		this.epiData.generateEpiData();
		this.epiData.renderFlags(
			Object.values(this.epiData.flagTracks).reduce((arr, track) => [...arr, ...track.data], []),
			99
		);
		this.epiData.renderArcs(Object.values(this.epiData.arcTracks).reduce((arr, track) => [...arr, ...track.data], []));

		// Initializing sort modules
		this.radSelect = new RadiusSelectorModule(canvas, this.scene, this.structure, this.epiData, rawData.viewRegion, this);
		this.volSelect = new VolumeSelectorModule(this.scene, this.structure, this.epiData);
		this.bpsSelect = new BasePairSelectorModule(this.scene, this.structure, this.epiData, this.radSelect, rawData.viewRegion);

		// Make frontend responsible for incrementing sort count
		this.events.on('INC_SORT', () => {
			this.sortsDone++;
		});

		// Add listeners for click detection
		this.scene.onPointerDown = (evt) => {
			if (this.hoverMesh && !this.radSelect.initPos && (evt.button === 0 || evt.button === 2)) {
				const downMesh = this.hoverMesh;

				this.scene.onPointerMove = () => {
					if (!this.hoverMesh) {
						this.scene.onPointerUp = undefined;
						this.scene.onPointerMove = undefined;
					}
				};
				this.scene.onPointerUp = (evt) => {
					if (evt.button === 0 && this.hoverMesh && this.hoverMesh === downMesh && !this.epiData.hasAnnotation(downMesh)) {
						this.getAnnotationName(downMesh.name)
							.then((annotation) => {
								this.epiData.addAnnotation(downMesh, annotation);
							})
							.catch(() => {});
					}
					if (evt.button === 2 && this.hoverMesh && this.hoverMesh === downMesh && this.epiData.hasAnnotation(downMesh)) {
						this.epiData.removeAnnotation(this.hoverMesh);
					}
					this.scene.onPointerUp = undefined;
					this.scene.onPointerMove = undefined;
				};
			}
		};

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
			this.epiData.renderFlags(finalEpi.flags, 99);
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
			this.epiData.renderFlags(finalEpi.flags, 99);

			this.sortsActive = true;
			this.events.dispatch('ACTIVE');
		}
	}

	/** Resets the active sorts; should be the ONLY time that .reset is called on the sorts with the override true */
	public reset(): void {
		if (this.sortsActive) {
			const sort: Sort = {
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

			if (this.radSelect.active) {
				this.radSelect.reset(true);
			}
			if (this.volSelect.active) {
				this.volSelect.reset(true);
			}
			if (this.bpsSelect.active) {
				this.bpsSelect.reset(true);
			}
			this.radSelect.reset();
			this.volSelect.reset();
			this.bpsSelect.reset();
			this.structure.renderStruct(this.structure.defaultStructureData);
			this.epiData.renderArcs(this.epiData.defaultArcData);
			this.epiData.renderFlags(this.epiData.defaultFlagData, 99);
			this.sortsActive = false;

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

				const hit = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
				if (hit.hit) {
					if (this.hoverMesh && this.hoverMesh !== hit.pickedMesh) {
						(this.hoverMesh.material as StandardMaterial).diffuseColor = this.originalColor;
						this.hoverMesh = null;
						this.originalColor = null;
					}

					if (!this.hoverMesh) {
						this.originalColor = (hit.pickedMesh.material as StandardMaterial).diffuseColor;
						const { r, g, b } = this.originalColor;
						const rgbTotal = r * 0.75 + g * 2 + b * 0.75;
						(hit.pickedMesh.material as StandardMaterial).diffuseColor = new Color3(
							rgbTotal < 1.75 ? r * 2 : r / 2,
							rgbTotal < 1.75 ? g * 2 : g / 2,
							rgbTotal < 1.75 ? b * 2 : b / 2
						);
						this.hoverMesh = hit.pickedMesh;
						this.canvas.classList.add('cp');
					}
				} else if (this.hoverMesh) {
					(this.hoverMesh.material as StandardMaterial).diffuseColor = this.originalColor.clone();
					this.hoverMesh = null;
					this.originalColor = null;
					this.canvas.classList.remove('cp');
				}
			});
			this.running = true;
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

	private getAnnotationName(defName: string): Promise<string> {
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
