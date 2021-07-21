// import pkg from 'babylonjs';
import { Color3, MeshBuilder, StandardMaterial, Vector3 } from 'babylonjs';
import type EpiDataModule from './epiData';
import type GameLite from './game';
import type StructureModule from './structure';
import { distance, Logger } from './utils/utils';
// const { Color3, MeshBuilder, StandardMaterial, Vector3 } = pkg;

/**
 * Class to handle all operations regarding the radius selector
 */
export default class RadiusSelectorModule {
	/** Logger module */
	private logger: Logger;

	/** Guidance mesh (sphere) that tells the user where the selection is occuring (null if not placing) */
	private guideMesh: Mesh | null;

	/** If the sort is canceled while placing the selector, will be called to let component know */
	private rejectStart: (() => void) | null;

	/** Caches of results, for faster recollection */
	private structCache: Record<string, RawStructureCoord[]>;
	private epiDataCache: Record<string, RawEpiData>;

	/** The radius to select on */
	public radius: number;

	/** Whether the user is placing the selection mesh */
	public initPos: boolean;

	/** If the user has placed the selection mesh, but has not locked in the search parameters */
	public settingParams: boolean;

	/** If the user has placed the selection mesh, and has locked in the parameters */
	public locked: boolean;

	/** If the sort is currently being executed */
	public active: boolean;

	/** The position the sort is taking as its center */
	public position: Vector3 | null;

	/** Function called when the sort is reset (used by RadiusSelectMenu component to reset ui element values) */
	public onReset?: () => void;

	/**
	 * Creates a new radius selector module
	 * @param canvas the canvas to attach the listener to
	 * @param scene the scene to render in
	 * @param structure the structure module to be used
	 * @param epiData the epiData module to be used
	 * @param viewRegion the view region being rendered in
	 */
	constructor(
		private canvas: HTMLCanvasElement,
		private scene: Scene,
		private structure: StructureModule,
		private epiData: EpiDataModule,
		private viewRegion: ViewRegion,
		private game: GameLite
	) {
		this.logger = new Logger('Radius Selector');
		this.rejectStart = null;
		this.initPos = false;
		this.settingParams = false;
		this.locked = false;
		this.active = false;
		this.radius = 300;
		this.position = null;
		this.guideMesh = null;
		this.structCache = {};
		this.epiDataCache = {};
		this.logger.log('Initialized');
	}

	/**
	 * Start the sort (ie. start placing the selector mesh)
	 * @returns a promise that will resolve when the selector mesh is placed (or reject if canceled)
	 */
	public async start(): Promise<void> {
		return new Promise((resolve, reject) => {
			// Create guidance mesh
			const guideMesh = MeshBuilder.CreateSphere('sphericalbound', { segments: 8, diameter: 2, updatable: true }, this.scene);
			guideMesh.material = new StandardMaterial('guideballmaterial', this.scene);
			guideMesh.material.wireframe = true;
			guideMesh.scaling = new Vector3(300, 300, 300);
			guideMesh.isPickable = false;
			this.guideMesh = guideMesh;

			this.initPos = true;

			this.rejectStart = reject;

			// Listen for double click, to finalize position of sort
			this.canvas.addEventListener(
				'dblclick',
				() => {
					this.initPos = false;
					this.settingParams = true;
					this.position = guideMesh.position.clone();
					this.rejectStart = null;

					// Tell component that sort is done placing
					resolve();
				},
				{ once: true }
			);
		});
	}

	/**
	 * Selects from the structure
	 * @param params different parameters to use, used for complex sorts (ie. bpsSelector)
	 * @returns the structure coordinates found by the selector
	 */
	public selectStructure(params?: RadSelectParams): RawStructureCoord[] {
		// Grab sort parameters, taking params object as priority, but defaulting to use the selector module's parameters
		const { position, radius } = params || this;

		const keyStr = `${position.x},${position.y},${position.z},${radius}`;

		if (keyStr in this.structCache) {
			return this.structCache[keyStr];
		}

		// Search structure bush for rough estimate of selected points
		const dataArray = this.structure.structureBush.search({
			minX: position.x - radius,
			minY: position.y - radius,
			minZ: position.z - radius,
			maxX: position.x + radius,
			maxY: position.y + radius,
			maxZ: position.z + radius
		});

		// const denoodled = denoodle(dataArray);
		// const structure = denoodled.map((coords) => {
		// 	const viewRatio = this.viewRegion.length / this.structure.data.length;
		// 	const startTag = coords[0].tag,
		// 		stopTag = coords[coords.length - 1].tag,
		// 		lowerBP = Math.round((startTag / this.structure.data.length) * this.viewRegion.length) + this.viewRegion.start - Math.round(viewRatio / 2),
		// 		upperBP = Math.round((stopTag / this.structure.data.length) * this.viewRegion.length) + this.viewRegion.start + Math.round(viewRatio / 2),
		// 		BP: number[] = [],
		// 		chrNumber = this.viewRegion.chr;

		// 	for (let i = lowerBP; i <= upperBP; i++) {
		// 		BP.push(i);
		// 	}

		// 	return { coords, lowerCoord: coords[0], upperCoord: coords[coords.length - 1], BP, lowerBP, upperBP, chrNumber };
		// });

		// Refine rough selection of points by verifying
		const results = dataArray
			.filter((pt) => distance({ x: pt.minX, y: pt.minY, z: pt.minZ }, position) < radius)
			.map<RawStructureCoord>((point) => point.raw);

		this.structCache[keyStr] = results;

		return results;
	}

	/**
	 * Selects from the epiData
	 * @param params different parameters to use, used for complex sorts (ie. bpsSelector)
	 * @returns the epiData features found by the selector
	 */
	public selectEpiData(params?: RadSelectParams): RawEpiData {
		// Grab sort parameters, taking params object as priority, but defaulting to use the selector module's parameters
		const { position, radius } = params || this;

		const keyStr = `${position.x},${position.y},${position.z},${radius}`;

		if (keyStr in this.epiDataCache) {
			return this.epiDataCache[keyStr];
		}

		// Search flag/arc bush for rough estimate of selected epiData features
		const flagDataArray = this.epiData.flagBush.search({
			minX: position.x - radius,
			minY: position.y - radius,
			minZ: position.z - radius,
			maxX: position.x + radius,
			maxY: position.y + radius,
			maxZ: position.z + radius
		});
		const arcDataArray = this.epiData.arcBush.search({
			minX: position.x - radius,
			minY: position.y - radius,
			minZ: position.z - radius,
			maxX: position.x + radius,
			maxY: position.y + radius,
			maxZ: position.z + radius
		});

		// Refine rough selection of points by verifying
		const results = {
			arcs: arcDataArray
				.filter((arc) => {
					const { raw } = arc;

					return (
						// Include arc if just one if the endpoints is in selected region
						distance(raw.startPos1, position) < radius ||
						distance(raw.startPos2, position) < radius ||
						distance(raw.stopPos1, position) < radius ||
						distance(raw.stopPos2, position) < radius
					);
				})
				.map<RawArcTrackData>((arc) => arc.raw),
			flags: flagDataArray
				.filter((flag) => {
					const { raw } = flag;

					return distance(raw.startPos, position) < radius || distance(raw.stopPos, position) < radius;
				})
				.map<RawFlagTrackData>((flag) => flag.raw)
		};

		this.epiDataCache[keyStr] = results;

		return results;
	}

	/** Lock the parameters of the selector, in preparation for execution */
	public finalize(): void {
		if (this.settingParams) {
			this.locked = true;
			this.settingParams = false;
			this.position = this.guideMesh.position.clone();
			const newMat = new StandardMaterial('radfinalmat', this.scene);

			// Set the guide mesh's color to green to indicate to user sort is ready
			newMat.diffuseColor = new Color3(0, 1, 0);

			newMat.wireframe = true;
			this.guideMesh.material = newMat;
		}
	}

	/**
	 * Execute the selector with the data in the selector class WITHOUT regard for other
	 * sorts ``(SHOULD NOT BE USED UNLESS OTHER SORTS ARE GUARANTEED TO BE INACTIVE)``
	 */
	public execute(): void {
		if (this.locked) {
			const epiDataSelect = this.selectEpiData();
			this.structure.renderStruct(this.selectStructure());
			this.epiData.renderArcs(epiDataSelect.arcs);
			this.epiData.renderFlags(epiDataSelect.flags, 80);
			this.active = true;
		}
	}

	/**
	 * Updates the radius of the selector, and the mesh
	 * @param rad new radius
	 */
	public updateRadius(rad: number): void {
		if (this.settingParams) {
			this.guideMesh.scaling = new Vector3(rad, rad, rad);
			this.radius = rad;
		}
	}

	/**
	 * Update the position of the selector, and the mesh
	 * @param coord the coordinate to modify
	 * @param value the new value
	 */
	public updatePos(coord: 'x' | 'y' | 'z', value: number): void {
		if (this.settingParams) {
			this.guideMesh.position[coord] = value;
			this.position[coord] = value;
		}
	}

	/**
	 * Updates the position of the selector, and the mesh
	 * @param pos new position
	 */
	public updatePosition(pos: RawVector3): void {
		this.guideMesh.position.x = pos.x;
		this.guideMesh.position.y = pos.y;
		this.guideMesh.position.z = pos.z;
		this.position.x = pos.x;
		this.position.y = pos.y;
		this.position.z = pos.z;
	}

	/**
	 * Sets whether the guide meshe (the ball) is shown
	 * @param shown whether the guide mesh should be shown or not
	 */
	public setGuideShown(show: boolean): void {
		if (this.guideMesh && this.guideMesh.isVisible !== show) {
			this.guideMesh.isVisible = show;
		}
	}

	/** Cancel the placement of the sort */
	public cancel(): void {
		if (this.initPos) {
			this.initPos = false;
			this.guideMesh.dispose();
			this.guideMesh = null;
			this.rejectStart();
			this.rejectStart = null;
		} else if (this.settingParams) {
			this.settingParams = false;
			this.radius = 300;
			this.position = null;
			this.guideMesh.dispose();
			this.guideMesh = null;
		}
	}

	/**
	 * Resets the sort (WARNING: do not use ``override = true`` UNLESS you can guarantee that the appropriate resets will be made elsewhere in the model
	 * (struct, epiData, etc.))
	 * @param override whether to override the check of sort being active
	 */
	public reset(override?: boolean): void {
		if (this.locked && (!this.active || override)) {
			this.locked = false;
			this.initPos = false;
			this.settingParams = false;
			this.active = false;
			this.guideMesh.dispose();
			this.guideMesh = null;
			this.radius = 300;
			this.position = null;

			// Call reset function if necessary
			if (this.onReset) {
				this.onReset();
			}
		} else if (this.initPos || this.settingParams) {
			this.cancel();
		}
	}

	/** Update the position the guide mesh; called by the main game class */
	public updateGuide(): void {
		if (this.game.hoverMesh) {
			this.guideMesh.position = this.game.hoverMesh.getBoundingInfo().boundingSphere.center.clone();
			this.radius = this.game.hoverMesh.getBoundingInfo().boundingSphere.radius;
			this.guideMesh.scaling = new Vector3(this.radius, this.radius, this.radius);
		} else {
			const pickInfo = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
			this.guideMesh.position = this.scene.activeCamera.position.add(pickInfo.ray.direction.scale(2000));
			if (this.radius !== 300) {
				this.radius = 300;
				this.guideMesh.scaling = new Vector3(this.radius, this.radius, this.radius);
			}
		}
	}
}
