import type { Scene } from 'babylonjs';
import type EpiDataModule from './epiData';
import type RadiusSelectorModule from './radiusSelector';
import type StructureModule from './structure';
import { Logger } from './utils/utils';

/** Class to handle all operations regarding the base pair selector */
export default class BasePairSelectorModule {
	/** Logger module */
	private logger: Logger;

	/** Caches of results, for faster recollection */
	private structCache: Record<string, RawStructureCoord[]>;
	private epiDataCache: Record<string, RawEpiData>;

	/** Chromosome regions to select on */
	public regions: string | null;

	/** The radius to select on */
	public radius: number;

	/** If the user has locked in the radius and regions */
	public locked: boolean;

	/** If the selector is currently being executed */
	public active: boolean;

	/** Function called when the sort is reset (currently unused) */
	public onReset?: () => void;

	/**
	 * Creates a new base pair selector module
	 * @param scene the scene to render in
	 * @param structure the structure module to be used
	 * @param epiData the epiData module to be used
	 * @param radSelect the radius selector utility module to be used
	 * @param viewRegion the view region being rendered in
	 */
	constructor(
		private scene: Scene,
		private structure: StructureModule,
		private epiData: EpiDataModule,
		private radSelect: RadiusSelectorModule,
		public viewRegion: ViewRegion
	) {
		this.logger = new Logger('BPS');
		this.regions = null;
		this.radius = 500;
		this.locked = false;
		this.active = false;
		this.structCache = {};
		this.epiDataCache = {};
		this.logger.log('Initialized');
	}

	/**
	 * Sets the radius parameter
	 * @param rad the new radius
	 */
	public updateRadius(rad: number): void {
		if (!this.locked && !this.active) {
			this.radius = rad;
		}
	}

	public updateRegion(reg: string): void {
		if (!this.locked && !this.active) {
			if (/^(chr\d{1,2}:\d+-\d+;)*chr\d{1,2}:\d+-\d+$/.test(reg)) {
				this.regions = reg;
			} else {
				throw new Error('Parameter is not a valid chromosome selection region!');
			}
		}
	}

	/**
	 * Selects from the structure
	 * @param params different parameters to use, maybe will be used later?
	 * @returns the structure coordinates found by the selector
	 * TODO: add cacheing for results (allows for faster recall times (hopefully))
	 */
	public selectStructure(params?: BPSParams): RawStructureCoord[] {
		// Grab sort parameters, taking params object as priority, but defaulting to use the selector module's parameters
		const { regions, radius } = params || this;

		const keyStr = `${regions},${radius}`;

		if (keyStr in this.structCache) {
			return this.structCache[keyStr];
		}

		this.logger.log(`Selecting for ${regions} with radius ${radius}`);
		// Parsing regions
		const bounds = regions
				.split(';')
				.map((str) => str.split(':')[1])
				.map((segment) => ({ start: parseInt(segment.split('-')[0]), stop: parseInt(segment.split('-')[1]) })),
			selected: RawStructureCoord[] = [];

		// Iterate over each segment
		bounds.forEach(({ start, stop }) => {
			// Find structure Indices
			const startTag = Math.round(((start - this.viewRegion.start) / this.viewRegion.length) * this.structure.data.length),
				stopTag = Math.round(((stop - this.viewRegion.start) / this.viewRegion.length) * this.structure.data.length),
				// Find the structure coordinates of the segment
				segCoords: RawStructureCoord[] =
					startTag > stopTag
						? this.structure.data.slice(stopTag, startTag + 1)
						: startTag < stopTag
						? this.structure.data.slice(startTag, stopTag + 1)
						: [this.structure.data[startTag]];

			// const mesh = MeshBuilder.CreateBox('bphighlightencompassedmeshcube', { size: 50, updatable: true }, this.scene);
			// const position = new Vector3(encompassedCoords[0].x, encompassedCoords[0].y, encompassedCoords[0].z);
			// mesh.position = position;
			// const boxMat = new StandardMaterial('encompassedmaterial', this.scene);
			// mesh.material = boxMat;

			// // optimizations
			// boxMat.freeze();
			// mesh.freezeWorldMatrix();
			// mesh.doNotSyncBoundingInfo = true;
			// mesh.cullingStrategy = AbstractMesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY;
			// mesh.convertToUnIndexedMesh();

			// // Storing data for later
			// smallSegments.push(segmentNumber);
			// bpsHighlights.push({ name: 'bpsMeshHighlight', position, radius });
			// selected.push(mesh);
			// centers.push(position);

			// Use radius selector around each found segment (if the segment is more than 1 bp long, take middle element of segment)
			selected.push(
				...(segCoords.length === 1
					? this.radSelect.selectStructure({ position: segCoords[0], radius })
					: this.radSelect.selectStructure({ position: segCoords[Math.ceil(segCoords.length / 2)], radius }))
			);
		});

		this.structCache[keyStr] = selected;

		return selected;
	}

	/**
	 * Selects from the epiData
	 * @param params different parameters to use, maybe will be used later?
	 * @returns the epiData features found by the selector
	 * TODO: add cacheing for results (allows for faster recall times (hopefully))
	 */
	public selectEpiData(params?: BPSParams): RawEpiData {
		// Grab sort parameters, taking params object as priority, but defaulting to use the selector module's parameters
		const { regions, radius } = params || this;

		const keyStr = `${regions},${radius}`;

		if (keyStr in this.epiDataCache) {
			return this.epiDataCache[keyStr];
		}

		this.logger.log(`Selecting for ${regions} with radius ${radius}`);
		// Parsing regions
		const bounds = regions
				.split(';')
				.map((str) => str.split(':')[1])
				.map((segment) => ({ start: parseInt(segment.split('-')[0]), stop: parseInt(segment.split('-')[1]) })),
			out: RawEpiData = { arcs: [], flags: [] };

		bounds.forEach(({ start, stop }) => {
			// Find structure Indices
			const startTag = Math.round(((start - this.viewRegion.start) / this.viewRegion.length) * this.structure.data.length),
				stopTag = Math.round(((stop - this.viewRegion.start) / this.viewRegion.length) * this.structure.data.length),
				// Find the structure coordinates of the segment
				segCoords: RawStructureCoord[] =
					startTag > stopTag
						? this.structure.data.slice(stopTag, startTag + 1)
						: startTag < stopTag
						? this.structure.data.slice(startTag, stopTag + 1)
						: [this.structure.data[startTag]];

			// Use radius selector around each found segment (if the segment is more than 1 bp long, take middle element of segment)
			if (segCoords.length === 1) {
				this.logger.log('Found short segment');
				const { arcs, flags } = this.radSelect.selectEpiData({ position: segCoords[0], radius });
				arcs.forEach((arc) => out.arcs.push(arc));
				flags.forEach((flag) => out.flags.push(flag));
			} else {
				this.logger.log('Not short segment');
				const center = segCoords[Math.ceil(segCoords.length / 2)];

				const { arcs, flags } = this.radSelect.selectEpiData({ position: center, radius });
				arcs.forEach((arc) => out.arcs.push(arc));
				flags.forEach((flag) => out.flags.push(flag));
			}
		});

		this.epiDataCache[keyStr] = out;

		return out;
	}

	/** Lock the parameters of the selector, in preparation for execution */
	public finalize(): void {
		this.locked = true;
	}

	/**
	 * Execute the selector with the data in the selector class WITHOUT regard for other
	 * sorts ``(SHOULD NOT BE USED UNLESS OTHER SORTS ARE GUARANTEED TO BE INACTIVE)``
	 */
	public execute(): void {
		if (this.locked) {
			this.structure.renderStruct(this.selectStructure());
			const epiDataResults = this.selectEpiData();
			this.epiData.renderArcs(epiDataResults.arcs);
			this.epiData.renderFlags(epiDataResults.flags, 80);
			this.active = true;
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
			this.active = false;
			this.radius = 500;
			this.regions = null;

			if (this.onReset) {
				this.onReset();
			}
		}
	}
}
