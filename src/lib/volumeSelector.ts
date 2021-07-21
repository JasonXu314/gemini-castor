// import pkg from 'babylonjs';
import { Color3, MeshBuilder, StandardMaterial, Vector3 } from 'babylonjs';
import type EpiDataModule from './epiData';
import type StructureModule from './structure';
import { Logger } from './utils/utils';
// const { Color3, MeshBuilder, StandardMaterial, Vector3 } = pkg;

/** Helper type to define what inputs you can pass to updateBound */
type Bound = 'minX' | 'maxX' | 'minY' | 'maxY' | 'minZ' | 'maxZ';

/** Class to handle all operations regarding the volume selector */
export default class VolumeSelectorModule {
	/** Logger module */
	private logger: Logger;

	/** Whether the user is currently adjusting the selector params */
	public placingSelector: boolean;

	/**
	 * Whether the sort is ready to be acted upon (ie. the user has
	 * locked in the parameters to be selected upon)
	 */
	public locked: boolean;

	/** Whether the sort is currently being executed or not */
	public active: boolean;

	/** Caches of results, for faster recollection */
	private structCache: Record<string, RawStructureCoord[]>;
	private epiDataCache: Record<string, RawEpiData>;

	// the boundaries for the sort
	public minX: number;
	public maxX: number;
	public minY: number;
	public maxY: number;
	public minZ: number;
	public maxZ: number;

	/** Function called when the sort is reset (used by VolumeSelectMenu component to reset ui element values) */
	public onReset?: () => void;

	// Guide Meshes
	private floor: Mesh | null;
	private ceiling: Mesh | null;
	private wallN: Mesh | null;
	private wallS: Mesh | null;
	private wallW: Mesh | null;
	private wallE: Mesh | null;
	private wallMat: StandardMaterial | null;

	/**
	 * Creates a new volume selector module
	 * @param scene the scene to render in
	 * @param structure the structure module to be used
	 * @param epiData the epiData module to be used
	 */
	constructor(private scene: Scene, private structure: StructureModule, private epiData: EpiDataModule) {
		this.logger = new Logger('Volume Selector');
		this.placingSelector = false;
		this.locked = false;
		this.active = false;
		this.floor = null;
		this.ceiling = null;
		this.wallN = null;
		this.wallS = null;
		this.wallW = null;
		this.wallE = null;
		this.wallMat = null;
		this.minX = -1000;
		this.maxX = 1000;
		this.minY = -1000;
		this.maxY = 1000;
		this.minZ = -1000;
		this.maxZ = 1000;
		this.structCache = {};
		this.epiDataCache = {};
		this.logger.log('Initialized');
	}

	/**
	 * Updates a boundary of the sort, and triggers the appropriate function(s) to modify the mesh in babylon
	 * @param bound the bound to be updated (must be minX, maxX, minY, maxY, minZ, or maxZ)
	 * @param value the new value of the bound
	 */
	public updateBound(bound: Bound, value: number) {
		if (!this.locked) {
			this[bound] = value;

			if (this.placingSelector) {
				this.updateWalls();
			}
		}
	}

	/**
	 * Selects from the structure
	 * @param params different parameters to use, used for complex sorts (ie. bpsSelector)
	 * @returns the structure coordinates found by the selector
	 */
	public selectStructure(params?: VolSelectParams): RawStructureCoord[] {
		// Grab sort parameters, taking params object as priority, but defaulting to use the selector module's parameters
		const { maxX, maxY, maxZ, minX, minY, minZ } = params || this;

		const keyStr = `${maxX},${maxY},${maxZ},${minX},${minY},${minZ}`;

		if (keyStr in this.structCache) {
			return this.structCache[keyStr];
		}

		const results = this.structure.structureBush.search({ maxX, maxY, maxZ, minX, minY, minZ }).map((point) => point.raw);

		this.structCache[keyStr] = results;

		return results;
	}

	/**
	 * Selects from the epiData
	 * @param params different parameters to use, used for complex sorts (ie. bpsSelector)
	 * @returns the epiData features found by the selector
	 */
	public selectEpiData(params?: VolSelectParams): RawEpiData {
		// Grab sort parameters, taking params object as priority, but defaulting to use the selector module's parameters
		const { maxX, maxY, maxZ, minX, minY, minZ } = params || this;

		const keyStr = `${maxX},${maxY},${maxZ},${minX},${minY},${minZ}`;

		if (keyStr in this.epiDataCache) {
			return this.epiDataCache[keyStr];
		}

		const results = {
			arcs: this.epiData.arcBush.search({ maxX, maxY, maxZ, minX, minY, minZ }).map((arc) => arc.raw),
			flags: this.epiData.flagBush.search({ maxX, maxY, maxZ, minX, minY, minZ }).map((arc) => arc.raw)
		};

		this.epiDataCache[keyStr] = results;

		return results;
	}

	/** Start the sort (ie. display the guide mesh) */
	public start(): void {
		this.placingSelector = true;

		// Create one material for all the walls
		const planeMat = new StandardMaterial('planemat', this.scene);
		planeMat.wireframe = true;

		// Create walls
		this.wallE = MeshBuilder.CreatePlane('wallE', { width: 1, height: 1 }, this.scene);
		this.wallE.rotation = new Vector3(0, Math.PI / 2, 0);
		this.wallE.material = planeMat;
		this.wallW = MeshBuilder.CreatePlane('wallW', { width: 1, height: 1 }, this.scene);
		this.wallW.rotation = new Vector3(0, Math.PI / 2, 0);
		this.wallW.material = planeMat;
		this.wallN = MeshBuilder.CreatePlane('wallN', { width: 1, height: 1 }, this.scene);
		this.wallN.material = planeMat;
		this.wallS = MeshBuilder.CreatePlane('wallS', { width: 1, height: 1 }, this.scene);
		this.wallS.material = planeMat;
		this.ceiling = MeshBuilder.CreatePlane('ceiling', { width: 1, height: 1 }, this.scene);
		this.ceiling.rotation = new Vector3(Math.PI / 2, 0, 0);
		this.ceiling.material = planeMat;
		this.floor = MeshBuilder.CreatePlane('floor', { width: 1, height: 1 }, this.scene);
		this.floor.rotation = new Vector3(Math.PI / 2, 0, 0);
		this.floor.material = planeMat;
		this.wallMat = planeMat;

		this.wallE.isPickable = false;
		this.wallW.isPickable = false;
		this.wallN.isPickable = false;
		this.wallS.isPickable = false;
		this.ceiling.isPickable = false;
		this.floor.isPickable = false;

		// Update positions, to get walls in the correct positions
		this.updateWalls();
	}

	/**
	 * Sets whether the guide meshes (the box) is shown
	 * @param shown whether the guide mesh should be shown or not
	 */
	public setGuideShown(shown: boolean): void {
		if ((this.placingSelector || this.locked || this.active) && this.floor.isEnabled() !== shown) {
			this.wallE.setEnabled(shown);
			this.wallW.setEnabled(shown);
			this.wallS.setEnabled(shown);
			this.wallN.setEnabled(shown);
			this.ceiling.setEnabled(shown);
			this.floor.setEnabled(shown);
		}
	}

	/** Lock the parameters of the selector, in preparation for execution */
	public finalize(): void {
		if (this.placingSelector) {
			this.locked = true;
			this.placingSelector = false;

			// Set walls' colors to green to indicate to user the sort is ready
			this.wallMat.specularColor = new Color3(0, 1, 0);
		}
	}

	/**
	 * Execute the selector with the data in the selector class WITHOUT regard for other
	 * sorts ``(SHOULD NOT BE USED UNLESS OTHER SORTS ARE GUARANTEED TO BE INACTIVE)``
	 */
	public execute(): void {
		if (this.locked) {
			this.active = true;
			const epiDataSelect = this.selectEpiData();
			this.structure.renderStruct(this.selectStructure());
			this.epiData.renderArcs(epiDataSelect.arcs);
			this.epiData.renderFlags(epiDataSelect.flags, 80);
		}
	}

	/** Cancel the placement of the sort */
	public cancel(): void {
		if (this.placingSelector) {
			this.placingSelector = false;
			this.wallMat.dispose();
			this.wallE.dispose();
			this.wallW.dispose();
			this.wallS.dispose();
			this.wallN.dispose();
			this.ceiling.dispose();
			this.floor.dispose();
			this.wallMat = null;
			this.wallE = null;
			this.wallW = null;
			this.wallS = null;
			this.wallN = null;
			this.ceiling = null;
			this.floor = null;
			this.minX = -1000;
			this.maxX = 1000;
			this.minY = -1000;
			this.maxY = 1000;
			this.minZ = -1000;
			this.maxZ = 1000;
		}
	}

	/**
	 * Resets the sort ``(WARNING: do not use override = true UNLESS you can guarantee that the appropriate
	 * resets will be made elsewhere in the model (struct, epiData, etc.))``
	 * @param override whether to override the check of sort being active
	 */
	public reset(override?: boolean): void {
		if (this.locked && (!this.active || override)) {
			this.locked = false;
			this.placingSelector = false;
			this.active = false;
			this.wallMat.dispose();
			this.wallE.dispose();
			this.wallW.dispose();
			this.wallS.dispose();
			this.wallN.dispose();
			this.ceiling.dispose();
			this.floor.dispose();
			this.wallMat = null;
			this.wallE = null;
			this.wallW = null;
			this.wallS = null;
			this.wallN = null;
			this.ceiling = null;
			this.floor = null;
			this.minX = -1000;
			this.maxX = 1000;
			this.minY = -1000;
			this.maxY = 1000;
			this.minZ = -1000;
			this.maxZ = 1000;

			// Call reset function if necessary
			if (this.onReset) {
				this.onReset();
			}
		}
	}

	/** Updates the meshes for the walls in response to updated bounds (only called in updateBounds) */
	private updateWalls(): void {
		this.wallE.position = new Vector3(this.minX, (this.maxY + this.minY) / 2, (this.maxZ + this.minZ) / 2);
		this.wallE.scaling = new Vector3(this.maxZ - this.minZ, this.maxY - this.minY, 0);
		this.wallW.position = new Vector3(this.maxX, (this.maxY + this.minY) / 2, (this.maxZ + this.minZ) / 2);
		this.wallW.scaling = new Vector3(this.maxZ - this.minZ, this.maxY - this.minY, 0);
		this.wallN.position = new Vector3((this.maxX + this.minX) / 2, (this.maxY + this.minY) / 2, this.maxZ);
		this.wallN.scaling = new Vector3(this.maxX - this.minX, this.maxY - this.minY, 0);
		this.wallS.position = new Vector3((this.maxX + this.minX) / 2, (this.maxY + this.minY) / 2, this.minZ);
		this.wallS.scaling = new Vector3(this.maxX - this.minX, this.maxY - this.minY, 0);
		this.ceiling.position = new Vector3((this.maxX + this.minX) / 2, this.maxY, (this.maxZ + this.minZ) / 2);
		this.ceiling.scaling = new Vector3(this.maxX - this.minX, this.maxZ - this.minZ, 0);
		this.floor.position = new Vector3((this.maxX + this.minX) / 2, this.minY, (this.maxZ + this.minZ) / 2);
		this.floor.scaling = new Vector3(this.maxX - this.minX, this.maxZ - this.minZ, 0);
	}
}
